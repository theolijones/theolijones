import { ModuleType } from './placement';

export interface ModuleConfig {
  id: string;
  name: string;
  type: ModuleType;
  title?: string;
  videoIds?: string[];
  videoQuery?: {
    folderId?: string;
    tags?: string[];
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  styling: {
    columns?: number;
    showTitle?: boolean;
    showDescription?: boolean;
    showDuration?: boolean;
    autoPlay?: boolean;
    autoAdvance?: boolean;
    theme?: 'dark' | 'light';
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateModuleInput {
  name: string;
  type: ModuleType;
  title?: string;
  videoIds?: string[];
  videoQuery?: ModuleConfig['videoQuery'];
  styling?: Partial<ModuleConfig['styling']>;
}
