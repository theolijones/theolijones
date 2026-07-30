import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { submitUpload } from "../api/uploads";
import { useAuth } from "../auth/AuthContext";
import { applyBetId, type NamedTemplate } from "../api/metadata";

type Nav = NativeStackNavigationProp<RootStackParamList, "Metadata">;
type MetadataRoute = RouteProp<RootStackParamList, "Metadata">;

// The Bet ID was free text, and a talent submitted the literal word "this" —
// which then became the download filename for the whole submission.
//
// Deliberately a plausibility check rather than a format check: the only
// confirmed-good value on record is `O/1072664/0012608/D`, a slash-delimited
// code, so a strict pattern would be guesswork and would risk rejecting valid
// IDs. Slashes must stay allowed — the backend already strips them out of
// Content-Disposition via `downloadFilename`. This rejects the observed junk
// ("this", "thisthing") while accepting every real shape seen so far.
//
// Tighten to a real pattern once the canonical format is confirmed with the
// owner of the COP feed, and enforce it server-side in uploads-complete too.
const BET_ID_MIN_LENGTH = 6;

const isPlausibleBetId = (value: string): boolean =>
  value.length >= BET_ID_MIN_LENGTH && /\d/.test(value);

const MetadataScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<MetadataRoute>();
  const { videoUri, videoContentType, edl, assetRefs, background } = route.params;
  const { me } = useAuth();

  const templates = useMemo<NamedTemplate[]>(() => me?.metadataTemplates ?? [], [me]);

  const [betId, setBetId] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(
    templates.length === 1 ? templates[0].id : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  const trimmedBetId = betId.trim();
  const betIdValid = isPlausibleBetId(trimmedBetId);
  // Only complain once there's something to complain about — an empty field is
  // simply incomplete, not wrong.
  const showBetIdError = trimmedBetId.length > 0 && !betIdValid;

  const canSubmit = !!selected && betIdValid && !submitting;

  const submit = async () => {
    if (!selected || !canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);
    setProgress(0);
    try {
      const metadata = applyBetId(selected, trimmedBetId);
      await submitUpload({
        videoUri,
        videoContentType,
        metadata,
        edl,
        assets: assetRefs,
        backgroundUpload:
          background?.localUri && background.contentType
            ? { localUri: background.localUri, contentType: background.contentType }
            : undefined,
        onProgress: setProgress,
      });
      nav.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      setSubmitErr((e as Error).message);
      setSubmitting(false);
    }
  };

  const pasteBetId = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setBetId(text.trim());
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Tip details</Text>
          <Text style={styles.subtitle}>
            Enter the Bet ID and choose a template, then submit for review.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Bet ID<Text style={styles.req}> *</Text>
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={betId}
                onChangeText={setBetId}
                placeholder="Paste the bet ID"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.pasteBtn} onPress={pasteBetId}>
                <Text style={styles.pasteText}>Paste</Text>
              </Pressable>
            </View>
            {showBetIdError && (
              <Text style={styles.fieldError}>
                That doesn't look like a Bet ID — it should be at least{" "}
                {BET_ID_MIN_LENGTH} characters and contain a number. Copy it
                from the bet rather than typing it.
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Template<Text style={styles.req}> *</Text>
            </Text>
            {templates.length === 0 ? (
              <Text style={styles.help}>
                No templates assigned to your account yet. Ask an admin to add one.
              </Text>
            ) : (
              <View style={styles.enumWrap}>
                {templates.map((t) => {
                  const isSel = t.id === templateId;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setTemplateId(t.id)}
                      style={[styles.enumChip, isSel && styles.enumChipSelected]}
                    >
                      <Text style={isSel ? styles.enumChipTextSelected : styles.enumChipText}>
                        {t.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {submitErr && <Text style={styles.error}>{submitErr}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          {submitting ? (
            <View style={styles.progressWrap}>
              <ActivityIndicator color="#e2e8f0" />
              <Text style={styles.progressText}>Uploading… {Math.round(progress * 100)}%</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.secondaryBtn]} onPress={() => nav.goBack()}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.primaryBtn, !canSubmit && styles.disabled]}
                onPress={submit}
                disabled={!canSubmit}
              >
                <Text style={styles.primaryText}>Submit for review</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { padding: 20, paddingBottom: 32 },
  title: { color: "#e2e8f0", fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#94a3b8", fontSize: 14, marginBottom: 20, lineHeight: 20 },
  field: { marginBottom: 16 },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  req: { color: "#ef4444" },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#e2e8f0",
    fontSize: 16,
  },
  pasteBtn: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pasteText: { color: "#e2e8f0", fontSize: 14, fontWeight: "500" },
  help: { color: "#64748b", fontSize: 12, marginTop: 4 },
  // Field-level message: left-aligned under its input, unlike `error`, which is
  // centred for the page-level submit failure.
  fieldError: { color: "#f87171", fontSize: 12, marginTop: 6, lineHeight: 17 },
  enumWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  enumChip: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  enumChipSelected: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  enumChipText: { color: "#e2e8f0", fontSize: 14 },
  enumChipTextSelected: { color: "#fff", fontSize: 14, fontWeight: "600" },
  footer: {
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    padding: 16,
  },
  actions: { flexDirection: "row", gap: 12 },
  progressWrap: { flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "center" },
  progressText: { color: "#e2e8f0", fontSize: 15 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  primaryBtn: { backgroundColor: "#3b82f6" },
  secondaryBtn: { borderWidth: 1, borderColor: "#334155" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryText: { color: "#e2e8f0", fontSize: 16, fontWeight: "500" },
  disabled: { opacity: 0.5 },
  error: { color: "#ef4444", fontSize: 14, textAlign: "center", marginBottom: 12 },
});

export default MetadataScreen;
