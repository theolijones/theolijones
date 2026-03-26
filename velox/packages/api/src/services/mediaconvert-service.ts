import { createTranscodeJob } from '@velox/aws-clients';

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN || '';
const OUTPUT_BUCKET = process.env.S3_BUCKET_VIDEO_OUTPUT || 'velox-video-output';
const THUMBNAIL_BUCKET = process.env.S3_BUCKET_THUMBNAILS || 'velox-thumbnails';

export async function submitTranscodeJob(params: {
  videoId: string;
  sourceS3Uri: string;
}): Promise<string> {
  const outputPrefix = `s3://${OUTPUT_BUCKET}/${params.videoId}/`;
  const thumbnailPrefix = `s3://${THUMBNAIL_BUCKET}/${params.videoId}/`;

  const result = await createTranscodeJob({
    Role: ROLE_ARN,
    Settings: {
      Inputs: [
        {
          FileInput: params.sourceS3Uri,
          AudioSelectors: {
            'Audio Selector 1': { DefaultSelection: 'DEFAULT' },
          },
          VideoSelector: {},
          TimecodeSource: 'ZEROBASED',
        },
      ],
      OutputGroups: [
        // HLS Adaptive Bitrate Output
        {
          Name: 'HLS',
          OutputGroupSettings: {
            Type: 'HLS_GROUP_SETTINGS',
            HlsGroupSettings: {
              Destination: outputPrefix + 'hls/',
              SegmentLength: 6,
              MinSegmentLength: 0,
            },
          },
          Outputs: [
            // 1080p
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
            // 720p
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
            // 480p
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
        // Thumbnail output
        {
          Name: 'Thumbnails',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: thumbnailPrefix,
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
      videoId: params.videoId,
    },
  });

  return result.Job?.Id || '';
}
