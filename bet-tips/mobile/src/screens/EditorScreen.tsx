import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
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
  EdlImageLayer,
  EdlTextLayer,
} from "../api/edl";
import type { ImageAssetContentType } from "../api/uploads";

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
  fontFamily: "system" | "system-bold";
  fontSizeRatio: number;
}

interface EditorImageLayer extends EditorLayerCommon {
  type: "image";
  localUri: string;
  contentType: ImageAssetContentType;
  widthRatio: number;
  aspect: number;
}

type EditorLayer = EditorTextLayer | EditorImageLayer;

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const newTextLayer = (id: string): EditorTextLayer => ({
  id,
  type: "text",
  text: "",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  color: "#ffffff",
  fontFamily: "system-bold",
  fontSizeRatio: 0.06,
});

const contentTypeFromMime = (mime?: string): ImageAssetContentType => {
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
};

const EditorScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<EditorRoute>();
  const { videoUri, videoContentType } = route.params;
  const video = useRef<Video | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [durationMs, setDurationMs] = useState<number>(0);

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

  const onVideoLoad = (status: { durationMillis?: number } | unknown) => {
    const s = status as { durationMillis?: number };
    if (s.durationMillis) setDurationMs(s.durationMillis);
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
    const end = Math.max(durationMs, 1000);
    const assetRefs: AssetRef[] = layers
      .filter((l): l is EditorImageLayer => l.type === "image")
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
          align: "center",
        };
        return t;
      }
      const img: EdlImageLayer = {
        ...base,
        type: "image",
        assetKey: "",
        widthRatio: l.widthRatio,
      };
      return img;
    }).filter((l): l is EdlTextLayer | EdlImageLayer => l !== null);

    const edl: EdlBase = {
      width: CANVAS_W,
      height: CANVAS_H,
      durationMs: end,
      layers: edlLayers,
    };

    nav.navigate("Metadata", { videoUri, videoContentType, edl, assetRefs });
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.canvas} onLayout={onCanvasLayout}>
          <Video
            ref={video}
            source={{ uri: videoUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
            onLoad={onVideoLoad}
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

        {selected && selected.type === "text" && (
          <View style={styles.editRow}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={selected.text}
              onChangeText={onTextChange}
              placeholder="Type your caption"
              placeholderTextColor="#64748b"
              autoCorrect={false}
              returnKeyType="done"
              blurOnSubmit
            />
            <Pressable style={styles.deleteBtn} onPress={deleteSelected}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
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
          <Pressable style={[styles.toolBtn, styles.primaryBtn]} onPress={() => void addImage()}>
            <Text style={styles.primaryText}>+ Image</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, styles.primaryBtn]} onPress={onNext}>
            <Text style={styles.primaryText}>Next</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
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
      <Animated.View style={[styles.layer, style]}>
        {layer.type === "text" ? (
          <TextLayerContent layer={layer} canvasH={canvasH} selected={selected} />
        ) : (
          <ImageLayerContent layer={layer} canvasW={canvasW} selected={selected} />
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const TextLayerContent = ({
  layer,
  canvasH,
  selected,
}: {
  layer: EditorTextLayer;
  canvasH: number;
  selected: boolean;
}) => {
  const fontSizePx = useMemo(
    () => Math.max(10, layer.fontSizeRatio * canvasH),
    [canvasH, layer.fontSizeRatio]
  );
  const displayText = layer.text.length > 0 ? layer.text : "Tap to type";
  const isPlaceholder = layer.text.length === 0;
  return (
    <Text
      style={[
        styles.layerText,
        {
          fontSize: fontSizePx,
          color: isPlaceholder ? "#cbd5e1" : layer.color,
          fontWeight: layer.fontFamily === "system-bold" ? "800" : "400",
          opacity: isPlaceholder ? 0.8 : 1,
        },
        selected && styles.layerSelected,
      ]}
      numberOfLines={3}
    >
      {displayText}
    </Text>
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
  canvas: { flex: 1, overflow: "hidden", position: "relative" },
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  layerText: {
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginLeft: -140,
    marginTop: -30,
    width: 280,
  },
  layerSelected: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    padding: 4,
    borderRadius: 4,
  },
  editRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 12,
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
  },
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
});

export default EditorScreen;
