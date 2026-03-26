/**
 * QA Flagging Lambda — triggered after transcription completes.
 * Loads the transcript, runs QA rules against it, and creates a QA record with any automated flags.
 *
 * Can be invoked:
 * 1. Asynchronously from transcribe-complete Lambda
 * 2. Via API call to re-run flagging on a video
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import type { QARule, QARecord, AutomatedFlag, FlagSeverity } from '@velox/shared';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const QA_TABLE = process.env.QA_TABLE || 'Velox-QARecords';
const RULES_TABLE = process.env.RULES_TABLE || 'Velox-Rules';
const TRANSCRIPTS_BUCKET = process.env.S3_BUCKET_TRANSCRIPTS || '';

interface TranscribeItem {
  start_time: string;
  end_time: string;
  alternatives: Array<{ confidence: string; content: string }>;
  type: 'pronunciation' | 'punctuation';
}

interface TranscribeResult {
  results: {
    items: TranscribeItem[];
    transcripts: Array<{ transcript: string }>;
  };
}

interface Segment {
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
}

interface QAFlaggingEvent {
  videoId: string;
}

export async function handler(event: QAFlaggingEvent): Promise<{ flagCount: number; qaRecordId: string }> {
  const { videoId } = event;
  console.log(`[QAFlagging] Running QA checks for video ${videoId}`);

  // 1. Load transcript from S3
  let segments: Segment[];
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: TRANSCRIPTS_BUCKET,
      Key: `${videoId}/transcript.json`,
    }));
    const body = await response.Body?.transformToString();
    if (!body) throw new Error('Empty transcript');

    const transcribeResult: TranscribeResult = JSON.parse(body);
    segments = itemsToSegments(transcribeResult.results.items);
  } catch (err) {
    console.error(`[QAFlagging] Could not load transcript for ${videoId}:`, err);
    // Create QA record with no flags (transcript unavailable)
    const record = await createRecord(videoId, []);
    return { flagCount: 0, qaRecordId: record.id };
  }

  // 2. Load enabled QA rules
  const rulesResult = await dynamoDb.send(new ScanCommand({ TableName: RULES_TABLE }));
  const rules = ((rulesResult.Items || []) as QARule[]).filter((r) => r.enabled);

  if (rules.length === 0) {
    console.log('[QAFlagging] No enabled rules, creating clean QA record');
    const record = await createRecord(videoId, []);
    return { flagCount: 0, qaRecordId: record.id };
  }

  // 3. Run flagging engine
  const flags = runFlags(rules, segments);
  console.log(`[QAFlagging] Found ${flags.length} flags for video ${videoId}`);

  // 4. Create or update QA record
  const record = await createRecord(videoId, flags);
  return { flagCount: flags.length, qaRecordId: record.id };
}

async function createRecord(videoId: string, flags: AutomatedFlag[]): Promise<QARecord> {
  // Check if record already exists for this video
  const existing = await dynamoDb.send(new ScanCommand({
    TableName: QA_TABLE,
    FilterExpression: 'videoId = :videoId',
    ExpressionAttributeValues: { ':videoId': videoId },
  }));

  const id = existing.Items?.[0] ? (existing.Items[0] as QARecord).id : uuid();
  const now = new Date().toISOString();

  const record: QARecord = {
    id,
    videoId,
    status: flags.length > 0 ? 'pending' : 'pending',
    flaggedSegments: existing.Items?.[0] ? (existing.Items[0] as QARecord).flaggedSegments : [],
    automatedFlags: flags,
    createdAt: existing.Items?.[0] ? (existing.Items[0] as QARecord).createdAt : now,
    updatedAt: now,
  };

  await dynamoDb.send(new PutCommand({ TableName: QA_TABLE, Item: record }));
  return record;
}

function runFlags(rules: QARule[], segments: Segment[]): AutomatedFlag[] {
  const flags: AutomatedFlag[] = [];

  for (const rule of rules) {
    switch (rule.type) {
      case 'keyword_blacklist': {
        const keywords = ((rule.config.keywords as string[]) || []).map((k) => k.toLowerCase());
        for (const seg of segments) {
          const text = seg.text.toLowerCase();
          for (const kw of keywords) {
            if (text.includes(kw)) {
              flags.push({
                ruleId: rule.id, ruleName: rule.name,
                startTime: seg.startTime, endTime: seg.endTime,
                description: `Blacklisted keyword "${kw}" detected`,
                severity: rule.severity,
              });
            }
          }
        }
        break;
      }

      case 'profanity_filter': {
        const wordList = ((rule.config.words as string[]) || DEFAULT_PROFANITY).map((w) => w.toLowerCase());
        for (const seg of segments) {
          const words = seg.text.toLowerCase().split(/\s+/);
          for (const word of words) {
            const clean = word.replace(/[^a-z]/g, '');
            if (wordList.includes(clean)) {
              flags.push({
                ruleId: rule.id, ruleName: rule.name,
                startTime: seg.startTime, endTime: seg.endTime,
                description: `Potential profanity: "${clean}"`,
                severity: rule.severity,
              });
              break;
            }
          }
        }
        break;
      }

      case 'low_confidence': {
        const threshold = (rule.config.threshold as number) || 0.7;
        for (const seg of segments) {
          if (seg.confidence > 0 && seg.confidence < threshold) {
            flags.push({
              ruleId: rule.id, ruleName: rule.name,
              startTime: seg.startTime, endTime: seg.endTime,
              description: `Low confidence: ${(seg.confidence * 100).toFixed(0)}%`,
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
              ruleId: rule.id, ruleName: rule.name,
              startTime: segments[i - 1].endTime, endTime: segments[i].startTime,
              description: `${gap.toFixed(1)}s silence gap`,
              severity: rule.severity,
            });
          }
        }
        break;
      }

      case 'repeated_phrase': {
        const minRepeats = (rule.config.minRepeats as number) || 3;
        const phraseMap = new Map<string, { count: number; start: number; end: number }>();
        for (const seg of segments) {
          const words = seg.text.toLowerCase().split(/\s+/);
          for (let len = 3; len <= Math.min(words.length, 6); len++) {
            for (let i = 0; i <= words.length - len; i++) {
              const phrase = words.slice(i, i + len).join(' ');
              const e = phraseMap.get(phrase);
              if (e) { e.count++; e.end = seg.endTime; }
              else phraseMap.set(phrase, { count: 1, start: seg.startTime, end: seg.endTime });
            }
          }
        }
        for (const [phrase, data] of phraseMap) {
          if (data.count >= minRepeats) {
            flags.push({
              ruleId: rule.id, ruleName: rule.name,
              startTime: data.start, endTime: data.end,
              description: `"${phrase}" repeated ${data.count}×`,
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

function itemsToSegments(items: TranscribeItem[]): Segment[] {
  const segments: Segment[] = [];
  let words: string[] = [];
  let start: number | null = null;
  let end = 0;
  let confSum = 0;
  let confCount = 0;

  for (const item of items) {
    if (item.type === 'pronunciation') {
      const s = parseFloat(item.start_time);
      const e = parseFloat(item.end_time);
      if (start === null) start = s;
      words.push(item.alternatives[0]?.content || '');
      end = e;
      confSum += parseFloat(item.alternatives[0]?.confidence || '0');
      confCount++;
    } else {
      const punct = item.alternatives[0]?.content || '';
      if (words.length > 0) words[words.length - 1] += punct;
      if (['.', '!', '?'].includes(punct) && start !== null && end - start >= 2) {
        segments.push({ startTime: start, endTime: end, text: words.join(' '), confidence: confCount > 0 ? confSum / confCount : 0 });
        words = []; start = null; confSum = 0; confCount = 0;
      }
    }
    if (start !== null && end - start >= 5 && words.length > 0) {
      segments.push({ startTime: start, endTime: end, text: words.join(' '), confidence: confCount > 0 ? confSum / confCount : 0 });
      words = []; start = null; confSum = 0; confCount = 0;
    }
  }

  if (words.length > 0 && start !== null) {
    segments.push({ startTime: start, endTime: end, text: words.join(' '), confidence: confCount > 0 ? confSum / confCount : 0 });
  }

  return segments;
}

const DEFAULT_PROFANITY = ['damn', 'hell', 'shit', 'fuck', 'ass', 'bitch', 'bastard', 'crap'];
