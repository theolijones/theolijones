import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TextStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResizeMode, Video } from "expo-av";
import type { VideoReadyForDisplayEvent } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { listLibraryAssets, type LibraryAsset } from "../api/library";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AssetRef, RootStackParamList } from "../navigation/types";
import type {
  EdlBase,
  EdlFontFamily,
  EdlImageLayer,
  EdlTextLayer,
} from "../api/edl";
import type { ImageAssetContentType } from "../api/uploads";
import {
  COLOR_SWATCHES,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_SHADOW_COLOR,
  DEFAULT_SHADOW_OFFSET_RATIO,
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_WIDTH_RATIO,
  DEFAULT_TEXT_COLOR,
  FONT_OPTIONS,
  fontStyle,
  normalizeHex,
} from "../data/textStyles";

type Nav = NativeStackNavigationProp<RootStackParamList, "Editor">;
type EditorRoute = RouteProp<RootStackParamList, "Editor">;

interface EditorLayerCommon {
  id: string;
  x: number;
  y: number;
  scale: number;
  /** Radians clockwise. Converted to degrees on export. */
  rotation: number;
}

interface EditorTextLayer extends EditorLayerCommon {
  type: "text";
  text: string;
  color: string;
  fontFamily: EdlFontFamily;
  fontSizeRatio: number;
  /** Background box colour. Undefined ⇒ no background. */
  background?: string;
  /** Outline colour. Undefined ⇒ no stroke. */
  strokeColor?: string;
  strokeWidthRatio?: number;
  /** Drop-shadow colour. Undefined ⇒ no shadow. */
  shadowColor?: string;
  shadowOffsetRatio?: number;
}

interface EditorImageLayer extends EditorLayerCommon {
  type: "image";
  localUri: string;
  contentType: ImageAssetContentType;
  widthRatio: number;
  aspect: number;
  /** Set when the layer comes from the admin-managed library; the renderer
   *  reads the asset directly from this S3 key instead of via the per-upload
   *  asset upload flow. */
  libraryAssetKey?: string;
}

type EditorLayer = EditorTextLayer | EditorImageLayer;

// Fallback canvas dimensions, used only until the video reports its real size
// via `onReadyForDisplay`. Portrait 9:16 was the hardcoded value before
// landscape support, so falling back to it keeps portrait behaviour identical
// if the event somehow hasn't fired before the user taps Next.
const DEFAULT_VIDEO_W = 1080;
const DEFAULT_VIDEO_H = 1920;

// h264 + yuv420p (what the render-worker encodes to) rejects odd dimensions,
// and the EDL's width/height go straight into ffmpeg's `scale=W:H`. Camera
// output is always even, so this is insurance rather than a live fix.
const toEven = (n: number): number => Math.max(2, Math.round(n / 2) * 2);

const newTextLayer = (id: string): EditorTextLayer => ({
  id,
  type: "text",
  text: "",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  color: DEFAULT_TEXT_COLOR,
  fontFamily: "system-bold",
  fontSizeRatio: 0.06,
  // A subtle drop shadow on by default — keeps captions legible over video
  // (matches the look prior to per-layer styling).
  shadowColor: DEFAULT_SHADOW_COLOR,
  shadowOffsetRatio: DEFAULT_SHADOW_OFFSET_RATIO,
});

const contentTypeFromMime = (mime?: string): ImageAssetContentType => {
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
};

const libraryContentType = (mime: string): ImageAssetContentType => {
  if (mime === "image/png" || mime === "image/gif") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
};

const EditorScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<EditorRoute>();
  const { videoUri, videoContentType, background } = route.params;
  const video = useRef<Video | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Size of the letterbox area the canvas is centred in.
  const [wrap, setWrap] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // The video's real display dimensions, which become the EDL canvas. Sourced
  // from expo-av's onReadyForDisplay because that applies the asset's
  // preferredTransform before reporting (see EXVideoView.m) — i.e. it gives
  // post-rotation dims. VisionCamera's VideoFile.width/height and
  // CutoutRecorder's writer dims are both *buffer* dims (sensor orientation)
  // and would each need their own ±90° swap; this one handler covers the
  // cutout and non-cutout recording paths identically.
  const [videoSize, setVideoSize] = useState<{ w: number; h: number }>({
    w: DEFAULT_VIDEO_W,
    h: DEFAULT_VIDEO_H,
  });
  const [durationMs, setDurationMs] = useState<number>(0);
  const [stickerSheet, setStickerSheet] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    assets: LibraryAsset[];
  }>({ open: false, loading: false, error: null, assets: [] });

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  // Whenever selection moves to a text layer, give the caption input focus
  // so the user can type immediately.
  useEffect(() => {
    if (selected?.type === "text") {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [selectedId, selected?.type]);

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvas({ w: width, h: height });
  };

  const onWrapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setWrap({ w: width, h: height });
  };

  // Largest box with the video's aspect that fits inside the wrapper, computed
  // explicitly rather than via `aspectRatio` + `maxHeight`: when Yoga clamps a
  // dimension it does not shrink the other to compensate, so the box can end up
  // off-aspect — which would silently break preview/render parity, the whole
  // point of aspect-locking. Falls back to filling the wrapper until measured.
  const canvasBox = useMemo(() => {
    if (wrap.w <= 0 || wrap.h <= 0) return { w: wrap.w, h: wrap.h };
    const aspect = videoSize.w / videoSize.h;
    const w = Math.min(wrap.w, wrap.h * aspect);
    return { w, h: w / aspect };
  }, [wrap.w, wrap.h, videoSize.w, videoSize.h]);

  const onVideoLoad = (status: { durationMillis?: number } | unknown) => {
    const s = status as { durationMillis?: number };
    if (s.durationMillis) setDurationMs(s.durationMillis);
  };

  // `onReadyForDisplay` is the only source of display dimensions — expo-av's
  // playback status does not carry them. It fires from KVO on the player
  // layer's `readyForDisplay`, so in practice it has always landed by the time
  // the talent can see the clip and place an overlay.
  const measuredVideoSize = useRef(false);

  const onVideoReady = (event: VideoReadyForDisplayEvent) => {
    const { width, height } = event.naturalSize;
    if (!width || !height) return;
    measuredVideoSize.current = true;
    setVideoSize({ w: toEven(width), h: toEven(height) });
  };

  const addText = () => {
    const id = `text-${Date.now()}`;
    setLayers((ls) => [...ls, newTextLayer(id)]);
    setSelectedId(id);
  };

  const addImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (res.canceled || res.assets.length === 0) return;
    const asset = res.assets[0];
    const aspect =
      asset.width && asset.height ? asset.width / asset.height : 1;
    const id = `image-${Date.now()}`;
    const layer: EditorImageLayer = {
      id,
      type: "image",
      localUri: asset.uri,
      contentType: contentTypeFromMime(asset.mimeType ?? undefined),
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      widthRatio: 0.4,
      aspect,
    };
    setLayers((ls) => [...ls, layer]);
    setSelectedId(id);
  };

  const openStickerSheet = async () => {
    setStickerSheet({ open: true, loading: true, error: null, assets: [] });
    try {
      const res = await listLibraryAssets();
      // Backgrounds are picked from the camera screen, not from this sheet.
      const overlayAssets = res.assets.filter((a) => a.kind !== "background");
      setStickerSheet({ open: true, loading: false, error: null, assets: overlayAssets });
    } catch (e) {
      setStickerSheet({
        open: true,
        loading: false,
        error: (e as Error).message,
        assets: [],
      });
    }
  };

  const closeStickerSheet = () =>
    setStickerSheet((s) => ({ ...s, open: false }));

  const pickLibraryAsset = (asset: LibraryAsset) => {
    const id = `image-${Date.now()}`;
    const layer: EditorImageLayer = {
      id,
      type: "image",
      localUri: asset.downloadUrl,
      contentType: libraryContentType(asset.contentType),
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      widthRatio: 0.4,
      aspect: 1,
      libraryAssetKey: asset.s3Key,
    };
    setLayers((ls) => [...ls, layer]);
    setSelectedId(id);
    closeStickerSheet();
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setLayers((ls) => ls.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  };

  const updateLayer = (id: string, patch: Partial<EditorLayer>) => {
    setLayers((ls) =>
      ls.map((l) => (l.id === id ? ({ ...l, ...patch } as EditorLayer) : l))
    );
  };

  const onTextChange = (text: string) => {
    if (!selected || selected.type !== "text") return;
    updateLayer(selected.id, { text });
  };

  const onNext = () => {
    if (!measuredVideoSize.current) {
      // Not fatal — the EDL falls back to portrait, which is what shipped
      // before landscape support. Worth a log line because if it ever happens
      // for a landscape clip the render would come out stretched.
      console.warn(
        `[editor] submitting before onReadyForDisplay; EDL canvas falls back to ${DEFAULT_VIDEO_W}x${DEFAULT_VIDEO_H}`
      );
    }
    const end = Math.max(durationMs, 1000);
    // Only device-picked layers need an upload; library layers reference an
    // existing S3 key directly in the EDL.
    const assetRefs: AssetRef[] = layers
      .filter((l): l is EditorImageLayer => l.type === "image" && !l.libraryAssetKey)
      .map((l) => ({ layerId: l.id, localUri: l.localUri, contentType: l.contentType }));

    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const edlLayers = layers.map((l) => {
      const base = {
        id: l.id,
        startMs: 0,
        endMs: end,
        x: l.x,
        y: l.y,
        scale: l.scale,
        rotation: toDeg(l.rotation),
      };
      if (l.type === "text") {
        if (l.text.trim().length === 0) return null;
        const t: EdlTextLayer = {
          ...base,
          type: "text",
          text: l.text,
          fontSizeRatio: l.fontSizeRatio,
          fontFamily: l.fontFamily,
          color: l.color,
          background: l.background,
          strokeColor: l.strokeColor,
          strokeWidthRatio: l.strokeColor ? l.strokeWidthRatio ?? DEFAULT_STROKE_WIDTH_RATIO : undefined,
          shadowColor: l.shadowColor,
          shadowOffsetRatio: l.shadowColor ? l.shadowOffsetRatio ?? DEFAULT_SHADOW_OFFSET_RATIO : undefined,
          align: "center",
        };
        return t;
      }
      const img: EdlImageLayer = {
        ...base,
        type: "image",
        assetKey: l.libraryAssetKey ?? "",
        widthRatio: l.widthRatio,
      };
      return img;
    }).filter((l): l is EdlTextLayer | EdlImageLayer => l !== null);

    const edl: EdlBase = {
      width: videoSize.w,
      height: videoSize.h,
      durationMs: end,
      layers: edlLayers,
      background: background
        ? { assetKey: background.assetKey, mode: "segment" }
        : undefined,
    };

    nav.navigate("Metadata", {
      videoUri,
      videoContentType,
      edl,
      assetRefs,
      background,
    });
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {background && (
          <View style={styles.bgBanner}>
            <Image source={{ uri: background.previewUri }} style={styles.bgBannerImg} />
            <Text style={styles.bgBannerText} numberOfLines={1}>
              Cutout BG: {background.title}
            </Text>
          </View>
        )}
        {/* The canvas is aspect-locked to the video and letterboxed inside
            `canvasWrap`, so on-screen layer positions map exactly onto the
            EDL's fractional coordinates. Previously it was flex:1 with a
            COVER video, which cropped the source and left a small drift
            between preview and render even in portrait. */}
        <View style={styles.canvasWrap} onLayout={onWrapLayout}>
          <View
            style={[styles.canvas, { width: canvasBox.w, height: canvasBox.h }]}
            onLayout={onCanvasLayout}
          >
            <Video
              ref={video}
              source={{ uri: videoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              isMuted
              onLoad={onVideoLoad}
              onReadyForDisplay={onVideoReady}
            />
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setSelectedId(null)}
            />
            {layers.map((l) => (
              <LayerView
                key={l.id}
                layer={l}
                canvasW={canvas.w}
                canvasH={canvas.h}
                selected={l.id === selectedId}
                onSelect={() => setSelectedId(l.id)}
                onCommit={(patch) => updateLayer(l.id, patch)}
              />
            ))}
          </View>
        </View>

        {selected && selected.type === "text" && (
          <TextStylePanel
            layer={selected}
            inputRef={inputRef}
            onTextChange={onTextChange}
            onChange={(patch) => updateLayer(selected.id, patch)}
            onDelete={deleteSelected}
          />
        )}

        {selected && selected.type === "image" && (
          <View style={styles.editRow}>
            <Text style={styles.selectedHint}>Drag · pinch · twist to rotate</Text>
            <Pressable style={styles.deleteBtn} onPress={deleteSelected}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.toolbar}>
          <Pressable style={styles.toolBtn} onPress={() => nav.goBack()}>
            <Text style={styles.toolBtnText}>Back</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, styles.primaryBtn]} onPress={addText}>
            <Text style={styles.primaryText}>+ Text</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, styles.primaryBtn]} onPress={() => void openStickerSheet()}>
            <Text style={styles.primaryText}>+ Sticker</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, styles.primaryBtn]} onPress={() => void addImage()}>
            <Text style={styles.primaryText}>+ Image</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, styles.primaryBtn]} onPress={onNext}>
            <Text style={styles.primaryText}>Next</Text>
          </Pressable>
        </View>

        <StickerSheet
          state={stickerSheet}
          onPick={pickLibraryAsset}
          onClose={closeStickerSheet}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

