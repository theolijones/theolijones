export interface EdlBackground {
  assetKey: string;
  mode: "segment" | "static";
}

export interface EdlBase {
  width: number;
  height: number;
  durationMs: number;
  layers: EdlLayer[];
  background?: EdlBackground;
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

export type EdlFontFamily =
  | "system"
  | "system-bold"
  | "inter"
  | "oswald"
  | "anton"
  | "bebas"
  | "marker";

export interface EdlTextLayer extends EdlLayerCommon {
  type: "text";
  text: string;
  fontSizeRatio: number;
  fontFamily: EdlFontFamily;
  color: string;
  /** Background "box" colour behind the text. Absent ⇒ no background. */
  background?: string;
  /** Outline colour drawn around the glyphs. Absent ⇒ no stroke. */
  strokeColor?: string;
  /** Stroke width as a fraction of the font size (e.g. 0.08). */
  strokeWidthRatio?: number;
  /** Drop-shadow colour. Absent ⇒ no shadow. */
  shadowColor?: string;
  /** Shadow offset (x and y) as a fraction of the font size (e.g. 0.06). */
  shadowOffsetRatio?: number;
  align: "left" | "center" | "right";
}

export interface EdlImageLayer extends EdlLayerCommon {
  type: "image";
  assetKey: string;
  widthRatio: number;
}
