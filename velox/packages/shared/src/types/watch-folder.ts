export type WatchFolderStatus = 'active' | 'paused' | 'error';

export interface WatchFolder {
  id: string;
  localPath: string;
  s3Destination: string;
  cmsFolderId?: string;
  defaultMetadata: {
    titlePrefix?: string;
    tags?: string[];
    category?: string;
  };
  status: WatchFolderStatus;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}
