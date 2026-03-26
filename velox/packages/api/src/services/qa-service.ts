import { v4 as uuid } from 'uuid';
import { dynamoDb } from '@velox/aws-clients';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@velox/shared';
import type { QARecord, QARule, FlaggedSegment, AutomatedFlag, QAStatus, FlagSeverity } from '@velox/shared';
import { AppError } from '../middleware/error-handler';

const QA_TABLE = TABLE_NAMES.QA_RECORDS;
const RULES_TABLE = TABLE_NAMES.RULES;

// ── QA Records ──────────────────────────────────────────────────────

export async function listQARecords(filters?: {
  status?: QAStatus;
  assignedTo?: string;
}): Promise<QARecord[]> {
  const result = await dynamoDb.send(new ScanCommand({ TableName: QA_TABLE }));
  let records = (result.Items || []) as QARecord[];

  if (filters?.status) {
    records = records.filter((r) => r.status === filters.status);
  }
  if (filters?.assignedTo) {
    records = records.filter((r) => r.assignedTo === filters.assignedTo);
  }

  // Sort by most recent first
  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return records;
}

export async function getQARecord(id: string): Promise<QARecord> {
  const result = await dynamoDb.send(new GetCommand({ TableName: QA_TABLE, Key: { id } }));
  if (!result.Item) throw new AppError(404, 'QA record not found');
  return result.Item as QARecord;
}

export async function getQARecordByVideoId(videoId: string): Promise<QARecord | null> {
  const result = await dynamoDb.send(new ScanCommand({
    TableName: QA_TABLE,
    FilterExpression: 'videoId = :videoId',
    ExpressionAttributeValues: { ':videoId': videoId },
  }));
  return (result.Items?.[0] as QARecord) || null;
}

