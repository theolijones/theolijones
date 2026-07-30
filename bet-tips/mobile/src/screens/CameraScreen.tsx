import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  useSkiaFrameProcessor,
  VisionCameraProxy,
  type Orientation,
} from "react-native-vision-camera";
import { Skia } from "@shopify/react-native-skia";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BackgroundChoice, RootStackParamList } from "../navigation/types";
import type { ImageAssetContentType, VideoContentType } from "../api/uploads";
import { listLibraryAssets, type LibraryAsset } from "../api/library";
import { CutoutRecorder } from "../native/cutoutRecorder";

// Native iOS plugin that runs Apple Vision's VNGeneratePersonSegmentationRequest
// + Core Image composite each frame, returning a pointer to a CVPixelBuffer.
// See `mobile/plugins/person-cutout/PersonCutoutPlugin.m`.
const segPlugin = VisionCameraProxy.initFrameProcessorPlugin("runPersonCutout", {});

type Nav = NativeStackNavigationProp<RootStackParamList, "Camera">;

const MAX_SECONDS = 60;

const contentTypeFor = (uri: string): VideoContentType => {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
};

const fmt = (s: number): string => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const bgContentTypeFromMime = (mime?: string): ImageAssetContentType => {
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
};

// The UI is locked to portrait (app.json), but VisionCamera's output
// orientation tracks the *physical* device via CMMotionManager, so turning the
// phone silently changes the recorded aspect. Surface it so the talent knows
// which format they're about to shoot.
const isLandscape = (o: Orientation): boolean =>
  o === "landscape-left" || o === "landscape-right";


