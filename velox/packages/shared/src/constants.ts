export const TABLE_NAMES = {
  VIDEOS: 'Velox-Videos',
  FOLDERS: 'Velox-Folders',
  METADATA: 'Velox-Metadata',
  PLACEMENTS: 'Velox-Placements',
  RULES: 'Velox-Rules',
  SCHEDULES: 'Velox-Schedules',
  LIVESTREAMS: 'Velox-LiveStreams',
  QA_RECORDS: 'Velox-QARecords',
  WATCH_FOLDERS: 'Velox-WatchFolders',
  MODULES: 'Velox-Modules',
} as const;

export const S3_BUCKETS = {
  VIDEO_SOURCE: 'velox-video-source',
  VIDEO_OUTPUT: 'velox-video-output',
  THUMBNAILS: 'velox-thumbnails',
  CAPTIONS: 'velox-captions',
  TRANSCRIPTS: 'velox-transcripts',
} as const;

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mxf', '.mts', '.avi'] as const;

export const MAX_FOLDER_DEPTH = 5;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 25,
  MAX_LIMIT: 100,
} as const;