export async function createQARecord(videoId: string, automatedFlags: AutomatedFlag[] = []): Promise<QARecord> {
  const id = uuid();
  const now = new Date().toISOString();

  const record: QARecord = {
    id,
    videoId,
    status: automatedFlags.length > 0 ? 'pending' : 'pending',
    flaggedSegments: [],
    automatedFlags,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDb.send(new PutCommand({ TableName: QA_TABLE, Item: record }));
  return record;
}

export async function updateQARecord(
  id: string,
  input: {
    status?: QAStatus;
    assignedTo?: string;
    transcriptNotes?: string;
    flaggedSegments?: FlaggedSegment[];
    reviewedBy?: string;
  }
): Promise<QARecord> {
  await getQARecord(id); // ensure exists

  const updates: Record<string, unknown> = { ...input, updatedAt: new Date().toISOString() };
  if (input.status === 'approved' || input.status === 'rejected') {
    updates.reviewedAt = new Date().toISOString();
  }

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

  if (parts.length === 0) return getQARecord(id);

  const result = await dynamoDb.send(new UpdateCommand({
    TableName: QA_TABLE,
    Key: { id },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes as QARecord;
}

export async function deleteQARecord(id: string): Promise<void> {
  await dynamoDb.send(new DeleteCommand({ TableName: QA_TABLE, Key: { id } }));
}

// ── QA Rules ────────────────────────────────────────────────────────

export async function listQARules(): Promise<QARule[]> {
  const result = await dynamoDb.send(new ScanCommand({ TableName: RULES_TABLE }));
  return (result.Items || []) as QARule[];
}

export async function getQARule(id: string): Promise<QARule> {
  const result = await dynamoDb.send(new GetCommand({ TableName: RULES_TABLE, Key: { id } }));
  if (!result.Item) throw new AppError(404, 'QA rule not found');
  return result.Item as QARule;
}

export async function upsertQARule(input: {
  id?: string;
  name: string;
  type: QARule['type'];
  enabled: boolean;
  config: Record<string, unknown>;
  severity: FlagSeverity;
}): Promise<QARule> {
  const id = input.id || uuid();
  const now = new Date().toISOString();
  const existing = input.id ? await dynamoDb.send(new GetCommand({ TableName: RULES_TABLE, Key: { id } })) : null;

  const rule: QARule = {
    id,
    name: input.name,
    type: input.type,
    enabled: input.enabled,
    config: input.config,
    severity: input.severity,
    createdAt: existing?.Item ? (existing.Item as QARule).createdAt : now,
    updatedAt: now,
  };

  await dynamoDb.send(new PutCommand({ TableName: RULES_TABLE, Item: rule }));
  return rule;
}

export async function deleteQARule(id: string): Promise<void> {
  await dynamoDb.send(new DeleteCommand({ TableName: RULES_TABLE, Key: { id } }));
}

// ── Automated Flagging Engine ───────────────────────────────────────

interface TranscriptWord {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export function runFlaggingRules(
  rules: QARule[],
  segments: Array<{ startTime: number; endTime: number; text: string; confidence: number }>,
): AutomatedFlag[] {
  const flags: AutomatedFlag[] = [];
  const enabledRules = rules.filter((r) => r.enabled);

  for (const rule of enabledRules) {
    switch (rule.type) {
      case 'keyword_blacklist': {
        const keywords = ((rule.config.keywords as string[]) || []).map((k) => k.toLowerCase());
        for (const seg of segments) {
          const text = seg.text.toLowerCase();
          for (const kw of keywords) {
            if (text.includes(kw)) {
              flags.push({
                ruleId: rule.id,
                ruleName: rule.name,
                startTime: seg.startTime,
                endTime: seg.endTime,
                description: `Blacklisted keyword "${kw}" detected`,
                severity: rule.severity,
              });
            }
          }
        }
        break;
      }

      case 'profanity_filter': {
        const profanityList = ((rule.config.words as string[]) || defaultProfanityList).map((w) => w.toLowerCase());
        for (const seg of segments) {
          const words = seg.text.toLowerCase().split(/\s+/);
          for (const word of words) {
            const clean = word.replace(/[^a-z]/g, '');
            if (profanityList.includes(clean)) {
              flags.push({
                ruleId: rule.id,
                ruleName: rule.name,
                startTime: seg.startTime,
                endTime: seg.endTime,
                description: `Potential profanity detected: "${clean}"`,
                severity: rule.severity,
              });
              break; // one flag per segment
            }
          }
        }
        break;
      }

      case 'repeated_phrase': {
        const minRepeats = (rule.config.minRepeats as number) || 3;
        const minWords = (rule.config.minWords as number) || 3;
        const phraseCount = new Map<string, { count: number; firstStart: number; lastEnd: number }>();

        for (const seg of segments) {
          const words = seg.text.toLowerCase().split(/\s+/);
          for (let len = minWords; len <= Math.min(words.length, 8); len++) {
            for (let i = 0; i <= words.length - len; i++) {
              const phrase = words.slice(i, i + len).join(' ');
              const entry = phraseCount.get(phrase);
              if (entry) {
                entry.count++;
                entry.lastEnd = seg.endTime;
              } else {
                phraseCount.set(phrase, { count: 1, firstStart: seg.startTime, lastEnd: seg.endTime });
              }
            }
          }
        }

        for (const [phrase, data] of phraseCount) {
          if (data.count >= minRepeats) {
            flags.push({
              ruleId: rule.id,
              ruleName: rule.name,
              startTime: data.firstStart,
              endTime: data.lastEnd,
              description: `Phrase "${phrase}" repeated ${data.count} times`,
              severity: rule.severity,
            });
          }
        }
        break;
      }

      case 'low_confidence': {
        const threshold = (rule.config.threshold as number) || 0.7;
        for (const seg of segments) {
          if (seg.confidence < threshold && seg.confidence > 0) {
            flags.push({
              ruleId: rule.id,
              ruleName: rule.name,
              startTime: seg.startTime,
              endTime: seg.endTime,
              description: `Low transcription confidence: ${(seg.confidence * 100).toFixed(0)}%`,
              severity: rule.severity,
            });
          }
        }
        break;
      }

      case 'silence_detection': {
        const minGap = (rule.config.minGapSeconds as number) || 5;
        for (let i = 1; i < segments.length; i++) {
          const gap = segments[i].startTime - segments[i - 1].endTime;
          if (gap >= minGap) {
            flags.push({
              ruleId: rule.id,
              ruleName: rule.name,
              startTime: segments[i - 1].endTime,
              endTime: segments[i].startTime,
              description: `${gap.toFixed(1)}s silence detected`,
              severity: rule.severity,
            });
          }
        }
        break;
      }
    }
  }

  return flags;
}

const defaultProfanityList = [
  'damn', 'hell', 'shit', 'fuck', 'ass', 'bitch', 'bastard', 'crap',
];
