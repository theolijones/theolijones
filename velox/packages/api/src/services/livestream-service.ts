import { v4 as uuid } from 'uuid';
import { dynamoDb } from '@velox/aws-clients';
import {
  createChannel, createInput, describeChannel, startChannel, stopChannel,
  deleteChannel, deleteInput,
} from '@velox/aws-clients';
import {
  createPackageChannel, createOriginEndpoint, listOriginEndpoints,
  deletePackageChannel, deleteOriginEndpoint,
} from '@velox/aws-clients';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@velox/shared';
import type { Livestream, CreateLivestreamInput, UpdateLivestreamInput } from '@velox/shared';
import { AppError } from '../middleware/error-handler';

const TABLE = TABLE_NAMES.LIVESTREAMS;

export async function listLivestreams(): Promise<Livestream[]> {
  const result = await dynamoDb.send(new ScanCommand({ TableName: TABLE }));
  return (result.Items || []) as Livestream[];
}

export async function getLivestream(id: string): Promise<Livestream> {
  const result = await dynamoDb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!result.Item) throw new AppError(404, 'Livestream not found');
  return result.Item as Livestream;
}

export async function createLivestream(input: CreateLivestreamInput, userId: string): Promise<Livestream> {
  const id = uuid();
  const now = new Date().toISOString();

  // 1. Create MediaLive Input
  const inputType = input.ingestProtocol === 'srt' ? 'SRT_CALLER' : 'RTMP_PUSH';
  const inputResult = await createInput({
    Name: `velox-${id}`,
    Type: inputType,
    ...(input.ingestProtocol === 'srt' ? {
      Sources: [{
        Url: `srt://0.0.0.0:${input.srtPort || 9998}`,
      }],
    } : {}),
  });
  const mediaLiveInputId = inputResult.Input?.Id || '';

  // Extract ingest details
  let ingestUrl = '';
  let streamKey = '';
  let srtPort = input.srtPort;

  if (input.ingestProtocol === 'rtmp') {
    const dest = inputResult.Input?.Destinations?.[0];
    ingestUrl = dest?.Url || '';
    // Stream key is typically appended to the RTMP URL
    streamKey = `velox-${id}`;
  } else {
    ingestUrl = inputResult.Input?.Sources?.[0]?.Url || `srt://endpoint:${srtPort || 9998}`;
  }

  // 2. Create MediaLive Channel
  const encodingProfile = getEncodingProfile(input.resolution);
  const channelResult = await createChannel({
    Name: `velox-${id}`,
    InputAttachments: [{
      InputId: mediaLiveInputId,
      InputAttachmentName: 'primary',
    }],
    EncoderSettings: encodingProfile,
    ChannelClass: 'SINGLE_PIPELINE',
    Destinations: [{
      Id: 'mediapackage',
      MediaPackageSettings: [{
        ChannelId: `velox-pkg-${id}`,
      }],
    }],
  });
  const mediaLiveChannelId = channelResult.Channel?.Id || '';

  // 3. Create MediaPackage Channel + Endpoints
  const pkgResult = await createPackageChannel({
    Id: `velox-pkg-${id}`,
    Description: `Velox livestream ${input.name}`,
  });
  const mediaPackageChannelId = pkgResult.Id || '';

  // HLS endpoint
  const hlsEndpoint = await createOriginEndpoint({
    ChannelId: mediaPackageChannelId,
    Id: `velox-hls-${id}`,
    ManifestName: 'index',
    HlsPackage: {
      SegmentDurationSeconds: 6,
      PlaylistWindowSeconds: 60,
    },
  });

  // DASH endpoint
  const dashEndpoint = await createOriginEndpoint({
    ChannelId: mediaPackageChannelId,
    Id: `velox-dash-${id}`,
    ManifestName: 'index',
    DashPackage: {
      SegmentDurationSeconds: 6,
      ManifestWindowSeconds: 60,
    },
  });

  const livestream: Livestream = {
    id,
    name: input.name,
    description: input.description || '',
    status: 'idle',
    resolution: input.resolution,
    latencyMode: input.latencyMode,
    ingestProtocol: input.ingestProtocol,
    ingestUrl,
    streamKey: input.ingestProtocol === 'rtmp' ? streamKey : undefined,
    srtPort: input.ingestProtocol === 'srt' ? (srtPort || 9998) : undefined,
    srtPassphrase: input.srtPassphrase,
    srtLatency: input.ingestProtocol === 'srt' ? 200 : undefined,
    srtMode: input.srtMode || 'listener',
    mediaLiveChannelId,
    mediaLiveInputId,
    mediaPackageChannelId,
    hlsPlaybackUrl: hlsEndpoint.Url || '',
    dashPlaybackUrl: dashEndpoint.Url || '',
    vodRecordingEnabled: false,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  await dynamoDb.send(new PutCommand({ TableName: TABLE, Item: livestream }));
  return livestream;
}

export async function updateLivestream(id: string, input: UpdateLivestreamInput): Promise<Livestream> {
  await getLivestream(id);
  const updates: Record<string, unknown> = { ...input, updatedAt: new Date().toISOString() };
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
  if (parts.length === 0) return getLivestream(id);
  const result = await dynamoDb.send(new UpdateCommand({
    TableName: TABLE, Key: { id },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes as Livestream;
}

export async function deleteLivestream(id: string): Promise<void> {
  const stream = await getLivestream(id);
  if (stream.status === 'live') throw new AppError(400, 'Cannot delete a live stream. Stop it first.');

  // Clean up AWS resources
  if (stream.mediaLiveChannelId) {
    try { await deleteChannel(stream.mediaLiveChannelId); } catch { /* ignore */ }
  }
  if (stream.mediaLiveInputId) {
    try { await deleteInput(stream.mediaLiveInputId); } catch { /* ignore */ }
  }
  if (stream.mediaPackageChannelId) {
    try {
      const endpoints = await listOriginEndpoints(stream.mediaPackageChannelId);
      for (const ep of endpoints.OriginEndpoints || []) {
        if (ep.Id) await deleteOriginEndpoint(ep.Id);
      }
      await deletePackageChannel(stream.mediaPackageChannelId);
    } catch { /* ignore */ }
  }

  await dynamoDb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
}

export async function startLivestream(id: string): Promise<Livestream> {
  const stream = await getLivestream(id);
  if (stream.status === 'live') throw new AppError(400, 'Stream is already live');
  if (!stream.mediaLiveChannelId) throw new AppError(400, 'No MediaLive channel');

  await startChannel(stream.mediaLiveChannelId);
  return updateLivestream(id, { name: stream.name } as UpdateLivestreamInput);
}

export async function stopLivestream(id: string): Promise<Livestream> {
  const stream = await getLivestream(id);
  if (!stream.mediaLiveChannelId) throw new AppError(400, 'No MediaLive channel');

  await stopChannel(stream.mediaLiveChannelId);
  return updateLivestream(id, { name: stream.name } as UpdateLivestreamInput);
}

export async function getStreamStatus(id: string): Promise<{ status: string; health?: unknown }> {
  const stream = await getLivestream(id);
  if (!stream.mediaLiveChannelId) return { status: stream.status };

  try {
    const channel = await describeChannel(stream.mediaLiveChannelId);
    const channelState = channel.State || 'IDLE';
    const statusMap: Record<string, string> = {
      IDLE: 'idle', CREATING: 'starting', RUNNING: 'live',
      STOPPING: 'stopping', DELETING: 'idle',
    };
    const newStatus = statusMap[channelState] || 'idle';

    if (newStatus !== stream.status) {
      await dynamoDb.send(new UpdateCommand({
        TableName: TABLE, Key: { id },
        UpdateExpression: 'SET #status = :status, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': newStatus, ':now': new Date().toISOString() },
      }));
    }

    return { status: newStatus };
  } catch {
    return { status: stream.status };
  }
}

export async function getOutputs(id: string): Promise<{ hls?: string; dash?: string }> {
  const stream = await getLivestream(id);
  return { hls: stream.hlsPlaybackUrl, dash: stream.dashPlaybackUrl };
}

function getEncodingProfile(resolution: string) {
  // Simplified encoding settings — in production this would be much more detailed
  const width = resolution === '4k' ? 3840 : resolution === '1080p' ? 1920 : 1280;
  const height = resolution === '4k' ? 2160 : resolution === '1080p' ? 1080 : 720;
  const bitrate = resolution === '4k' ? 15000000 : resolution === '1080p' ? 5000000 : 3000000;

  return {
    AudioDescriptions: [{
      Name: 'audio_1',
      CodecSettings: {
        AacSettings: { Bitrate: 128000, SampleRate: 48000 },
      },
    }],
    VideoDescriptions: [{
      Name: 'video_1',
      Width: width,
      Height: height,
      CodecSettings: {
        H264Settings: {
          Bitrate: bitrate,
          RateControlMode: 'CBR',
          GopSize: 2,
          GopSizeUnits: 'SECONDS',
        },
      },
    }],
    OutputGroups: [{
      Name: 'mediapackage',
      OutputGroupSettings: {
        MediaPackageGroupSettings: {
          Destination: { DestinationRefId: 'mediapackage' },
        },
      },
      Outputs: [{
        OutputName: 'output_1',
        VideoDescriptionName: 'video_1',
        AudioDescriptionNames: ['audio_1'],
        OutputSettings: { MediaPackageOutputSettings: {} },
      }],
    }],
    TimecodeConfig: { Source: 'SYSTEMCLOCK' },
  };
}
