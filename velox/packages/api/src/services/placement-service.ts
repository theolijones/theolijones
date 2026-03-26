import { v4 as uuid } from 'uuid';
import { dynamoDb } from '@velox/aws-clients';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, PAGINATION_DEFAULTS } from '@velox/shared';
import type {
  Placement, CreatePlacementInput, UpdatePlacementInput,
  PlacementRule, Video, PaginatedResponse,
  ScheduleOverride, CreateScheduleOverrideInput,
} from '@velox/shared';
import { AppError } from '../middleware/error-handler';

const TABLE = TABLE_NAMES.PLACEMENTS;
const VIDEOS_TABLE = TABLE_NAMES.VIDEOS;
const SCHEDULES_TABLE = TABLE_NAMES.SCHEDULES;

// ─── Placement CRUD ───────────────────────────────────────────

export async function listPlacements(): Promise<Placement[]> {
  const result = await dynamoDb.send(new ScanCommand({ TableName: TABLE }));
  return (result.Items || []) as Placement[];
}

export async function getPlacement(id: string): Promise<Placement> {
  const result = await dynamoDb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!result.Item) throw new AppError(404, 'Placement not found');
  return result.Item as Placement;
}

export async function createPlacement(input: CreatePlacementInput): Promise<Placement> {
  const now = new Date().toISOString();
  const placement: Placement = {
    id: uuid(),
    name: input.name,
    description: input.description || '',
    type: input.type,
    targetUrl: input.targetUrl,
    targetIdentifier: input.targetIdentifier,
    maxVideos: input.maxVideos || 10,
    tags: input.tags || [],
    rules: [],
    createdAt: now,
    updatedAt: now,
  };
  await dynamoDb.send(new PutCommand({ TableName: TABLE, Item: placement }));
  return placement;
}

export async function updatePlacement(id: string, input: UpdatePlacementInput): Promise<Placement> {
  await getPlacement(id);
  const updates: Record<string, unknown> = { ...input, updatedAt: new Date().toISOString() };
  const parts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  let i = 0;
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      parts.push(`#a${i} = :v${i}`);
      names[`#a${i}`] = key;
      values[`:v${i}`] = value;
      i++;
    }
  }
  if (parts.length === 0) return getPlacement(id);
  const result = await dynamoDb.send(new UpdateCommand({
    TableName: TABLE, Key: { id },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes as Placement;
}

export async function deletePlacement(id: string): Promise<void> {
  await getPlacement(id);
  await dynamoDb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
}

// ─── Rules Engine ─────────────────────────────────────────────

export async function evaluateRules(placement: Placement): Promise<Video[]> {
  const now = new Date().toISOString();

  // Check for active schedule overrides first
  const overrides = await getActiveOverrides(placement.id, now);
  const overrideVideoIds = overrides.map((o) => o.videoId);

  let videos: Video[] = [];

  for (const rule of placement.rules) {
    const ruleVideos = await evaluateRule(rule);
    videos.push(...ruleVideos);
  }

  // Deduplicate
  const seen = new Set<string>();
  videos = videos.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  // Put override videos first
  if (overrideVideoIds.length > 0) {
    const overrideVideos = videos.filter((v) => overrideVideoIds.includes(v.id));
    const otherVideos = videos.filter((v) => !overrideVideoIds.includes(v.id));
    videos = [...overrideVideos, ...otherVideos];
  }

  // Apply manual order if present
  if (placement.manualOrder && placement.manualOrder.length > 0) {
    const orderMap = new Map(placement.manualOrder.map((id, idx) => [id, idx]));
    videos.sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? 999;
      const bIdx = orderMap.get(b.id) ?? 999;
      return aIdx - bIdx;
    });
  }

  return videos.slice(0, placement.maxVideos);
}

async function evaluateRule(rule: PlacementRule): Promise<Video[]> {
  switch (rule.type) {
    case 'folder': {
      const result = await dynamoDb.send(new QueryCommand({
        TableName: VIDEOS_TABLE,
        IndexName: 'folderId-index',
        KeyConditionExpression: 'folderId = :folderId',
        ExpressionAttributeValues: { ':folderId': rule.value },
        ScanIndexForward: false,
      }));
      return (result.Items || []) as Video[];
    }
    case 'tag': {
      const result = await dynamoDb.send(new ScanCommand({
        TableName: VIDEOS_TABLE,
        FilterExpression: 'contains(tags, :tag)',
        ExpressionAttributeValues: { ':tag': rule.value },
      }));
      return (result.Items || []) as Video[];
    }
    case 'recent': {
      const days = parseInt(rule.value, 10) || 7;
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const result = await dynamoDb.send(new QueryCommand({
        TableName: VIDEOS_TABLE,
        IndexName: 'status-index',
        KeyConditionExpression: '#status = :status AND uploadedAt >= :cutoff',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'published', ':cutoff': cutoff },
        ScanIndexForward: false,
      }));
      return (result.Items || []) as Video[];
    }
    case 'manual': {
      // Value is comma-separated video IDs
      const ids = rule.value.split(',').map((s) => s.trim()).filter(Boolean);
      const videos: Video[] = [];
      for (const id of ids) {
        try {
          const result = await dynamoDb.send(new GetCommand({ TableName: VIDEOS_TABLE, Key: { id } }));
          if (result.Item) videos.push(result.Item as Video);
        } catch { /* skip missing */ }
      }
      return videos;
    }
    default:
      return [];
  }
}

// ─── Schedule Overrides ───────────────────────────────────────

async function getActiveOverrides(placementId: string, now: string): Promise<ScheduleOverride[]> {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: SCHEDULES_TABLE,
    IndexName: 'placementId-index',
    KeyConditionExpression: 'placementId = :pid AND startAt <= :now',
    FilterExpression: 'endAt >= :now',
    ExpressionAttributeValues: { ':pid': placementId, ':now': now },
  }));
  return (result.Items || []) as ScheduleOverride[];
}

export async function listOverrides(placementId: string): Promise<ScheduleOverride[]> {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: SCHEDULES_TABLE,
    IndexName: 'placementId-index',
    KeyConditionExpression: 'placementId = :pid',
    ExpressionAttributeValues: { ':pid': placementId },
    ScanIndexForward: true,
  }));
  return (result.Items || []) as ScheduleOverride[];
}

export async function createOverride(input: CreateScheduleOverrideInput, userId: string): Promise<ScheduleOverride> {
  const override: ScheduleOverride = {
    id: uuid(),
    placementId: input.placementId,
    videoId: input.videoId,
    startAt: input.startAt,
    endAt: input.endAt,
    priority: input.priority || 0,
    createdAt: new Date().toISOString(),
    createdBy: userId,
  };
  await dynamoDb.send(new PutCommand({ TableName: SCHEDULES_TABLE, Item: override }));
  return override;
}

export async function deleteOverride(id: string): Promise<void> {
  await dynamoDb.send(new DeleteCommand({ TableName: SCHEDULES_TABLE, Key: { id } }));
}
