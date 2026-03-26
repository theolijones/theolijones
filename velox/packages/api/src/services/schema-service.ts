import { dynamoDb } from '@velox/aws-clients';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES } from '@velox/shared';
import type { MetadataSchema, CustomFieldDefinition } from '@velox/shared';

const TABLE = TABLE_NAMES.METADATA;
const SCHEMA_ID = 'default';

export async function getSchema(): Promise<MetadataSchema> {
  const result = await dynamoDb.send(new GetCommand({
    TableName: TABLE,
    Key: { id: SCHEMA_ID },
  }));

  if (!result.Item) {
    // Return empty default schema
    return {
      id: SCHEMA_ID,
      fields: [],
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  return result.Item as MetadataSchema;
}

export async function updateSchema(
  fields: CustomFieldDefinition[],
  userId: string
): Promise<MetadataSchema> {
  // Validate field keys are unique
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) {
      throw new Error(`Duplicate field key: ${field.key}`);
    }
    keys.add(field.key);

    // Validate select/multi-select have options
    if ((field.type === 'select' || field.type === 'multi-select') && (!field.options || field.options.length === 0)) {
      throw new Error(`Field "${field.label}" of type ${field.type} must have options`);
    }
  }

  const schema: MetadataSchema = {
    id: SCHEMA_ID,
    fields,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  await dynamoDb.send(new PutCommand({
    TableName: TABLE,
    Item: schema,
  }));

  return schema;
}
