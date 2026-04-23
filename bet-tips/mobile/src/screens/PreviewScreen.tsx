import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResizeMode, Video } from "expo-av";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { submitUpload } from "../api/uploads";

type Nav = NativeStackNavigationProp<RootStackParamList, "Preview">;
type PreviewRoute = RouteProp<RootStackParamList, "Preview">;

const PreviewScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<PreviewRoute>();
  const { videoUri, videoContentType } = route.params;
  const video = useRef<Video | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    setProgress(0);
    try {
      await submitUpload({
        videoUri,
        videoContentType,
        metadata: {},
        onProgress: setProgress,
      });
      nav.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      setErr((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.videoWrap}>
        <Video
          ref={video}
          source={{ uri: videoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay
          isLooping
        />
      </View>

      {submitting ? (
        <View style={styles.progressWrap}>
          <ActivityIndicator color="#e2e8f0" />
          <Text style={styles.progressText}>
            Uploading… {Math.round(progress * 100)}%
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.secondaryBtn]}
            onPress={() => nav.goBack()}
          >
            <Text style={styles.secondaryText}>Retake</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.primaryBtn]} onPress={submit}>
            <Text style={styles.primaryText}>Submit</Text>
          </Pressable>
        </View>
      )}

      {err && <Text style={styles.error}>{err}</Text>}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  videoWrap: { flex: 1, backgroundColor: "#000" },
  actions: { flexDirection: "row", gap: 12, padding: 16 },
  progressWrap: { flexDirection: "row", gap: 12, padding: 24, alignItems: "center", justifyContent: "center" },
  progressText: { color: "#e2e8f0", fontSize: 15 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryBtn: { backgroundColor: "#3b82f6" },
  secondaryBtn: { borderWidth: 1, borderColor: "#334155" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryText: { color: "#e2e8f0", fontSize: 16, fontWeight: "500" },
  error: { color: "#ef4444", textAlign: "center", paddingHorizontal: 16, paddingBottom: 12 },
});

export default PreviewScreen;
