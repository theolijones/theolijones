import "react-native-gesture-handler";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./src/auth/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { FONT_ASSETS } from "./src/data/textStyles";

export default function App() {
  // Caption fonts shared with the render-worker. Gate the UI until they load
  // so the editor preview never flashes a fallback typeface.
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            {fontsLoaded ? (
              <RootNavigator />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            )}
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
