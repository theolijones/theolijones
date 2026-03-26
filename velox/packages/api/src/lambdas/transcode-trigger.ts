import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { MediaConvertClient, CreateJobCommand } from '@aws-sdk/client-mediaconvert';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const mediaConvert = new MediaConvertClient({
  endpoint: process.env.MEDIACONVERT_ENDPOINT,
});

const VIDEOS_TABLE = process.env.VIDEOS_TABLE || 'Velox-Videos';
const ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN || '';
const OUTPUT_BUCKET = process.env.S3_BUCKET_VIDEO_OUTPUT || '';
const THUMBNAIL_BUCKET = process.env.S3_BUCKET_THUMBNAILS || '';

interface S3Event {
  Records: Array<{
    s3: {
      bucket: { name: string };
      object: { key: string; size: number };
    };
  }>;
}

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const sourceUri = `s3://${bucket}/${key}`;

    // Extract videoId from key metadata or filename
    // Key format: uploads/<timestamp>-<filename>
    // We need to find the video record by sourceS3Key
    console.log(`[TranscodeTrigger] Processing: ${sourceUri}`);

    try {
      const outputPrefix = `s3://${OUTPUT_BUCKET}/`;
      const thumbnailPrefix = `s3://${THUMBNAIL_BUCKET}/`;

      // We'll use the S3 key to derive an ID prefix for outputs
      const keyParts = key.split('/');
      const filename = keyParts[keyParts.length - 1];
      const videoPrefix = filename.replace(/\.[^.]+$/, '');

      const result = await mediaConvert.send(new CreateJobCommand({
        Role: ROLE_ARN,
        Settings: {
          Inputs: [
            {
              FileInput: sourceUri,
              AudioSelectors: {
                'Audio Selector 1': { DefaultSelection: 'DEFAULT' },
              },
              VideoSelector: {},
              TimecodeSource: 'ZEROBASED',
            },
          ],
          OutputGroups: [
            {
              Name: 'HLS',
              OutputGroupSettings: {
                Type: 'HLS_GROUP_SETTINGS',
                HlsGroupSettings: {
                  Destination: `${outputPrefix}${videoPrefix}/hls/`,
                  SegmentLength: 6,
                  MinSegmentLength: 0,
                },
              },
              Outputs: [
                {
                  ContainerSettings: { Container: 'M3U8' },
                  VideoDescription: {
                    Width: 1920,
                    Height: 1080,
                    CodecSettings: {
                      Codec: 'H_264',
                      H264Settings: {
                        RateControlMode: 'QVBR',
                        MaxBitrate: 6000000,
                        QvbrSettings: { QvbrQualityLevel: 8 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: { Bitrate: 128000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
                      },
                    },
                  ],
                  NameModifier: '_1080p',
                },
                {
                  ContainerSettings: { Container: 'M3U8' },
                  VideoDescription: {
                    Width: 1280,
                    Height: 720,
                    CodecSettings: {
                      Codec: 'H_264',
                      H264Settings: {
                        RateControlMode: 'QVBR',
                        MaxBitrate: 3000000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: { Bitrate: 96000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
                      },
                    },
                  ],
                  NameModifier: '_720p',
                },
                {
                  ContainerSettings: { Container: 'M3U8' },
                  VideoDescription: {
                    Width: 854,
                    Height: 480,
                    CodecSettings: {
                      Codec: 'H_264',
                      H264Settings: {
                        RateControlMode: 'QVBR',
                        MaxBitrate: 1500000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: { Bitrate: 64000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
                      },
                    },
                  ],
                  NameModifier: '_480p',
                },
              ],
            },
            {
              Name: 'Thumbnails',
              OutputGroupSettings: {
                Type: 'FILE_GROUP_SETTINGS',
                FileGroupSettings: {
                  Destination: `${thumbnailPrefix}${videoPrefix}/`,
                },
              },
              Outputs: [
                {
                  ContainerSettings: { Container: 'RAW' },
                  VideoDescription: {
                    Width: 640,
                    Height: 360,
                    CodecSettings: {
                      Codec: 'FRAME_CAPTURE',
                      FrameCaptureSettings: {
                        FramerateNumerator: 1,
                        FramerateDenominator: 5,
                        MaxCaptures: 10,
                        Quality: 80,
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        UserMetadata: {
          sourceS3Key: key,
        },
      }));

      console.log(`[TranscodeTrigger] Job created: ${result.Job?.Id}`);
    } catch (err) {
      console.error(`[TranscodeTrigger] Failed to create job for ${key}:`, err);
      throw err;
    }
  }
}
