import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchSchema, type SchemaField } from "../api/schema";
import { submitUpload } from "../api/uploads";

type Nav = NativeStackNavigationProp<RootStackParamList, "Metadata">;
type MetadataRoute = RouteProp<RootStackParamList, "Metadata">;

type FieldValue = string | number | boolean | null;

const coerceForSubmit = (field: SchemaField, raw: FieldValue): unknown => {
  if (raw === null || raw === "") return undefined;
  if (field.type === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (field.type === "boolean") return Boolean(raw);
  return raw;
};

const MetadataScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<MetadataRoute>();
  const { videoUri, videoContentType, edl, assetRefs, background } = route.params;

  const [fields, setFields] = useState<SchemaField[] | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchSchema();
        if (cancelled) return;
        setFields(res.fields);
        const seed: Record<string, FieldValue> = {};
        res.fields.forEach((f) => {
          seed[f.key] = f.type === "boolean" ? false : "";
        });
        setValues(seed);
      } catch (e) {
        if (!cancelled) setLoadErr((e as Error).message);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const missingRequired = useMemo(() => {
    if (!fields) return [];
    return fields.filter((f) => {
      if (!f.required) return false;
      const v = values[f.key];
      if (f.type === "boolean") return false;
      return v === undefined || v === null || v === "";
    });
  }, [fields, values]);

  const setValue = (key: string, v: FieldValue) => setValues((prev) => ({ ...prev, [key]: v }));

  const pasteInto = async (key: string) => {
    const text = await Clipboard.getStringAsync();
    if (text) setValue(key, text);
  };

  const submit = async () => {
    if (!fields || missingRequired.length > 0) return;
    setSubmitting(true);
    setSubmitErr(null);
    setProgress(0);
    try {
      const metadata: Record<string, unknown> = {};
      fields.forEach((f) => {
        const v = coerceForSubmit(f, values[f.key]);
        if (v !== undefined) metadata[f.key] = v;
      });
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

  if (!fields && !loadErr) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#e2e8f0" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadErr) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>{loadErr}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => nav.goBack()}>
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Tip details</Text>
          <Text style={styles.subtitle}>
            Fill these in before submitting for review.
          </Text>

          {fields!.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key]}
              onChange={(v) => setValue(f.key, v)}
              onPaste={() => pasteInto(f.key)}
            />
          ))}

          {submitErr && <Text style={styles.error}>{submitErr}</Text>}
        </ScrollView>

        <View style={styles.footer}>
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
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btn,
                  styles.primaryBtn,
                  missingRequired.length > 0 && styles.disabled,
                ]}
                onPress={submit}
                disabled={missingRequired.length > 0}
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

interface FieldRowProps {
  field: SchemaField;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  onPaste: () => void;
}

const FieldRow = ({ field, value, onChange, onPaste }: FieldRowProps) => {
  const isBetShare = field.key === "shareId";
  if (field.type === "boolean") {
    return (
      <View style={styles.field}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>
            {field.label}
            {field.required && <Text style={styles.req}> *</Text>}
          </Text>
          <Switch value={Boolean(value)} onValueChange={onChange} />
        </View>
        {field.helpText && <Text style={styles.help}>{field.helpText}</Text>}
      </View>
    );
  }

  if (field.type === "enum" && field.options) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {field.label}
          {field.required && <Text style={styles.req}> *</Text>}
        </Text>
        <View style={styles.enumWrap}>
          {field.options.map((opt) => {
            const selected = value === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => onChange(opt)}
                style={[styles.enumChip, selected && styles.enumChipSelected]}
              >
                <Text style={selected ? styles.enumChipTextSelected : styles.enumChipText}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {field.helpText && <Text style={styles.help}>{field.helpText}</Text>}
      </View>
    );
  }

  const keyboardType = field.type === "number" ? "decimal-pad" : "default";

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {field.label}
        {field.required && <Text style={styles.req}> *</Text>}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isBetShare && { flex: 1 }]}
          value={value === null ? "" : String(value)}
          onChangeText={onChange}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={field.helpText ?? ""}
          placeholderTextColor="#64748b"
        />
        {isBetShare && (
          <Pressable style={styles.pasteBtn} onPress={onPaste}>
            <Text style={styles.pasteText}>Paste</Text>
          </Pressable>
        )}
      </View>
      {field.helpText && !isBetShare && <Text style={styles.help}>{field.helpText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  scroll: { padding: 20, paddingBottom: 32 },
  title: { color: "#e2e8f0", fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#94a3b8", fontSize: 14, marginBottom: 20, lineHeight: 20 },
  field: { marginBottom: 16 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  error: { color: "#ef4444", fontSize: 14, textAlign: "center" },
});

export default MetadataScreen;
