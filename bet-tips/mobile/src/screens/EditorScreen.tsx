import { useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResizeMode, Video } from "expo-av";
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
import type { RootStackParamList } from "../navigation/types";
import type { EdlBase, EdlTextLayer } from "../api/edl";

type Nav = NativeStackNavigationProp<RootStackParamList, "Editor">;
type EditorRoute = RouteProp<RootStackParamList, "Editor">;

interface EditorTextLayer {
  id: string;
  text: string;
  // Normalized fraction of canvas (0..1)
  x: number;
  y: number;
  scale: number;
  color: string;
  fontFamily: "system" | "system-bold";
  // Base font size in normalized canvas height (before scale multiplier)
  fontSizeRatio: number;
}

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const DEFAULT_TEXT_LAYER = (id: string): EditorTextLayer => ({
  id,
  text: "Double tap to edit",
  x: 0.5,
  y: 0.5,
  scale: 1,
  color: "#ffffff",
  fontFamily: "system-bold",
  fontSizeRatio: 0.06,
});

const EditorScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<EditorRoute>();
  const { videoUri, videoContentType } = route.params;
  const video = useRef<Video | null>(null);
  const [layers, setLayers] = useState<EditorTextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [durationMs, setDurationMs] = useState<number>(0);
  const [editingText, setEditingText] = useState<string>("");

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
    setLayers((ls) => [...ls, DEFAULT_TEXT_LAYER(id)]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setLayers((ls) => ls.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  };

  const updateLayer = (id: string, patch: Partial<EditorTextLayer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  const commitTextEdit = () => {
    if (!selectedId) return;
    const trimmed = editingText.trim();
    if (trimmed.length > 0) updateLayer(selectedId, { text: trimmed });
    setEditingText("");
  };

  const onNext = () => {
    const edl: EdlBase = {
      width: CANVAS_W,
      height: CANVAS_H,
      durationMs: Math.max(durationMs, 1000),
      layers: layers.map<EdlTextLayer>((l) => ({
        type: "text",
        id: l.id,
        startMs: 0,
        endMs: Math.max(durationMs, 1000),
        x: l.x,
        y: l.y,
        scale: l.scale,
        rotation: 0,
        text: l.text,
        fontSizeRatio: l.fontSizeRatio,
        fontFamily: l.fontFamily,
        color: l.color,
        align: "center",
      })),
    };
    nav.navigate("Metadata", { videoUri, videoContentType, edl });
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
              onSelect={() => {
                setSelectedId(l.id);
                setEditingText(l.text);
              }}
              onCommit={(patch) => updateLayer(l.id, patch)}
            />
          ))}
        </View>

        {selected && (
          <View style={styles.editRow}>
            <TextInput
              style={styles.textInput}
              value={editingText}
              onChangeText={setEditingText}
              placeholder="Type your caption"
              placeholderTextColor="#64748b"
              autoCorrect={false}
              onEndEditing={commitTextEdit}
              onSubmitEditing={commitTextEdit}
              returnKeyType="done"
            />
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
          <Pressable style={[styles.toolBtn, styles.primaryBtn]} onPress={onNext}>
            <Text style={styles.primaryText}>Next</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

interface LayerViewProps {
  layer: EditorTextLayer;
  canvasW: number;
  canvasH: number;
  selected: boolean;
  onSelect: () => void;
  onCommit: (patch: Partial<EditorTextLayer>) => void;
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
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startScale = useSharedValue(1);

  const fontSizePx = useMemo(
    () => Math.max(10, layer.fontSizeRatio * canvasH),
    [canvasH, layer.fontSizeRatio]
  );

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

  const tap = Gesture.Tap().onStart(() => runOnJS(onSelect)());

  const combined = Gesture.Simultaneous(pan, pinch, tap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={combined}>
      <Animated.View style={[styles.layer, style]}>
        <Text
          style={[
            styles.layerText,
            {
              fontSize: fontSizePx,
              color: layer.color,
              fontWeight: layer.fontFamily === "system-bold" ? "800" : "400",
            },
            selected && styles.layerSelected,
          ]}
          numberOfLines={3}
        >
          {layer.text}
        </Text>
      </Animated.View>
    </GestureDetector>
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
    marginLeft: -100,
    marginTop: -30,
    width: 200,
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
    backgroundColor: "#0f172a",
    padding: 12,
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
  },
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
