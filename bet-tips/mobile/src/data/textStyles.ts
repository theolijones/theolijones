// Caption typeface + colour catalog for the editor. The TTFs here are the
// SAME files bundled into the render-worker image, so the on-device preview
// matches the rendered video. Keep this in sync with fontFileFor() in
// backend/render-worker/src/index.ts and EdlFontFamily in api/edl.ts.

import type { TextStyle } from "react-native";
import type { EdlFontFamily } from "../api/edl";

export interface FontOption {
  key: EdlFontFamily;
  label: string;
  /** Bundled TTF require() handle, or null for the platform/system font. */
  asset: number | null;
  /** Family name to register with expo-font and reference in styles. */
  rnFamily?: string;
  /** Weight applied for the system options (which have no rnFamily). */
  weight?: TextStyle["fontWeight"];
}

export const FONT_OPTIONS: FontOption[] = [
  { key: "system", label: "System", asset: null, weight: "400" },
  { key: "system-bold", label: "Bold", asset: null, weight: "800" },
  { key: "inter", label: "Inter", asset: require("../../assets/fonts/Inter.ttf"), rnFamily: "Inter" },
  { key: "oswald", label: "Oswald", asset: require("../../assets/fonts/Oswald.ttf"), rnFamily: "Oswald" },
  { key: "anton", label: "Anton", asset: require("../../assets/fonts/Anton.ttf"), rnFamily: "Anton" },
  { key: "bebas", label: "Bebas", asset: require("../../assets/fonts/BebasNeue.ttf"), rnFamily: "BebasNeue" },
  { key: "marker", label: "Marker", asset: require("../../assets/fonts/PermanentMarker.ttf"), rnFamily: "PermanentMarker" },
];

/** Map passed to expo-font's useFonts — registers every bundled TTF. */
export const FONT_ASSETS: Record<string, number> = Object.fromEntries(
  FONT_OPTIONS.filter((f) => f.asset != null).map((f) => [f.rnFamily as string, f.asset as number])
);

export const fontOption = (key: EdlFontFamily): FontOption =>
  FONT_OPTIONS.find((f) => f.key === key) ?? FONT_OPTIONS[0];

/** RN text-style fragment selecting the right family/weight for a font key. */
export const fontStyle = (key: EdlFontFamily): Pick<TextStyle, "fontFamily" | "fontWeight"> => {
  const o = fontOption(key);
  return o.rnFamily ? { fontFamily: o.rnFamily } : { fontWeight: o.weight ?? "400" };
};

// Preset palette shared by the text-colour, background, stroke and shadow
// pickers. All hex so they're valid for both RN and ffmpeg's drawtext.
export const COLOR_SWATCHES: string[] = [
  "#ffffff", "#000000", "#e11d48", "#f97316", "#facc15",
  "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899",
];

export const DEFAULT_TEXT_COLOR = "#ffffff";
export const DEFAULT_BACKGROUND_COLOR = "#000000";
export const DEFAULT_STROKE_COLOR = "#000000";
export const DEFAULT_STROKE_WIDTH_RATIO = 0.08;
export const DEFAULT_SHADOW_COLOR = "#000000b3"; // ~70% black, valid 8-digit hex
export const DEFAULT_SHADOW_OFFSET_RATIO = 0.06;

/** Normalise a user-typed hex string to "#rrggbb"/"#rgb"/"#rrggbbaa" or null. */
export const normalizeHex = (raw: string): string | null => {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  if (!s.startsWith("#")) s = `#${s}`;
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s) ? s : null;
};
