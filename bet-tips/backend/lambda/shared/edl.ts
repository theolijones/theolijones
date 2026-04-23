export interface EdlBase {
  /** Canvas dimensions the EDL was authored against (typically the video's native dims). */
  width: number;
  height: number;
  /** Video duration in ms. */
  durationMs: number;
  layers: EdlLayer[];
}

export type EdlLayer = EdlTextLayer | EdlImageLayer;

export interface EdlLayerCommon {
  id: string;
  /** Start and end times in ms relative to the start of the video. */
  startMs: number;
  endMs: number;
  /** Center position as fraction of canvas (0..1). */
  x: number;
  y: number;
  /** Rotation in degrees clockwise. */
  rotation: number;
  /** Uniform scale multiplier on top of sizing. */
  scale: number;
}

export interface EdlTextLayer extends EdlLayerCommon {
  type: "text";
  text: string;
  /** Font size as fraction of canvas height at scale=1. */
  fontSizeRatio: number;
  fontFamily: "system" | "system-bold";
  /** CSS-style hex colour. */
  color: string;
  background?: string;
  align: "left" | "center" | "right";
}

export interface EdlImageLayer extends EdlLayerCommon {
  type: "image";
  /** S3 key where the source image was uploaded via POST /uploads/{id}/assets. */
  assetKey: string;
  /** Width as fraction of canvas width at scale=1. */
  widthRatio: number;
}

export const isValidEdl = (e: unknown): e is EdlBase => {
  if (!e || typeof e !== "object") return false;
  const v = e as Partial<EdlBase>;
  return (
    typeof v.width === "number" &&
    typeof v.height === "number" &&
    typeof v.durationMs === "number" &&
    Array.isArray(v.layers)
  );
};

export const edlHasLayers = (e: EdlBase | undefined): boolean =>
  !!e && Array.isArray(e.layers) && e.layers.length > 0;
