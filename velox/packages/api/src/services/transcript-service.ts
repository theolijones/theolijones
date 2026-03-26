import { getObject, putObject } from '@velox/aws-clients';
import { dynamoDb } from '@velox/aws-clients';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@velox/shared';
import {
  type TranscribeResult,
  type TranscriptSegment,
  transcribeItemsToSegments,
  segmentsToWebVTT,
  parseWebVTT,
} from '../utils/webvtt';
import { AppError } from '../middleware/error-handler';

const CAPTIONS_BUCKET = process.env.S3_BUCKET_CAPTIONS || 'velox-captions';
const TRANSCRIPTS_BUCKET = process.env.S3_BUCKET_TRANSCRIPTS || 'velox-transcripts';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

export async function getTranscript(videoId: string): Promise<{
  segments: TranscriptSegment[];
  fullText: string;
  language: string;
}> {
  try {
    const result = await getObject({
      Bucket: TRANSCRIPTS_BUCKET,
      Key: `${videoId}/transcript.json`,
    });

    const body = await result.Body?.transformToString();
    if (!body) {
      throw new AppError(404, 'Transcript not found');
    }

    const transcribeResult: TranscribeResult = JSON.parse(body);
    const segments = transcribeItemsToSegments(transcribeResult.results.items);
    const fullText = transcribeResult.results.transcripts[0]?.transcript || '';
    const language = transcribeResult.results.language_code || 'en-US';

    return { segments, fullText, language };
  } catch (err) {
    if ((err as { name?: string }).name === 'NoSuchKey') {
      throw new AppError(404, 'Transcript not found');
    }
    throw err;
  }
}

export async function updateTranscript(
  videoId: string,
  segments: TranscriptSegment[]
): Promise<{ captionUrl: string }> {
  // Generate new WebVTT from edited segments
  const webvtt = segmentsToWebVTT(segments);

  // Upload updated WebVTT to captions bucket
  await putObject({
    Bucket: CAPTIONS_BUCKET,
    Key: `${videoId}/captions.vtt`,
    Body: webvtt,
    ContentType: 'text/vtt',
  });

  const captionUrl = CLOUDFRONT_DOMAIN
    ? `https://${CLOUDFRONT_DOMAIN}/captions/${videoId}/captions.vtt`
    : `s3://${CAPTIONS_BUCKET}/${videoId}/captions.vtt`;

  // Update the video record
  await dynamoDb.send(new UpdateCommand({
    TableName: TABLE_NAMES.VIDEOS,
    Key: { id: videoId },
    UpdateExpression: 'SET captionUrl = :captionUrl, updatedAt = :now',
    ExpressionAttributeValues: {
      ':captionUrl': captionUrl,
      ':now': new Date().toISOString(),
    },
  }));

  return { captionUrl };
}

export async function getCaptionsVTT(videoId: string): Promise<string> {
  try {
    const result = await getObject({
      Bucket: CAPTIONS_BUCKET,
      Key: `${videoId}/captions.vtt`,
    });

    const body = await result.Body?.transformToString();
    if (!body) {
      throw new AppError(404, 'Captions not found');
    }

    return body;
  } catch (err) {
    if ((err as { name?: string }).name === 'NoSuchKey') {
      throw new AppError(404, 'Captions not found');
    }
    throw err;
  }
}
