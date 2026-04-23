import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

const HomeScreen = () => {
  const { me, signOut } = useAuth();
  const nav = useNavigation<Nav>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <View>
          <Text style={styles.hello}>
            Logged in as{" "}
            <Text style={styles.username}>{me?.sportsbetUsername ?? me?.userId}</Text>
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.record, pressed && styles.recordPressed]}
          onPress={() => nav.navigate("Camera")}
        >
          <Text style={styles.recordText}>Record a tip</Text>
        </Pressable>
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
  record: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 32,
  },
  recordPressed: { opacity: 0.85 },
  recordText: { color: "#fff", fontSize: 18, fontWeight: "700" },
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
