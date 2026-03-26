import { v4 as uuid } from 'uuid';
import { dynamoDb } from '@velox/aws-clients';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, PAGINATION_DEFAULTS } from '@velox/shared';
import type { Video, CreateVideoInput, UpdateVideoInput, PaginatedResponse } from '@velox/shared';
import { getPresignedUploadUrl } from '@velox/aws-clients';
import { AppError } from '../middleware/error-handler';

const TABLE = TABLE_NAMES.VIDEOS;

export async function listVideos(params: {
  page?: number;
  limit?: number;
  folderId?: string;
  status?: string;
  sort?: string;
}): Promise<PaginatedResponse<Video>> {
  const page = params.page || PAGINATION_DEFAULTS.PAGE;
  const limit = Math.min(params.limit || PAGINATION_DEFAULTS.LIMIT, PAGINATION_DEFAULTS.MAX_LIMIT);

  let result;

  if (params.folderId) {
    result = await dynamoDb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'folderId-index',
      KeyConditionExpression: 'folderId = :folderId',
      ExpressionAttributeValues: { ':folderId': params.folderId },
      ScanIndexForward: false,
    }));
  } else if (params.status) {
    result = await dynamoDb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': params.status },
      ScanIndexForward: false,
    }));
  } else {
    result = await dynamoDb.send(new ScanCommand({
      TableName: TABLE,
    }));
  }

  const items = (result.Items || []) as Video[];

  // Sort
  const sortField = params.sort || 'uploadedAt';
  items.sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortField] as string || '';
    const bVal = (b as Record<string, unknown>)[sortField] as string || '';
    return bVal.localeCompare(aVal);
  });

  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return { data: paged, total: items.length, page, limit };
}

export async function getVideo(id: string): Promise<Video> {
  const result = await dynamoDb.send(new GetCommand({
    TableName: TABLE,
    Key: { id },
  }));

  if (!result.Item) {
    throw new AppError(404, 'Video not found');
  }

  return result.Item as Video;
}

export async function createVideo(input: CreateVideoInput, userId: string): Promise<Video> {
  const now = new Date().toISOString();
  const video: Video = {
    id: uuid(),
    title: input.title,
    description: input.description || '',
    tags: input.tags || [],
    category: input.category || '',
    status: 'uploading',
    uploadedAt: now,
    sourceS3Key: input.sourceS3Key,
    folderId: input.folderId,
    customMetadata: input.customMetadata || {},
    createdBy: userId,
    updatedAt: now,
  };

  await dynamoDb.send(new PutCommand({
    TableName: TABLE,
    Item: video,
  }));

  return video;
}

export async function updateVideo(id: string, input: UpdateVideoInput): Promise<Video> {
  const existing = await getVideo(id);

  const updates: Record<string, unknown> = { ...input, updatedAt: new Date().toISOString() };
  const expressionParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  let i = 0;
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      const attr = `#a${i}`;
      const val = `:v${i}`;
      expressionParts.push(`${attr} = ${val}`);
      names[attr] = key;
      values[val] = value;
      i++;
    }
  }

  if (expressionParts.length === 0) return existing;

  const result = await dynamoDb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes as Video;
}

export async function deleteVideo(id: string): Promise<void> {
  await getVideo(id); // Ensure exists
  await dynamoDb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { id },
  }));
}

export async function getUploadUrl(
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const s3Key = `uploads/${Date.now()}-${filename}`;
  const bucket = process.env.S3_BUCKET_VIDEO_SOURCE || 'velox-video-source';
  const uploadUrl = await getPresignedUploadUrl(bucket, s3Key, contentType);
  return { uploadUrl, s3Key };
}
