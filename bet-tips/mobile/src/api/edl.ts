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
  /** Center position as fraction of canvas (0..1). */
  x: number;
  y: number;
  /** Rotation in degrees clockwise. Reserved for future renderer support. */
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

export const emptyEdl = (width: number, height: number, durationMs: number): EdlBase => ({
  width,
  height,
  durationMs,
  layers: [],
});
