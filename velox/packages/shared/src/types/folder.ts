export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  path: string;
  depth: number;
  videoCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string;
}
