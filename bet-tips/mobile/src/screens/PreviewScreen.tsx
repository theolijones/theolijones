import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResizeMode, Video } from "expo-av";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Preview">;
type PreviewRoute = RouteProp<RootStackParamList, "Preview">;

const PreviewScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<PreviewRoute>();
  const { videoUri, videoContentType } = route.params;
  const video = useRef<Video | null>(null);

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

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.secondaryBtn]}
          onPress={() => nav.goBack()}
        >
          <Text style={styles.secondaryText}>Retake</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.primaryBtn]}
          onPress={() => nav.navigate("Editor", { videoUri, videoContentType })}
        >
          <Text style={styles.primaryText}>Next</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  videoWrap: { flex: 1, backgroundColor: "#000" },
  actions: { flexDirection: "row", gap: 12, padding: 16 },
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
});

export default PreviewScreen;
