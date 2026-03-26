import { v4 as uuid } from 'uuid';
import { dynamoDb } from '@velox/aws-clients';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@velox/shared';
import type {
  MetadataTemplate, CreateTemplateInput, UpdateTemplateInput, TemplateMatchRule,
} from '@velox/shared';
import { AppError } from '../middleware/error-handler';

// Store templates in the Metadata table with a "template:" prefixed id
const TABLE = TABLE_NAMES.METADATA;

function templateKey(id: string) {
  return `template:${id}`;
}

export async function listTemplates(): Promise<MetadataTemplate[]> {
  const result = await dynamoDb.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'begins_with(id, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'template:' },
  }));

  const templates = (result.Items || []).map(stripPrefix) as MetadataTemplate[];
  templates.sort((a, b) => b.priority - a.priority);
  return templates;
}

export async function getTemplate(id: string): Promise<MetadataTemplate> {
  const result = await dynamoDb.send(new GetCommand({
    TableName: TABLE,
    Key: { id: templateKey(id) },
  }));
  if (!result.Item) throw new AppError(404, 'Template not found');
  return stripPrefix(result.Item) as MetadataTemplate;
}

export async function createTemplate(input: CreateTemplateInput, userId: string): Promise<MetadataTemplate> {
  const id = uuid();
  const now = new Date().toISOString();

  const template: MetadataTemplate = {
    id,
    name: input.name,
    description: input.description,
    fieldKeys: input.fieldKeys,
    defaultValues: input.defaultValues || {},
    matchRules: input.matchRules || [],
    priority: input.priority ?? 0,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  await dynamoDb.send(new PutCommand({
    TableName: TABLE,
    Item: { ...template, id: templateKey(id) },
  }));

  return template;
}

export async function updateTemplate(id: string, input: UpdateTemplateInput): Promise<MetadataTemplate> {
  await getTemplate(id); // ensure exists

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
  if (parts.length === 0) return getTemplate(id);

  const result = await dynamoDb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id: templateKey(id) },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  return stripPrefix(result.Attributes!) as MetadataTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  await dynamoDb.send(new DeleteCommand({ TableName: TABLE, Key: { id: templateKey(id) } }));
}

// ── Template Matching Engine ────────────────────────────────────────

/**
 * Find the best matching template for a given video based on its filename and folder path.
 * Returns the highest-priority enabled template whose rules all match.
 */
export async function matchTemplate(context: {
  fileName: string;
  folderId?: string;
  folderPath?: string;
}): Promise<MetadataTemplate | null> {
  const templates = await listTemplates();
  const enabledTemplates = templates.filter((t) => t.enabled && t.matchRules.length > 0);

  // Templates are already sorted by priority (desc)
  for (const template of enabledTemplates) {
    if (evaluateRules(template.matchRules, context)) {
      return template;
    }
  }

  return null;
}

function evaluateRules(
  rules: TemplateMatchRule[],
  context: { fileName: string; folderId?: string; folderPath?: string }
): boolean {
  // ALL rules must match (AND logic)
  return rules.every((rule) => evaluateRule(rule, context));
}

function evaluateRule(
  rule: TemplateMatchRule,
  context: { fileName: string; folderId?: string; folderPath?: string }
): boolean {
  switch (rule.type) {
    case 'filename_pattern': {
      // Support simple glob patterns: * matches anything, ? matches single char
      const pattern = rule.value
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${pattern}$`, 'i');
      return regex.test(context.fileName);
    }

    case 'folder': {
      // Exact folder ID match
      return context.folderId === rule.value;
    }

    case 'subfolder': {
      // Folder path starts with the specified folder (matches subfolders)
      if (!context.folderPath) return context.folderId === rule.value;
      return context.folderPath.startsWith(rule.value) || context.folderId === rule.value;
    }

    case 'extension': {
      const ext = rule.value.startsWith('.') ? rule.value.toLowerCase() : `.${rule.value.toLowerCase()}`;
      return context.fileName.toLowerCase().endsWith(ext);
    }

    default:
      return false;
  }
}

/** Strip the "template:" prefix from the DynamoDB id */
function stripPrefix(item: Record<string, unknown>): Record<string, unknown> {
  if (typeof item.id === 'string' && item.id.startsWith('template:')) {
    return { ...item, id: item.id.slice('template:'.length) };
  }
  return item;
}
