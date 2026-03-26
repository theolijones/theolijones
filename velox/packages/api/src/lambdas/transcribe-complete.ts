/**
 * Triggered by EventBridge when an AWS Transcribe job completes.
 * Fetches the transcript JSON, converts it to WebVTT, and updates the video record.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { transcribeJsonToWebVTT, type TranscribeResult } from '../utils/webvtt';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const lambda = new LambdaClient({});

const VIDEOS_TABLE = process.env.VIDEOS_TABLE || 'Velox-Videos';
const CAPTIONS_BUCKET = process.env.S3_BUCKET_CAPTIONS || '';
const TRANSCRIPTS_BUCKET = process.env.S3_BUCKET_TRANSCRIPTS || '';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';
const QA_FLAGGING_FUNCTION = process.env.QA_FLAGGING_FUNCTION || '';

interface TranscribeEvent {
  detail: {
    TranscriptionJobName: string;
    TranscriptionJobStatus: 'COMPLETED' | 'FAILED';
  };
}

export async function handler(event: TranscribeEvent): Promise<void> {
  const { TranscriptionJobName: jobName, TranscriptionJobStatus: status } = event.detail;

  console.log(`[TranscribeComplete] Job ${jobName} status: ${status}`);

  // Extract videoId from job name (format: velox-<videoId>-<timestamp>)
  const match = jobName.match(/^velox-(.+)-\d+$/);
  if (!match) {
    console.error(`[TranscribeComplete] Could not extract videoId from job name: ${jobName}`);
    return;
  }
  const videoId = match[1];

  if (status === 'FAILED') {
    await dynamoDb.send(new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { id: videoId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':now': new Date().toISOString(),
      },
    }));
    return;
  }

  try {
    // Fetch the Transcribe JSON output from S3
    const transcriptResponse = await s3.send(new GetObjectCommand({
      Bucket: TRANSCRIPTS_BUCKET,
      Key: `${videoId}/transcript.json`,
    }));

    const transcriptBody = await transcriptResponse.Body?.transformToString();
    if (!transcriptBody) {
      throw new Error('Empty transcript response');
    }

    const transcribeResult: TranscribeResult = JSON.parse(transcriptBody);

    // Convert to WebVTT
    const webvtt = transcribeJsonToWebVTT(transcribeResult);

    // Store WebVTT in captions bucket
    await s3.send(new PutObjectCommand({
      Bucket: CAPTIONS_BUCKET,
      Key: `${videoId}/captions.vtt`,
      Body: webvtt,
      ContentType: 'text/vtt',
    }));

    // Detect language
    const detectedLanguage = transcribeResult.results?.language_code || 'en-US';

    // Build caption and transcript URLs
    const captionUrl = `https://${CLOUDFRONT_DOMAIN}/captions/${videoId}/captions.vtt`;
    const transcriptUrl = `https://${CLOUDFRONT_DOMAIN}/transcripts/${videoId}/transcript.json`;

    // Update video record
    await dynamoDb.send(new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { id: videoId },
      UpdateExpression: 'SET #status = :status, captionUrl = :captionUrl, transcriptUrl = :transcriptUrl, detectedLanguage = :lang, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'transcribed',
        ':captionUrl': captionUrl,
        ':transcriptUrl': transcriptUrl,
        ':lang': detectedLanguage,
        ':now': new Date().toISOString(),
      },
    }));

    console.log(`[TranscribeComplete] Video ${videoId} transcription complete, language: ${detectedLanguage}`);

    // Chain to QA flagging Lambda
    if (QA_FLAGGING_FUNCTION) {
      try {
        await lambda.send(new InvokeCommand({
          FunctionName: QA_FLAGGING_FUNCTION,
          InvocationType: 'Event', // async
          Payload: Buffer.from(JSON.stringify({ videoId })),
        }));
        console.log(`[TranscribeComplete] Triggered QA flagging for ${videoId}`);
      } catch (qaErr) {
        console.error(`[TranscribeComplete] Failed to trigger QA flagging:`, qaErr);
        // Non-fatal — don't fail the whole pipeline
      }
    }
  } catch (err) {
    console.error(`[TranscribeComplete] Error processing transcript for ${videoId}:`, err);

    await dynamoDb.send(new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { id: videoId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':now': new Date().toISOString(),
      },
    }));

    throw err;
  }
}
