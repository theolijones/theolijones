import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { VideoContentType } from "../api/uploads";

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

const CameraScreen = () => {
  const nav = useNavigation<Nav>();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const camera = useRef<CameraView | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const requestAll = async () => {
    await requestCam();
    await requestMic();
  };

  if (!camPerm || !micPerm) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#e2e8f0" />
      </SafeAreaView>
    );
  }

  if (!camPerm.granted || !micPerm.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.permTitle}>Camera and microphone access</Text>
          <Text style={styles.permBody}>
            Bet Tips needs access to your camera and microphone to record your betting tip videos.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={requestAll}>
            <Text style={styles.primaryBtnText}>Grant access</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const startTimer = () => {
    setElapsed(0);
    timer.current = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) void stopRecording();
        return next;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const startRecording = async () => {
    if (!camera.current || recording) return;
    setRecording(true);
    startTimer();
    try {
      const result = await camera.current.recordAsync({ maxDuration: MAX_SECONDS });
      if (result?.uri) {
        nav.navigate("Preview", {
          videoUri: result.uri,
          videoContentType: contentTypeFor(result.uri),
        });
      }
    } catch (e) {
      console.warn("recordAsync failed", e);
    } finally {
      setRecording(false);
      stopTimer();
    }
  };

  const stopRecording = async () => {
    if (!camera.current || !recording) return;
    camera.current.stopRecording();
  };

  const toggleFacing = () => setFacing((f) => (f === "back" ? "front" : "back"));

  return (
    <View style={styles.root}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        onCameraReady={() => setReady(true)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={() => nav.goBack()} disabled={recording} hitSlop={12}>
            <Text style={[styles.link, recording && styles.disabled]}>Cancel</Text>
          </Pressable>
          {recording ? (
            <View style={styles.recordPill}>
              <View style={styles.recordDot} />
              <Text style={styles.recordText}>{fmt(elapsed)}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>Up to {MAX_SECONDS}s</Text>
          )}
          <Pressable onPress={toggleFacing} disabled={recording} hitSlop={12}>
            <Text style={[styles.link, recording && styles.disabled]}>Flip</Text>
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <Pressable
            onPress={recording ? stopRecording : startRecording}
            disabled={!ready}
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
    </View>
  );
};

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
  bottomRow: { alignItems: "center", marginBottom: 24 },
  link: { color: "#f8fafc", fontSize: 16, fontWeight: "500" },
  disabled: { opacity: 0.4 },
  hint: { color: "#cbd5e1", fontSize: 13 },
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
});

export default CameraScreen;
