import { v4 as uuid } from 'uuid';
import { dynamoDb } from '@velox/aws-clients';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, MAX_FOLDER_DEPTH } from '@velox/shared';
import type { Folder, CreateFolderInput, UpdateFolderInput } from '@velox/shared';
import { AppError } from '../middleware/error-handler';

const TABLE = TABLE_NAMES.FOLDERS;
const VIDEOS_TABLE = TABLE_NAMES.VIDEOS;

export async function listFolders(): Promise<Folder[]> {
  const result = await dynamoDb.send(new ScanCommand({ TableName: TABLE }));
  return (result.Items || []) as Folder[];
}

export async function getFolderChildren(parentId: string): Promise<Folder[]> {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'parentId-index',
    KeyConditionExpression: 'parentId = :parentId',
    ExpressionAttributeValues: { ':parentId': parentId },
  }));
  return (result.Items || []) as Folder[];
}

export async function getFolder(id: string): Promise<Folder> {
  const result = await dynamoDb.send(new GetCommand({
    TableName: TABLE,
    Key: { id },
  }));

  if (!result.Item) {
    throw new AppError(404, 'Folder not found');
  }

  return result.Item as Folder;
}

async function computeFolderPath(parentId?: string): Promise<{ path: string; depth: number }> {
  if (!parentId) {
    return { path: '/', depth: 0 };
  }

  const parent = await getFolder(parentId);
  const depth = parent.depth + 1;

  if (depth >= MAX_FOLDER_DEPTH) {
    throw new AppError(400, `Maximum folder depth of ${MAX_FOLDER_DEPTH} exceeded`);
  }

  return {
    path: `${parent.path}${parent.name}/`,
    depth,
  };
}

async function countVideosInFolder(folderId: string): Promise<number> {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: VIDEOS_TABLE,
    IndexName: 'folderId-index',
    KeyConditionExpression: 'folderId = :folderId',
    ExpressionAttributeValues: { ':folderId': folderId },
    Select: 'COUNT',
  }));
  return result.Count || 0;
}

export async function createFolder(input: CreateFolderInput, userId: string): Promise<Folder> {
  const { path, depth } = await computeFolderPath(input.parentId);
  const now = new Date().toISOString();

  const folder: Folder = {
    id: uuid(),
    name: input.name,
    parentId: input.parentId,
    path,
    depth,
    videoCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  await dynamoDb.send(new PutCommand({
    TableName: TABLE,
    Item: folder,
  }));

  return folder;
}

export async function updateFolder(id: string, input: UpdateFolderInput): Promise<Folder> {
  const existing = await getFolder(id);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.parentId !== undefined) {
    const { path, depth } = await computeFolderPath(input.parentId);
    updates.parentId = input.parentId;
    updates.path = path;
    updates.depth = depth;
  }

  const expressionParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  let i = 0;
  for (const [key, value] of Object.entries(updates)) {
    const attr = `#a${i}`;
    const val = `:v${i}`;
    expressionParts.push(`${attr} = ${val}`);
    names[attr] = key;
    values[val] = value;
    i++;
  }

  const result = await dynamoDb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes as Folder;
}

export async function deleteFolder(id: string): Promise<void> {
  const children = await getFolderChildren(id);
  if (children.length > 0) {
    throw new AppError(400, 'Cannot delete folder with subfolders. Delete children first.');
  }

  const videoCount = await countVideosInFolder(id);
  if (videoCount > 0) {
    throw new AppError(400, 'Cannot delete folder containing videos. Move or delete videos first.');
  }

  await dynamoDb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { id },
  }));
}

export async function buildFolderTree(): Promise<(Folder & { children: Folder[] })[]> {
  const allFolders = await listFolders();

  // Count videos per folder
  const withCounts = await Promise.all(
    allFolders.map(async (f) => ({
      ...f,
      videoCount: await countVideosInFolder(f.id),
      children: [] as Folder[],
    }))
  );

  const map = new Map(withCounts.map((f) => [f.id, f]));
  const roots: typeof withCounts = [];

  for (const folder of withCounts) {
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(folder);
    } else {
      roots.push(folder);
    }
  }

  return roots;
}
