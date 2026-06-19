import { api } from "./client";

export type FieldSource = "fixed" | "input" | "derived";
export type FieldControl = "text" | "number" | "boolean" | "date" | "select";
export type FieldCatalog = "sport" | "competition" | "tipType";
export type FieldDerivation = "talentOrShowList" | "genericContentType";

export interface SchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  options?: string[];
  helpText?: string;
  source?: FieldSource;
  fixedValue?: string | number | boolean;
  control?: FieldControl;
  catalog?: FieldCatalog;
  exposed?: boolean;
  derived?: FieldDerivation;
}

export interface SchemaResponse {
  schemaId: "current";
  fields: SchemaField[];
  updatedAt: string;
  updatedBy: string;
}

export const fetchSchema = (): Promise<SchemaResponse> => api<SchemaResponse>("/admin/schema");
