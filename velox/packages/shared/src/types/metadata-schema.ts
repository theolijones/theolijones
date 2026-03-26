export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'url';

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  sendToGA: boolean;
  defaultValue?: unknown;
}

export interface MetadataSchema {
  id: string;
  fields: CustomFieldDefinition[];
  updatedAt: string;
  updatedBy: string;
}
