import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";

const HomeScreen = () => {
  const { me, signOut } = useAuth();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.hello}>
          Logged in as{" "}
          <Text style={styles.username}>{me?.sportsbetUsername ?? me?.userId}</Text>
        </Text>
        <Text style={styles.placeholder}>
          Camera and editor coming next phase.
        </Text>
        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  wrap: { flex: 1, padding: 24, justifyContent: "space-between" },
  hello: { color: "#e2e8f0", fontSize: 18, marginTop: 24 },
  username: { fontWeight: "700" },
  placeholder: {
    color: "#94a3b8",
    fontSize: 14,
    alignSelf: "center",
    marginBottom: 120,
  },
  signOut: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutText: { color: "#e2e8f0", fontSize: 15, fontWeight: "500" },
});

export default HomeScreen;
