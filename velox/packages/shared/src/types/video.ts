export type VideoStatus =
  | 'uploading'
  | 'processing'
  | 'transcribing'
  | 'transcribed'
  | 'published'
  | 'scheduled'
  | 'failed'
  | 'archived';

export interface Video {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  status: VideoStatus;
  uploadedAt: string;
  publishedAt?: string;
  duration?: number;
  fileSize?: number;
  resolution?: string;
  folderId?: string;
  thumbnailUrl?: string;
  sourceS3Key: string;
  playbackUrl?: string;
  captionUrl?: string;
  transcriptUrl?: string;
  customMetadata?: Record<string, unknown>;
  createdBy: string;
  updatedAt: string;
}

export interface CreateVideoInput {
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
  folderId?: string;
  sourceS3Key: string;
  customMetadata?: Record<string, unknown>;
}

export interface UpdateVideoInput {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  status?: VideoStatus;
  folderId?: string;
  thumbnailUrl?: string;
  playbackUrl?: string;
  captionUrl?: string;
  transcriptUrl?: string;
  customMetadata?: Record<string, unknown>;
}
