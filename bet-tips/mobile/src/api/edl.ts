export interface EdlBackground {
  /** S3 key of the background image (typically a `library/...` path). */
  assetKey: string;
  /** "segment" = render-worker masks the person and composites over this background.
   *  "static" = composite the BG behind the unmasked frame (decorative only).
   */
  mode: "segment" | "static";
}

export interface EdlBase {
  width: number;
  height: number;
  durationMs: number;
  layers: EdlLayer[];
  /** Optional chroma-key background processed by the render-worker before
   *  text/image overlays are composited on top. */
  background?: EdlBackground;
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

/** Selectable typefaces. "system"/"system-bold" use the platform/DejaVu font;
 *  the rest are TTFs bundled in both the app and the render-worker image. */
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

export const emptyEdl = (width: number, height: number, durationMs: number): EdlBase => ({
  width,
  height,
  durationMs,
  layers: [],
});
