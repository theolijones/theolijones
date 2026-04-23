import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import SignUpScreen from "../screens/SignUpScreen";
import HomeScreen from "../screens/HomeScreen";
import SplashScreen from "../screens/SplashScreen";
import CameraScreen from "../screens/CameraScreen";
import PreviewScreen from "../screens/PreviewScreen";
import EditorScreen from "../screens/EditorScreen";
import MetadataScreen from "../screens/MetadataScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { me, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {me ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen name="Preview" component={PreviewScreen} />
          <Stack.Screen name="Editor" component={EditorScreen} />
          <Stack.Screen name="Metadata" component={MetadataScreen} />
        </>
      ) : (
        <Stack.Screen name="SignUp" component={SignUpScreen} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