const CameraScreen = () => {
  const nav = useNavigation<Nav>();
  const { hasPermission: camPerm, requestPermission: requestCam } = useCameraPermission();
  const { hasPermission: micPerm, requestPermission: requestMic } = useMicrophonePermission();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const device = useCameraDevice(facing);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [background, setBackground] = useState<BackgroundChoice | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  // Orientation as it was when recording started. The recorded file's aspect is
  // fixed at that moment, so the chip must stop following the device once the
  // take is underway or it would lie about the output.
  const [lockedOrientation, setLockedOrientation] = useState<Orientation | null>(
    null
  );
  const [bgSheet, setBgSheet] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    assets: LibraryAsset[];
  }>({ open: false, loading: false, error: null, assets: [] });

  const camera = useRef<Camera | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Whether the active recording session is using the cutout pipeline.
  // Captured at startRecording time so finishRecording knows whether to
  // merge or just hand back VC's mp4 directly. Stored in a ref so a
  // mid-recording BG change wouldn't switch behavior — the BG button is
  // disabled during recording so this is belt-and-braces.
  const cutoutSession = useRef<{ active: boolean } | null>(null);

  // Live person-cutout preview pipeline. Native iOS plugin runs Vision
  // segmentation AND the camera/BG composite in Core Image, returning a
  // pointer to a CVPixelBuffer. JS wraps it in a Skia image and draws it
  // once. No per-frame Skia.Image.MakeImage, no saveLayer — that pattern
  // caused iOS jetsam at ~14 sec from GPU texture pool growth.
  const bgUri = background?.previewUri ?? null;
  const cutoutPaint = useMemo(() => Skia.Paint(), []);

  const frameProcessor = useSkiaFrameProcessor(
    (frame) => {
      "worklet";
      if (!bgUri || !segPlugin) {
        frame.render();
        return;
      }
      // Wrap the whole composite path in try/catch — MakeImageFromNativeBuffer
      // THROWS on failure (does not return null). Without this, an unhandled
      // throw leaves the offscreen Skia surface blank and the preview shows
      // black instead of falling back to the raw camera.
      let img: ReturnType<typeof Skia.Image.MakeImageFromNativeBuffer> | null = null;
      try {
        const result = segPlugin.call(frame, { bgUri }) as unknown as
          | { buffer: string; width: number; height: number }
          | null;
        if (!result || !result.buffer) {
          frame.render();
          return;
        }
        // Skia's MakeImageFromNativeBuffer extracts the pointer via
        // jsi::asUint64, which requires a BigInt. VisionCamera marshals
        // NSNumber → jsi::Number (double) which is rejected, so the
        // native side returns the pointer as a string and we convert here.
        img = Skia.Image.MakeImageFromNativeBuffer(BigInt(result.buffer) as unknown as number);
        if (!img) {
          frame.render();
          return;
        }
        frame.drawImageRect(
          img,
          { x: 0, y: 0, width: result.width, height: result.height },
          { x: 0, y: 0, width: frame.width, height: frame.height },
          cutoutPaint
        );
      } catch (e) {
        console.log("[cutout] frame failed:", String(e));
        frame.render();
      } finally {
        if (img) img.dispose();
      }
    },
    [bgUri, cutoutPaint]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const requestAll = async () => {
    await requestCam();
    await requestMic();
  };

  if (camPerm === undefined || micPerm === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#e2e8f0" />
      </SafeAreaView>
    );
  }

  if (!camPerm || !micPerm) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.permTitle}>Camera and microphone access</Text>
          <Text style={styles.permBody}>
            Bet Tips needs access to your camera and microphone to record your betting tip videos.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => void requestAll()}>
            <Text style={styles.primaryBtnText}>Grant access</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.permBody}>No {facing} camera available on this device.</Text>
      </SafeAreaView>
    );
  }

  const startTimer = () => {
    setElapsed(0);
    timer.current = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const navigateToPreview = (uri: string) => {
    nav.navigate("Preview", {
      videoUri: uri,
      videoContentType: contentTypeFor(uri),
      background: background ?? undefined,
    });
  };

  // VisionCamera 4 records the raw camera buffer to disk, bypassing the
  // Skia worklet — so its mp4 has audio + raw camera but no cutout. When
  // a BG is selected we run a parallel native AVAssetWriter
  // (CutoutRecorder) that captures the composited frames the plugin
  // already produces, then splices VisionCamera's audio onto that video
  // post-stop. Without a BG the cutout pipeline is skipped and VC's mp4
  // is used directly.
  const finishWithCutoutMerge = async (vcVideoUri: string) => {
    try {
      const cutout = await CutoutRecorder.stopRecording();
      console.log(
        `[cutout] frames written=${cutout.framesWritten} dropped=${cutout.framesDropped}`,
      );
      const vcPath = vcVideoUri.startsWith("file://")
        ? vcVideoUri.replace(/^file:\/\//, "")
        : vcVideoUri;
      const merged = await CutoutRecorder.mergeAudio(cutout.path, vcPath);
      navigateToPreview(`file://${merged}`);
    } catch (e) {
      // Cutout pipeline failed somewhere — fall back to VC's raw mp4 so
      // the user still has SOMETHING to upload. Server-side render-worker
      // can still apply the BG composite if needed.
      console.warn("[cutout] merge failed, falling back to raw camera:", e);
      navigateToPreview(vcVideoUri);
    }
  };

  const startRecording = async () => {
    if (!camera.current || recording) return;
    const useCutout = background != null && CutoutRecorder.isAvailable;
    if (useCutout) {
      try {
        await CutoutRecorder.startRecording();
      } catch (e) {
        console.warn("[cutout] startRecording failed:", e);
        // Fall through to VC-only recording.
      }
    }
    cutoutSession.current = { active: useCutout };
    setLockedOrientation(orientation);
    setRecording(true);
    startTimer();
    camera.current.startRecording({
      onRecordingFinished: (video) => {
        setRecording(false);
        setLockedOrientation(null);
        stopTimer();
        const uri = video.path.startsWith("file://") ? video.path : `file://${video.path}`;
        if (cutoutSession.current?.active) {
          void finishWithCutoutMerge(uri);
        } else {
          navigateToPreview(uri);
        }
      },
      onRecordingError: (e) => {
        console.warn("recording error", e);
        setRecording(false);
        setLockedOrientation(null);
        stopTimer();
        // Make sure the cutout writer is closed even on VC error so
        // resources don't leak across retries.
        if (cutoutSession.current?.active) {
          CutoutRecorder.stopRecording().catch((stopErr) =>
            console.warn("[cutout] cleanup stop failed:", stopErr),
          );
        }
      },
    });
  };

  const stopRecording = () => {
    if (!camera.current || !recording) return;
    camera.current.stopRecording().catch((e) => console.warn("stopRecording", e));
  };

  const shootingOrientation = lockedOrientation ?? orientation;

  const toggleFacing = () => setFacing((f) => (f === "back" ? "front" : "back"));

  const openBgSheet = async () => {
    setBgSheet({ open: true, loading: true, error: null, assets: [] });
    try {
      const res = await listLibraryAssets();
      const bgs = res.assets.filter((a) => a.kind === "background");
      setBgSheet({ open: true, loading: false, error: null, assets: bgs });
    } catch (e) {
      setBgSheet({ open: true, loading: false, error: (e as Error).message, assets: [] });
    }
  };

  const closeBgSheet = () => setBgSheet((s) => ({ ...s, open: false }));

  const pickBackground = (asset: LibraryAsset | null) => {
    if (asset) {
      setBackground({ assetKey: asset.s3Key, previewUri: asset.downloadUrl, title: asset.title });
    } else {
      setBackground(null);
    }
    closeBgSheet();
  };

  const pickBackgroundFromRoll = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (res.canceled || res.assets.length === 0) return;
    const asset = res.assets[0];
    const fileName = asset.fileName ?? "Camera roll image";
    setBackground({
      assetKey: "",
      previewUri: asset.uri,
      localUri: asset.uri,
      contentType: bgContentTypeFromMime(asset.mimeType ?? undefined),
      title: fileName,
    });
    closeBgSheet();
  };

  return (
    <View style={styles.root}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        video={true}
        audio={true}
        frameProcessor={background ? frameProcessor : undefined}
        pixelFormat="rgb"
        videoHdr={false}
        enableBufferCompression={false}
        onOutputOrientationChanged={setOrientation}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={() => nav.goBack()} disabled={recording} hitSlop={12}>
            <Text style={[styles.link, recording && styles.disabled]}>Cancel</Text>
          </Pressable>
          <View style={styles.topCenter}>
            {recording ? (
              <View style={styles.recordPill}>
                <View style={styles.recordDot} />
                <Text style={styles.recordText}>{fmt(elapsed)}</Text>
              </View>
            ) : (
              <Text style={styles.hint}>Up to {MAX_SECONDS}s</Text>
            )}
            {/* While recording this shows the orientation captured at record
                start, not the live one — rotating mid-take does not change the
                output format (the writer's transform is fixed at setup). */}
            <Text style={styles.formatText}>
              {isLandscape(shootingOrientation)
                ? "Landscape · 16:9"
                : "Portrait · 9:16"}
            </Text>
          </View>
          <Pressable onPress={toggleFacing} disabled={recording} hitSlop={12}>
            <Text style={[styles.link, recording && styles.disabled]}>Flip</Text>
          </Pressable>
        </View>

        <View style={styles.bottomCol}>
          {background && (
            <View style={styles.bgChip}>
              <Image source={{ uri: background.previewUri }} style={styles.bgChipImg} />
              <Text style={styles.bgChipText} numberOfLines={1}>
                BG: {background.title}
              </Text>
              <Pressable hitSlop={8} onPress={() => setBackground(null)}>
                <Text style={styles.bgChipRemove}>×</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={() => void openBgSheet()}
            disabled={recording}
            style={[styles.bgPill, recording && styles.disabled]}
          >
            <Text style={styles.bgPillText}>
              {background ? "Change background" : "+ Background"}
            </Text>
          </Pressable>
          <Pressable
            onPress={recording ? stopRecording : startRecording}
            style={({ pressed }) => [
              styles.shutter,
              recording && styles.shutterRecording,
              pressed && styles.shutterPressed,
            ]}
          >
            <View style={recording ? styles.shutterInnerStop : styles.shutterInnerIdle} />
          </Pressable>
        </View>
      </SafeAreaView>

      <BackgroundSheet
        state={bgSheet}
        onPick={pickBackground}
        onPickFromRoll={() => void pickBackgroundFromRoll()}
        onClose={closeBgSheet}
        current={background}
      />
    </View>
  );
};

interface SheetProps {
  state: {
    open: boolean;
    loading: boolean;
    error: string | null;
    assets: LibraryAsset[];
  };
  current: BackgroundChoice | null;
  onPick: (asset: LibraryAsset | null) => void;
  onPickFromRoll: () => void;
  onClose: () => void;
}

const BackgroundSheet = ({ state, current, onPick, onPickFromRoll, onClose }: SheetProps) => (
  <Modal
    visible={state.open}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}
  >
    <SafeAreaView style={styles.sheetSafe} edges={["top"]}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Pick a background</Text>
        <Pressable onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.sheetTopActions}>
        <Pressable style={styles.rollBtn} onPress={onPickFromRoll}>
          <Text style={styles.rollBtnText}>📷  Choose from camera roll</Text>
        </Pressable>
        {current && (
          <Pressable style={styles.clearBtn} onPress={() => onPick(null)}>
            <Text style={styles.clearBtnText}>Remove background</Text>
          </Pressable>
        )}
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
            No built-in backgrounds yet — pick one from your camera roll above,
            or ask an admin to upload some via the admin panel.
          </Text>
        </View>
      ) : (
        <FlatList
          data={state.assets}
          keyExtractor={(item) => item.assetId}
          numColumns={2}
          contentContainerStyle={styles.sheetList}
          ListHeaderComponent={
            <Text style={styles.sheetSection}>From the library</Text>
          }
          renderItem={({ item }) => {
            const selected = current?.assetKey === item.s3Key;
            return (
              <Pressable
                style={[styles.bgTile, selected && styles.bgTileSelected]}
                onPress={() => onPick(item)}
              >
                <Image source={{ uri: item.downloadUrl }} style={styles.bgImg} resizeMode="cover" />
                <Text style={styles.bgLabel} numberOfLines={1}>
                  {item.title}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  </Modal>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" },
  overlay: { flex: 1, justifyContent: "space-between", paddingHorizontal: 20 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  bottomCol: { alignItems: "center", marginBottom: 24, gap: 12 },
  link: { color: "#f8fafc", fontSize: 16, fontWeight: "500" },
  disabled: { opacity: 0.4 },
  hint: { color: "#cbd5e1", fontSize: 13 },
  topCenter: { alignItems: "center", gap: 4 },
  formatText: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  recordPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginRight: 6,
  },
  recordText: { color: "#f8fafc", fontVariant: ["tabular-nums"], fontSize: 13 },
  bgPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bgPillText: { color: "#f8fafc", fontSize: 13, fontWeight: "500" },
  bgChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: "85%",
  },
  bgChipImg: { width: 28, height: 28, borderRadius: 4 },
  bgChipText: { color: "#f8fafc", fontSize: 12, flexShrink: 1 },
  bgChipRemove: {
    color: "#f8fafc",
    fontSize: 22,
    paddingHorizontal: 6,
    fontWeight: "300",
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  shutterRecording: { borderColor: "#ef4444" },
  shutterPressed: { opacity: 0.85 },
  shutterInnerIdle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ef4444",
  },
  shutterInnerStop: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  center: { padding: 24, alignItems: "center" },
  permTitle: { color: "#e2e8f0", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  permBody: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
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
  sheetTopActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  sheetSection: {
    color: "#94a3b8",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  rollBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  rollBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  clearBtn: {
    backgroundColor: "#7f1d1d",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  clearBtnText: { color: "#fecaca", fontSize: 14, fontWeight: "500" },
  bgTile: {
    flex: 1 / 2,
    aspectRatio: 9 / 16,
    margin: 6,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    overflow: "hidden",
  },
  bgTileSelected: { borderWidth: 2, borderColor: "#3b82f6" },
  bgImg: { width: "100%", height: "100%" },
  bgLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    color: "#e2e8f0",
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: "center",
  },
});

export default CameraScreen;
