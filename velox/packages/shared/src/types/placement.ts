export type ModuleType =
  | 'feature-video'
  | 'carousel'
  | 'video-article'
  | 'playlist'
  | 'live-player'
  | 'grid';

export interface Placement {
  id: string;
  name: string;
  description: string;
  type: ModuleType;
  targetUrl?: string;
  targetIdentifier?: string;
  maxVideos: number;
  tags: string[];
  rules: PlacementRule[];
  manualOrder?: string[];
  createdAt: string;
  updatedAt: string;
}

export type PlacementRuleType =
  | 'folder'
  | 'tag'
  | 'recent'
  | 'manual';

export interface PlacementRule {
  type: PlacementRuleType;
  value: string;
  config?: Record<string, unknown>;
}

export interface CreatePlacementInput {
  name: string;
  description?: string;
  type: ModuleType;
  targetUrl?: string;
  targetIdentifier?: string;
  maxVideos?: number;
  tags?: string[];
}

export interface UpdatePlacementInput {
  name?: string;
  description?: string;
  type?: ModuleType;
  targetUrl?: string;
  targetIdentifier?: string;
  maxVideos?: number;
  tags?: string[];
  rules?: PlacementRule[];
  manualOrder?: string[];
}
