import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";

const SignUpScreen = () => {
  const { signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !token.trim()) {
      setErr("Both fields are required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await signUp(username.trim(), token.trim().toUpperCase());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrap}
      >
        <Text style={styles.title}>Bet Tips</Text>
        <Text style={styles.subtitle}>
          Sign up with your Sportsbet username and the invite code you were issued.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Sportsbet username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your-sportsbet-username"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABCD-1234"
            placeholderTextColor="#64748b"
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, (busy || pressed) && styles.buttonPressed]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        {err && <Text style={styles.error}>{err}</Text>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  wrap: { flex: 1, padding: 24, justifyContent: "center" },
  title: { color: "#e2e8f0", fontSize: 32, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#94a3b8", fontSize: 14, marginBottom: 24, lineHeight: 20 },
  field: { marginBottom: 16 },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#e2e8f0",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#ef4444", marginTop: 12, textAlign: "center" },
});

export default SignUpScreen;
