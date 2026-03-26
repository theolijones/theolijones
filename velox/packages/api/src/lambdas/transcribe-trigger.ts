/**
 * Triggered after MediaConvert completes successfully.
 * Submits the source video to AWS Transcribe for auto-captioning.
 * Invoked by the transcode-complete Lambda via SNS or direct invocation.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const transcribe = new TranscribeClient({});

const VIDEOS_TABLE = process.env.VIDEOS_TABLE || 'Velox-Videos';
const TRANSCRIPTS_BUCKET = process.env.S3_BUCKET_TRANSCRIPTS || '';

interface TranscribeTriggerEvent {
  videoId: string;
  sourceS3Uri: string;
}

export async function handler(event: TranscribeTriggerEvent): Promise<void> {
  const { videoId, sourceS3Uri } = event;

  console.log(`[TranscribeTrigger] Starting transcription for video ${videoId}`);

  // Update video status to transcribing
  await dynamoDb.send(new UpdateCommand({
    TableName: VIDEOS_TABLE,
    Key: { id: videoId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'transcribing',
      ':now': new Date().toISOString(),
    },
  }));

  const jobName = `velox-${videoId}-${Date.now()}`;

  try {
    await transcribe.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: 'en-US',
      IdentifyLanguage: true,
      Media: {
        MediaFileUri: sourceS3Uri,
      },
      OutputBucketName: TRANSCRIPTS_BUCKET,
      OutputKey: `${videoId}/transcript.json`,
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 10,
      },
      Subtitles: {
        Formats: ['vtt'],
        OutputStartIndex: 1,
      },
    }));

    // Store the job name for later lookup
    await dynamoDb.send(new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { id: videoId },
      UpdateExpression: 'SET transcribeJobName = :jobName',
      ExpressionAttributeValues: { ':jobName': jobName },
    }));

    console.log(`[TranscribeTrigger] Transcription job ${jobName} started`);
  } catch (err) {
    console.error(`[TranscribeTrigger] Failed to start transcription for ${videoId}:`, err);

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
