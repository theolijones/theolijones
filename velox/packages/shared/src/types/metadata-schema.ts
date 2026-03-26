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

// ── Metadata Templates ──────────────────────────────────────────────

export type MatchRuleType = 'filename_pattern' | 'folder' | 'subfolder' | 'extension';

export interface TemplateMatchRule {
  type: MatchRuleType;
  /** For filename_pattern: glob/regex pattern. For folder/subfolder: folder ID. For extension: e.g. ".mxf" */
  value: string;
  /** Human-readable description */
  label?: string;
}

export interface MetadataTemplate {
  id: string;
  name: string;
  description?: string;
  /** Which fields from the global schema are included in this template */
  fieldKeys: string[];
  /** Default values to pre-fill when this template is applied */
  defaultValues: Record<string, unknown>;
  /** Rules that auto-match videos to this template */
  matchRules: TemplateMatchRule[];
  /** Priority — higher number wins when multiple templates match */
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  fieldKeys: string[];
  defaultValues?: Record<string, unknown>;
  matchRules?: TemplateMatchRule[];
  priority?: number;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  fieldKeys?: string[];
  defaultValues?: Record<string, unknown>;
  matchRules?: TemplateMatchRule[];
  priority?: number;
  enabled?: boolean;
}
