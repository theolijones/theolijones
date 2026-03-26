import { v4 as uuid } from 'uuid';
import { dynamoDb } from '@velox/aws-clients';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@velox/shared';
import type { ModuleConfig, CreateModuleInput } from '@velox/shared';
import { AppError } from '../middleware/error-handler';

const TABLE = TABLE_NAMES.MODULES;
const EMBED_BASE_URL = process.env.EMBED_BASE_URL || 'https://embed.velox.io';

export async function listModules(): Promise<ModuleConfig[]> {
  const result = await dynamoDb.send(new ScanCommand({ TableName: TABLE }));
  const modules = (result.Items || []) as ModuleConfig[];
  modules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return modules;
}

export async function getModule(id: string): Promise<ModuleConfig> {
  const result = await dynamoDb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  if (!result.Item) throw new AppError(404, 'Module not found');
  return result.Item as ModuleConfig;
}

export async function createModule(input: CreateModuleInput, userId: string): Promise<ModuleConfig> {
  const id = uuid();
  const now = new Date().toISOString();

  const module: ModuleConfig = {
    id,
    name: input.name,
    type: input.type,
    title: input.title,
    videoIds: input.videoIds,
    videoQuery: input.videoQuery,
    styling: {
      columns: input.styling?.columns ?? (input.type === 'grid' ? 3 : undefined),
      showTitle: input.styling?.showTitle ?? true,
      showDescription: input.styling?.showDescription ?? false,
      showDuration: input.styling?.showDuration ?? true,
      autoPlay: input.styling?.autoPlay ?? false,
      autoAdvance: input.styling?.autoAdvance ?? false,
      theme: input.styling?.theme ?? 'dark',
    },
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  await dynamoDb.send(new PutCommand({ TableName: TABLE, Item: module }));
  return module;
}

export async function updateModule(
  id: string,
  input: Partial<Omit<ModuleConfig, 'id' | 'createdAt' | 'createdBy'>>
): Promise<ModuleConfig> {
  await getModule(id);
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
  if (parts.length === 0) return getModule(id);
  const result = await dynamoDb.send(new UpdateCommand({
    TableName: TABLE, Key: { id },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names, ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes as ModuleConfig;
}

export async function deleteModule(id: string): Promise<void> {
  await dynamoDb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
}

export function getEmbedCode(module: ModuleConfig): {
  html: string;
  iframeUrl: string;
  scriptTag: string;
  config: Record<string, unknown>;
} {
  const iframeUrl = `${EMBED_BASE_URL}/m/${module.id}`;
  const config = {
    moduleId: module.id,
    type: module.type,
    title: module.title,
    styling: module.styling,
  };

  const html = `<!-- Velox Video Module: ${module.name} -->
<div id="velox-module-${module.id}" data-velox-module="${module.id}"></div>
<script src="${EMBED_BASE_URL}/embed.js" async></script>`;

  const scriptTag = `<script>
  window.VeloxEmbed = window.VeloxEmbed || [];
  window.VeloxEmbed.push({
    container: '#velox-module-${module.id}',
    moduleId: '${module.id}',
    type: '${module.type}',
    theme: '${module.styling.theme || 'dark'}',
    autoPlay: ${module.styling.autoPlay || false},
  });
</script>`;

  const iframeHtml = `<iframe
  src="${iframeUrl}"
  width="100%"
  height="${module.type === 'feature-video' ? '480' : module.type === 'carousel' ? '320' : '600'}"
  frameborder="0"
  allowfullscreen
  allow="autoplay; encrypted-media"
  loading="lazy"
></iframe>`;

  return { html: html + '\n' + scriptTag, iframeUrl, scriptTag: iframeHtml, config };
}
