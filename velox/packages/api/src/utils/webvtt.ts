/**
 * Utilities for converting between AWS Transcribe JSON and WebVTT format.
 */

export interface TranscribeItem {
  start_time: string;
  end_time: string;
  alternatives: Array<{
    confidence: string;
    content: string;
  }>;
  type: 'pronunciation' | 'punctuation';
}

export interface TranscribeResult {
  jobName: string;
  results: {
    transcripts: Array<{ transcript: string }>;
    items: TranscribeItem[];
    language_code?: string;
    speaker_labels?: {
      speakers: number;
      segments: Array<{
        start_time: string;
        end_time: string;
        speaker_label: string;
        items: Array<{ start_time: string; end_time: string; speaker_label: string }>;
      }>;
    };
  };
}

export interface TranscriptSegment {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  speaker?: string;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function parseTimestamp(vttTimestamp: string): number {
  const parts = vttTimestamp.split(':');
  const secParts = parts[parts.length - 1].split('.');
  const h = parts.length === 3 ? parseInt(parts[0], 10) : 0;
  const m = parts.length === 3 ? parseInt(parts[1], 10) : parseInt(parts[0], 10);
  const s = parseInt(secParts[0], 10);
  const ms = parseInt(secParts[1] || '0', 10);
  return h * 3600 + m * 60 + s + ms / 1000;
}

/**
 * Group Transcribe items into segments of ~5 seconds or at sentence boundaries.
 */
export function transcribeItemsToSegments(items: TranscribeItem[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let currentWords: string[] = [];
  let currentStart: number | null = null;
  let currentEnd = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  let segmentId = 1;

  const MAX_SEGMENT_DURATION = 5; // seconds
  const SENTENCE_ENDINGS = ['.', '!', '?'];

  for (const item of items) {
    if (item.type === 'pronunciation') {
      const startTime = parseFloat(item.start_time);
      const endTime = parseFloat(item.end_time);
      const word = item.alternatives[0]?.content || '';
      const confidence = parseFloat(item.alternatives[0]?.confidence || '0');

      if (currentStart === null) {
        currentStart = startTime;
      }

      currentWords.push(word);
      currentEnd = endTime;
      confidenceSum += confidence;
      confidenceCount++;
    } else if (item.type === 'punctuation') {
      const punct = item.alternatives[0]?.content || '';
      if (currentWords.length > 0) {
        currentWords[currentWords.length - 1] += punct;
      }

      // Check if this is a sentence ending and segment is long enough
      const duration = currentStart !== null ? currentEnd - currentStart : 0;
      if (SENTENCE_ENDINGS.includes(punct) && duration >= 2) {
        segments.push({
          id: segmentId++,
          startTime: currentStart!,
          endTime: currentEnd,
          text: currentWords.join(' '),
          confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
        });
        currentWords = [];
        currentStart = null;
        confidenceSum = 0;
        confidenceCount = 0;
      }
    }

    // Force segment break at max duration
    if (currentStart !== null && currentEnd - currentStart >= MAX_SEGMENT_DURATION && currentWords.length > 0) {
      segments.push({
        id: segmentId++,
        startTime: currentStart,
        endTime: currentEnd,
        text: currentWords.join(' '),
        confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
      });
      currentWords = [];
      currentStart = null;
      confidenceSum = 0;
      confidenceCount = 0;
    }
  }

  // Flush remaining words
  if (currentWords.length > 0 && currentStart !== null) {
    segments.push({
      id: segmentId++,
      startTime: currentStart,
      endTime: currentEnd,
      text: currentWords.join(' '),
      confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
    });
  }

  return segments;
}

/**
 * Convert AWS Transcribe JSON to WebVTT format.
 */
export function transcribeJsonToWebVTT(transcribeResult: TranscribeResult): string {
  const segments = transcribeItemsToSegments(transcribeResult.results.items);
  return segmentsToWebVTT(segments);
}

/**
 * Convert transcript segments to WebVTT string.
 */
export function segmentsToWebVTT(segments: TranscriptSegment[]): string {
  const lines = ['WEBVTT', ''];

  for (const segment of segments) {
    lines.push(String(segment.id));
    lines.push(`${formatTimestamp(segment.startTime)} --> ${formatTimestamp(segment.endTime)}`);
    lines.push(segment.text);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Parse a WebVTT string back into transcript segments.
 */
export function parseWebVTT(vtt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vtt.split('\n');
  let i = 0;

  // Skip header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map((s) => s.trim());
      const startTime = parseTimestamp(startStr);
      const endTime = parseTimestamp(endStr);

      // Collect text lines until blank line
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      segments.push({
        id: segments.length + 1,
        startTime,
        endTime,
        text: textLines.join(' '),
        confidence: 1,
      });
    }

    i++;
  }

  return segments;
}
