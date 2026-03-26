import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const VIDEOS_TABLE = process.env.VIDEOS_TABLE || 'Velox-Videos';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

interface MediaConvertEvent {
  detail: {
    status: 'COMPLETE' | 'ERROR';
    userMetadata: {
      sourceS3Key?: string;
      videoId?: string;
    };
    outputGroupDetails?: Array<{
      outputDetails: Array<{
        outputFilePaths: string[];
        durationInMs?: number;
        videoDetails?: {
          widthInPx: number;
          heightInPx: number;
        };
      }>;
    }>;
    jobId: string;
  };
}

export async function handler(event: MediaConvertEvent): Promise<void> {
  const { status, userMetadata, outputGroupDetails, jobId } = event.detail;
  const sourceS3Key = userMetadata.sourceS3Key;

  console.log(`[TranscodeComplete] Job ${jobId} status: ${status}`);

  if (!sourceS3Key) {
    console.error('[TranscodeComplete] No sourceS3Key in metadata');
    return;
  }

  // Find video by sourceS3Key
  const scanResult = await dynamoDb.send(new ScanCommand({
    TableName: VIDEOS_TABLE,
    FilterExpression: 'sourceS3Key = :key',
    ExpressionAttributeValues: { ':key': sourceS3Key },
    Limit: 1,
  }));

  const video = scanResult.Items?.[0];
  if (!video) {
    console.error(`[TranscodeComplete] No video found for key: ${sourceS3Key}`);
    return;
  }

  const videoId = video.id as string;

  if (status === 'ERROR') {
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

  // Extract HLS output path and duration
  let playbackUrl = '';
  let thumbnailUrl = '';
  let duration: number | undefined;
  let resolution: string | undefined;

  if (outputGroupDetails) {
    for (const group of outputGroupDetails) {
      for (const output of group.outputDetails) {
        const filePath = output.outputFilePaths?.[0] || '';
        if (filePath.includes('/hls/') && filePath.endsWith('.m3u8')) {
          // Convert S3 path to CloudFront URL
          const s3Path = filePath.replace(/^s3:\/\/[^/]+\//, '');
          playbackUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Path}`;
        }
        if (output.durationInMs) {
          duration = Math.round(output.durationInMs / 1000);
        }
        if (output.videoDetails) {
          resolution = `${output.videoDetails.widthInPx}x${output.videoDetails.heightInPx}`;
        }
        // First thumbnail
        if (filePath.includes('/thumb') || (!filePath.includes('/hls/') && filePath.match(/\.(jpg|png)$/))) {
          const s3Path = filePath.replace(/^s3:\/\/[^/]+\//, '');
          thumbnailUrl = `https://${CLOUDFRONT_DOMAIN}/thumbnails/${s3Path}`;
        }
      }
    }
  }

  const updateExpression: string[] = [
    '#status = :status',
    'updatedAt = :now',
  ];
  const expressionNames: Record<string, string> = { '#status': 'status' };
  const expressionValues: Record<string, unknown> = {
    ':status': 'processing', // Will move to 'transcribed' after transcription
    ':now': new Date().toISOString(),
  };

  if (playbackUrl) {
    updateExpression.push('playbackUrl = :playbackUrl');
    expressionValues[':playbackUrl'] = playbackUrl;
  }
  if (thumbnailUrl) {
    updateExpression.push('thumbnailUrl = :thumbnailUrl');
    expressionValues[':thumbnailUrl'] = thumbnailUrl;
  }
  if (duration !== undefined) {
    updateExpression.push('duration = :duration');
    expressionValues[':duration'] = duration;
  }
  if (resolution) {
    updateExpression.push('resolution = :resolution');
    expressionValues[':resolution'] = resolution;
  }

  await dynamoDb.send(new UpdateCommand({
    TableName: VIDEOS_TABLE,
    Key: { id: videoId },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
  }));

  console.log(`[TranscodeComplete] Updated video ${videoId} with playback URL`);
}