interface StickerSheetProps {
  state: {
    open: boolean;
    loading: boolean;
    error: string | null;
    assets: LibraryAsset[];
  };
  onPick: (asset: LibraryAsset) => void;
  onClose: () => void;
}

const StickerSheet = ({ state, onPick, onClose }: StickerSheetProps) => (
  <Modal
    visible={state.open}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}
  >
    <SafeAreaView style={styles.sheetSafe} edges={["top"]}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Pick a sticker</Text>
        <Pressable onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>Close</Text>
        </Pressable>
      </View>
      {state.loading ? (
        <View style={styles.sheetCenter}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : state.error ? (
        <View style={styles.sheetCenter}>
          <Text style={styles.sheetError}>{state.error}</Text>
        </View>
      ) : state.assets.length === 0 ? (
        <View style={styles.sheetCenter}>
          <Text style={styles.sheetEmpty}>
            No stickers yet. Ask an admin to add some via the admin panel.
          </Text>
        </View>
      ) : (
        <FlatList
          data={state.assets}
          keyExtractor={(item) => item.assetId}
          numColumns={3}
          contentContainerStyle={styles.sheetList}
          renderItem={({ item }) => (
            <Pressable style={styles.stickerTile} onPress={() => onPick(item)}>
              <Image source={{ uri: item.downloadUrl }} style={styles.stickerImg} resizeMode="contain" />
              <Text style={styles.stickerLabel} numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  </Modal>
);

interface TextStylePanelProps {
  layer: EditorTextLayer;
  inputRef: React.RefObject<TextInput>;
  onTextChange: (text: string) => void;
  onChange: (patch: Partial<EditorTextLayer>) => void;
  onDelete: () => void;
}

const TextStylePanel = ({
  layer,
  inputRef,
  onTextChange,
  onChange,
  onDelete,
}: TextStylePanelProps) => (
  <View style={styles.panel}>
    <View style={styles.editRow}>
      <TextInput
        ref={inputRef}
        style={styles.textInput}
        value={layer.text}
        onChangeText={onTextChange}
        placeholder="Type your caption"
        placeholderTextColor="#64748b"
        autoCorrect={false}
        returnKeyType="done"
        blurOnSubmit
      />
      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
    <ScrollView
      style={styles.panelScroll}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <View style={styles.ctrlRow}>
        <Text style={styles.ctrlLabel}>Font</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
          keyboardShouldPersistTaps="handled"
        >
          {FONT_OPTIONS.map((f) => {
            const on = layer.fontFamily === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => onChange({ fontFamily: f.key })}
                style={[styles.fontPill, on && styles.fontPillOn]}
              >
                <Text
                  style={[styles.fontPillText, fontStyle(f.key), on && styles.fontPillTextOn]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ColorRow
        label="Text colour"
        value={layer.color}
        defaultColor={DEFAULT_TEXT_COLOR}
        onChange={(c) => onChange({ color: c ?? DEFAULT_TEXT_COLOR })}
      />
      <ColorRow
        label="Background"
        optional
        value={layer.background}
        defaultColor={DEFAULT_BACKGROUND_COLOR}
        onChange={(c) => onChange({ background: c })}
      />
      <ColorRow
        label="Stroke"
        optional
        value={layer.strokeColor}
        defaultColor={DEFAULT_STROKE_COLOR}
        onChange={(c) =>
          onChange({
            strokeColor: c,
            strokeWidthRatio: c ? layer.strokeWidthRatio ?? DEFAULT_STROKE_WIDTH_RATIO : undefined,
          })
        }
      />
      <ColorRow
        label="Shadow"
        optional
        value={layer.shadowColor}
        defaultColor={DEFAULT_SHADOW_COLOR}
        onChange={(c) =>
          onChange({
            shadowColor: c,
            shadowOffsetRatio: c ? layer.shadowOffsetRatio ?? DEFAULT_SHADOW_OFFSET_RATIO : undefined,
          })
        }
      />
    </ScrollView>
  </View>
);

interface ColorRowProps {
  label: string;
  value?: string;
  defaultColor: string;
  /** Optional rows can be toggled off entirely (value ⇒ undefined). */
  optional?: boolean;
  onChange: (color: string | undefined) => void;
}

const ColorRow = ({ label, value, defaultColor, optional, onChange }: ColorRowProps) => {
  const [hex, setHex] = useState("");
  const enabled = value !== undefined;
  const submitHex = () => {
    const n = normalizeHex(hex);
    if (n) onChange(n);
    setHex("");
  };
  return (
    <View style={styles.ctrlRow}>
      <View style={styles.ctrlHead}>
        <Text style={styles.ctrlLabel}>{label}</Text>
        {optional && (
          <Pressable
            onPress={() => onChange(enabled ? undefined : defaultColor)}
            style={[styles.togglePill, enabled && styles.togglePillOn]}
          >
            <Text style={[styles.toggleText, enabled && styles.toggleTextOn]}>
              {enabled ? "On" : "Off"}
            </Text>
          </Pressable>
        )}
      </View>
      {(!optional || enabled) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.swatchRow}
          keyboardShouldPersistTaps="handled"
        >
          {COLOR_SWATCHES.map((c) => (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              style={[
                styles.swatch,
                { backgroundColor: c },
                value?.toLowerCase() === c && styles.swatchActive,
              ]}
            />
          ))}
          <TextInput
            style={styles.hexInput}
            value={hex}
            onChangeText={setHex}
            onSubmitEditing={submitHex}
            onBlur={submitHex}
            placeholder="#hex"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </ScrollView>
      )}
    </View>
  );
};

interface LayerViewProps {
  layer: EditorLayer;
  canvasW: number;
  canvasH: number;
  selected: boolean;
  onSelect: () => void;
  onCommit: (patch: Partial<EditorLayer>) => void;
}

const LayerView = ({
  layer,
  canvasW,
  canvasH,
  selected,
  onSelect,
  onCommit,
}: LayerViewProps) => {
  const tx = useSharedValue(layer.x * canvasW);
  const ty = useSharedValue(layer.y * canvasH);
  const scale = useSharedValue(layer.scale);
  const rotation = useSharedValue(layer.rotation);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    })
    .onEnd(() => {
      if (canvasW > 0 && canvasH > 0) {
        runOnJS(onCommit)({
          x: Math.max(0, Math.min(1, tx.value / canvasW)),
          y: Math.max(0, Math.min(1, ty.value / canvasH)),
        });
      }
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.3, Math.min(6, startScale.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(onCommit)({ scale: scale.value });
    });

  const rotate = Gesture.Rotation()
    .onStart(() => {
      startRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = startRotation.value + e.rotation;
    })
    .onEnd(() => {
      runOnJS(onCommit)({ rotation: rotation.value });
    });

  const tap = Gesture.Tap().onStart(() => runOnJS(onSelect)());

  const combined = Gesture.Simultaneous(pan, pinch, rotate, tap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotation.value}rad` },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={combined}>
      <Animated.View
        style={[layer.type === "text" ? styles.textAnchor : styles.layer, style]}
      >
        {layer.type === "text" ? (
          <TextLayerContent
            layer={layer}
            canvasW={canvasW}
            canvasH={canvasH}
            selected={selected}
          />
        ) : (
          <ImageLayerContent layer={layer} canvasW={canvasW} selected={selected} />
        )}
      </Animated.View>
    </GestureDetector>
  );
};

// Eight directions used to fake a glyph outline in the preview by drawing
// offset copies behind the fill text. ffmpeg renders a true `borderw` outline,
// so this is an approximation — close for thin strokes, not pixel-exact.
const STROKE_OFFSETS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const TextLayerContent = ({
  layer,
  canvasW,
  canvasH,
  selected,
}: {
  layer: EditorTextLayer;
  canvasW: number;
  canvasH: number;
  selected: boolean;
}) => {
  const fontSizePx = useMemo(
    () => Math.max(10, layer.fontSizeRatio * canvasH),
    [canvasH, layer.fontSizeRatio]
  );
  const isPlaceholder = layer.text.length === 0;
  const displayText = isPlaceholder ? "Tap to type" : layer.text;
  const fill = isPlaceholder ? "#cbd5e1" : layer.color;
  const strokeW =
    !isPlaceholder && layer.strokeColor
      ? Math.max(1, (layer.strokeWidthRatio ?? DEFAULT_STROKE_WIDTH_RATIO) * fontSizePx)
      : 0;
  const shadowOff =
    !isPlaceholder && layer.shadowColor
      ? (layer.shadowOffsetRatio ?? DEFAULT_SHADOW_OFFSET_RATIO) * fontSizePx
      : 0;
  const maxWidth = Math.max(120, (canvasW || DEFAULT_VIDEO_W) * 0.86);
  // Measured height of the (absolutely-positioned) caption, used to recentre it
  // on the layer's anchor point. The box is taken out of flow so its text
  // measures against its own content rather than the 0×0 anchor (which on the
  // New Architecture collapses an in-flow child to zero height).
  const [boxH, setBoxH] = useState(0);

  const baseText: TextStyle = {
    ...fontStyle(layer.fontFamily),
    fontSize: fontSizePx,
    textAlign: "center",
  };

  return (
    <View
      style={[
        styles.captionBox,
        { position: "absolute", width: maxWidth, left: -maxWidth / 2, top: -boxH / 2 },
      ]}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h && Math.abs(h - boxH) > 0.5) setBoxH(h);
      }}
    >
      <View
        style={[
          layer.background
            ? {
                backgroundColor: layer.background,
                paddingHorizontal: fontSizePx * 0.28,
                paddingVertical: fontSizePx * 0.12,
                borderRadius: fontSizePx * 0.18,
              }
            : null,
          selected && styles.layerSelected,
        ]}
      >
        <View>
        {shadowOff > 0 && (
          <Text
            numberOfLines={3}
            style={[
              baseText,
              styles.copyAbs,
              {
                color: layer.shadowColor,
                transform: [{ translateX: shadowOff }, { translateY: shadowOff }],
              },
            ]}
          >
            {displayText}
          </Text>
        )}
        {strokeW > 0 &&
          STROKE_OFFSETS.map(([ox, oy], i) => (
            <Text
              key={i}
              numberOfLines={3}
              style={[
                baseText,
                styles.copyAbs,
                {
                  color: layer.strokeColor,
                  transform: [{ translateX: ox * strokeW }, { translateY: oy * strokeW }],
                },
              ]}
            >
              {displayText}
            </Text>
          ))}
        <Text
          numberOfLines={3}
          style={[baseText, { color: fill, opacity: isPlaceholder ? 0.8 : 1 }]}
        >
          {displayText}
        </Text>
        </View>
      </View>
    </View>
  );
};

const ImageLayerContent = ({
  layer,
  canvasW,
  selected,
}: {
  layer: EditorImageLayer;
  canvasW: number;
  selected: boolean;
}) => {
  const widthPx = Math.max(40, layer.widthRatio * canvasW);
  const heightPx = widthPx / Math.max(0.1, layer.aspect);
  return (
    <Image
      source={{ uri: layer.localUri }}
      style={[
        {
          width: widthPx,
          height: heightPx,
          marginLeft: -widthPx / 2,
          marginTop: -heightPx / 2,
        },
        selected && styles.layerSelected,
      ]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#000" },
  // Centres the aspect-locked canvas and letterboxes the leftover space.
  canvasWrap: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  canvas: { overflow: "hidden", position: "relative" },
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // Zero-size anchor: a centred child sits exactly on the layer's x/y point,
  // so the caption box can hug its (variable-width) content.
  textAnchor: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  captionBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  copyAbs: {
    ...StyleSheet.absoluteFillObject,
  },
  layerSelected: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    padding: 4,
    borderRadius: 4,
  },
  panel: {
    backgroundColor: "#0f172a",
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
  },
  panelScroll: {
    maxHeight: 210,
  },
  editRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  ctrlRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ctrlHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctrlLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pillRow: {
    gap: 8,
    paddingRight: 12,
    alignItems: "center",
  },
  fontPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
  },
  fontPillOn: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  fontPillText: { color: "#cbd5e1", fontSize: 15 },
  fontPillTextOn: { color: "#fff" },
  swatchRow: {
    gap: 8,
    paddingRight: 12,
    alignItems: "center",
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#475569",
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: "#fff",
  },
  hexInput: {
    minWidth: 78,
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#e2e8f0",
    fontSize: 14,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    marginBottom: 6,
  },
  togglePillOn: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  toggleText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  toggleTextOn: { color: "#fff" },
  selectedHint: { flex: 1, color: "#94a3b8", fontSize: 13 },
  textInput: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e2e8f0",
    fontSize: 15,
  },
  deleteBtn: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    borderRadius: 8,
  },
  deleteText: { color: "#fecaca", fontSize: 14, fontWeight: "600" },
  toolbar: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#0f172a",
    padding: 12,
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
  },
  toolBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  toolBtnText: { color: "#e2e8f0", fontSize: 15, fontWeight: "500" },
  primaryBtn: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  bgBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    borderBottomColor: "#334155",
    borderBottomWidth: 1,
  },
  bgBannerImg: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#0f172a",
  },
  bgBannerText: { color: "#cbd5e1", fontSize: 13, flex: 1 },
  sheetSafe: { flex: 1, backgroundColor: "#0f172a" },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: "#1e293b",
    borderBottomWidth: 1,
  },
  sheetTitle: { color: "#e2e8f0", fontSize: 18, fontWeight: "600" },
  sheetClose: { paddingVertical: 6, paddingHorizontal: 10 },
  sheetCloseText: { color: "#3b82f6", fontSize: 15, fontWeight: "500" },
  sheetCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  sheetError: { color: "#fca5a5", fontSize: 14, textAlign: "center" },
  sheetEmpty: { color: "#94a3b8", fontSize: 14, textAlign: "center" },
  sheetList: { padding: 8 },
  stickerTile: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 6,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerImg: { width: "100%", height: "70%" },
  stickerLabel: {
    color: "#e2e8f0",
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
});

export default EditorScreen;
