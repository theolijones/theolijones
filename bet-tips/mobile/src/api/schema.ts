import { api } from "./client";

export interface SchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  options?: string[];
  helpText?: string;
}

export interface SchemaResponse {
  schemaId: "current";
  fields: SchemaField[];
  updatedAt: string;
  updatedBy: string;
}

export const fetchSchema = (): Promise<SchemaResponse> => api<SchemaResponse>("/admin/schema");
