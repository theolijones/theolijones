export interface EdlBase {
  width: number;
  height: number;
  durationMs: number;
  layers: EdlLayer[];
}

export type EdlLayer = EdlTextLayer | EdlImageLayer;

export interface EdlLayerCommon {
  id: string;
  startMs: number;
  endMs: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export interface EdlTextLayer extends EdlLayerCommon {
  type: "text";
  text: string;
  fontSizeRatio: number;
  fontFamily: "system" | "system-bold";
  color: string;
  background?: string;
  align: "left" | "center" | "right";
}

export interface EdlImageLayer extends EdlLayerCommon {
  type: "image";
  assetKey: string;
  widthRatio: number;
}
