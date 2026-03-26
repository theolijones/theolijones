export type LivestreamStatus = 'idle' | 'starting' | 'live' | 'stopping' | 'error';
export type IngestProtocol = 'rtmp' | 'srt';
export type SrtMode = 'listener' | 'caller';
export type StreamResolution = '720p' | '1080p' | '4k';
export type LatencyMode = 'standard' | 'low';

export interface Livestream {
  id: string;
  name: string;
  description: string;
  status: LivestreamStatus;
  resolution: StreamResolution;
  latencyMode: LatencyMode;
  ingestProtocol: IngestProtocol;
  ingestUrl?: string;
  streamKey?: string;
  srtPort?: number;
  srtPassphrase?: string;
  srtLatency?: number;
  srtMode?: SrtMode;
  srtRemoteUrl?: string;
  srtRemotePort?: number;
  mediaLiveChannelId?: string;
  mediaLiveInputId?: string;
  mediaPackageChannelId?: string;
  cloudFrontDistributionId?: string;
  hlsPlaybackUrl?: string;
  dashPlaybackUrl?: string;
  vodRecordingEnabled: boolean;
  scheduledStartAt?: string;
  scheduledStopAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateLivestreamInput {
  name: string;
  description?: string;
  resolution: StreamResolution;
  latencyMode: LatencyMode;
  ingestProtocol: IngestProtocol;
  srtPort?: number;
  srtPassphrase?: string;
  srtMode?: SrtMode;
}

export interface UpdateLivestreamInput {
  name?: string;
  description?: string;
  srtPassphrase?: string;
  srtLatency?: number;
  srtMode?: SrtMode;
  srtRemoteUrl?: string;
  srtRemotePort?: number;
  vodRecordingEnabled?: boolean;
  scheduledStartAt?: string;
  scheduledStopAt?: string;
}
