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
import { useAuth } from "../auth/AuthContext";
import { SPORTS, TIP_TYPES, sportByKey } from "../data/contentMappings";
import {
  buildVideoMetadata,
  effectiveControl,
  exposedInputFields,
  missingRequired,
  type FieldValue,
} from "../api/metadata";

type Nav = NativeStackNavigationProp<RootStackParamList, "Metadata">;
type MetadataRoute = RouteProp<RootStackParamList, "Metadata">;

interface Option {
  label: string;
  value: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const MetadataScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<MetadataRoute>();
  const { videoUri, videoContentType, edl, assetRefs, background } = route.params;
  const { me } = useAuth();

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
        exposedInputFields(res.fields).forEach((f) => {
          const c = effectiveControl(f);
          seed[f.key] = c === "boolean" ? false : c === "date" ? new Date() : "";
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

  const inputs = useMemo(() => (fields ? exposedInputFields(fields) : []), [fields]);

  // Talent-derived fields require an assigned talent on the account.
  const needsTalent = useMemo(
    () => !!fields?.some((f) => (f.source ?? "input") === "derived"),
    [fields]
  );
  const talentMissing = needsTalent && (!me?.talentId || !me?.talentInitials);

  const missing = useMemo(
    () => (fields ? missingRequired(fields, values) : []),
    [fields, values]
  );

  const sportKey = useMemo(() => {
    const sf = inputs.find((f) => f.catalog === "sport");
    const v = sf ? values[sf.key] : undefined;
    return typeof v === "string" ? v : "";
  }, [inputs, values]);

  const setValue = (key: string, v: FieldValue) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const optionsFor = (f: SchemaField): Option[] => {
    if (f.catalog === "sport") return SPORTS.map((s) => ({ label: s.label, value: s.key }));
    if (f.catalog === "tipType") return TIP_TYPES.map((t) => ({ label: t.name, value: t.id }));
    if (f.catalog === "competition") {
      const comps = sportKey ? sportByKey(sportKey)?.competitions ?? [] : [];
      return comps.map((c) => ({ label: c, value: c }));
    }
    return (f.options ?? []).map((o) => ({ label: o, value: o }));
  };

  const canSubmit = !!fields && !talentMissing && missing.length === 0 && !submitting;

  const submit = async () => {
    if (!fields || !canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);
    setProgress(0);
    try {
      const metadata = buildVideoMetadata(fields, values, {
        talentId: me?.talentId,
        talentInitials: me?.talentInitials,
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
          <Text style={styles.subtitle}>Fill these in before submitting for review.</Text>

          {talentMissing && (
            <Text style={styles.error}>
              Your account has no talent assigned. Ask an admin to set it on your signup
              before submitting.
            </Text>
          )}

          {inputs.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key]}
              options={optionsFor(f)}
              onChange={(v) => setValue(f.key, v)}
            />
          ))}

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

interface FieldRowProps {
  field: SchemaField;
  value: FieldValue;
  options: Option[];
  onChange: (v: FieldValue) => void;
}

const FieldRow = ({ field, value, options, onChange }: FieldRowProps) => {
  const control = effectiveControl(field);

  const Label = (
    <Text style={styles.label}>
      {field.label}
      {field.required && <Text style={styles.req}> *</Text>}
    </Text>
  );

  if (control === "boolean") {
    return (
      <View style={styles.field}>
        <View style={styles.rowBetween}>
          {Label}
          <Switch value={Boolean(value)} onValueChange={onChange} />
        </View>
        {field.helpText && <Text style={styles.help}>{field.helpText}</Text>}
      </View>
    );
  }

  if (control === "select") {
    return (
      <View style={styles.field}>
        {Label}
        <View style={styles.enumWrap}>
          {options.length === 0 ? (
            <Text style={styles.help}>Select a sport first.</Text>
          ) : (
            options.map((opt) => {
              const selected = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onChange(opt.value)}
                  style={[styles.enumChip, selected && styles.enumChipSelected]}
                >
                  <Text style={selected ? styles.enumChipTextSelected : styles.enumChipText}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
        {field.helpText && <Text style={styles.help}>{field.helpText}</Text>}
      </View>
    );
  }

  if (control === "date") {
    return (
      <View style={styles.field}>
        {Label}
        <DateTimeField value={value instanceof Date ? value : new Date()} onChange={onChange} />
        {field.helpText && <Text style={styles.help}>{field.helpText}</Text>}
      </View>
    );
  }

  // text / number
  const isText = control === "text";
  const pasteInto = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) onChange(text);
  };

  return (
    <View style={styles.field}>
      {Label}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isText && { flex: 1 }]}
          value={value === null || value === undefined ? "" : String(value)}
          onChangeText={onChange}
          keyboardType={control === "number" ? "decimal-pad" : "default"}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={field.helpText ?? ""}
          placeholderTextColor="#64748b"
        />
        {isText && (
          <Pressable style={styles.pasteBtn} onPress={pasteInto}>
            <Text style={styles.pasteText}>Paste</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

// JS-only date + time entry (no native module). Maintains text for partial
// edits and commits a Date once both parts parse.
const DateTimeField = ({ value, onChange }: { value: Date; onChange: (d: Date) => void }) => {
  const [dateStr, setDateStr] = useState(toDateStr(value));
  const [timeStr, setTimeStr] = useState(toTimeStr(value));

  const commit = (d: string, t: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.trim());
    const tm = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (!m || !tm) return;
    const next = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(tm[1]),
      Number(tm[2]),
      0
    );
    if (!Number.isNaN(next.getTime())) onChange(next);
  };

  return (
    <View style={styles.inputRow}>
      <TextInput
        style={[styles.input, { flex: 1.4 }]}
        value={dateStr}
        onChangeText={(v) => {
          setDateStr(v);
          commit(v, timeStr);
        }}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#64748b"
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
      />
      <TextInput
        style={[styles.input, { flex: 1 }]}
        value={timeStr}
        onChangeText={(v) => {
          setTimeStr(v);
          commit(dateStr, v);
        }}
        placeholder="HH:MM"
        placeholderTextColor="#64748b"
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
      />
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
  error: { color: "#ef4444", fontSize: 14, textAlign: "center", marginBottom: 12 },
});

export default MetadataScreen;
