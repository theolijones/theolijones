import { ActivityIndicator, StyleSheet, View } from "react-native";

const SplashScreen = () => (
  <View style={styles.wrap}>
    <ActivityIndicator size="large" color="#3b82f6" />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SplashScreen;
