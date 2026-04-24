import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { listMyUploads, type MyUpload } from "../api/uploads";

type Nav = NativeStackNavigationProp<RootStackParamList, "MyUploads">;

const statusLabel: Record<MyUpload["status"], string> = {
  pending: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

const statusColor: Record<MyUpload["status"], string> = {
  pending: "#78350f",
  approved: "#14532d",
  rejected: "#7f1d1d",
};

const MyUploadsScreen = () => {
  const nav = useNavigation<Nav>();
  const [uploads, setUploads] = useState<MyUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listMyUploads();
      setUploads(res.uploads);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>My tips</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#e2e8f0" />
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Text style={styles.error}>{err}</Text>
        </View>
      ) : uploads.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No submissions yet.</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => nav.navigate("Camera")}
          >
            <Text style={styles.primaryText}>Record your first tip</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={uploads}
          keyExtractor={(u) => u.uploadId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e2e8f0" />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
                <View
                  style={[styles.badge, { backgroundColor: statusColor[item.status] }]}
                >
                  <Text style={styles.badgeText}>{statusLabel[item.status]}</Text>
                </View>
              </View>

              {item.renderStatus === "rendering" || item.renderStatus === "queued" ? (
                <Text style={styles.muted}>Rendering your overlays…</Text>
              ) : null}

              {item.status === "rejected" && item.reviewNote && (
                <Text style={styles.rejectNote}>
                  <Text style={styles.rejectLabel}>Why:</Text> {item.reviewNote}
                </Text>
              )}

              {item.renderStatus === "failed" && (
                <Text style={styles.rejectNote}>
                  Render failed. Record another clip to try again.
                </Text>
              )}
            </View>
          )}
        />
      )}

      {!loading && (
        <View style={styles.footer}>
          <Pressable style={styles.primaryBtn} onPress={() => nav.navigate("Camera")}>
            <Text style={styles.primaryText}>Record a new tip</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: "#1e293b",
    borderBottomWidth: 1,
  },
  back: { color: "#e2e8f0", fontSize: 15, fontWeight: "500", width: 40 },
  title: { color: "#e2e8f0", fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  empty: { color: "#94a3b8", fontSize: 15 },
  error: { color: "#ef4444", fontSize: 14, textAlign: "center" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardDate: { color: "#cbd5e1", fontSize: 13 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  muted: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
  rejectNote: { color: "#fecaca", fontSize: 13, marginTop: 6, lineHeight: 18 },
  rejectLabel: { fontWeight: "700", color: "#fca5a5" },
  footer: {
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    padding: 16,
  },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

export default MyUploadsScreen;
