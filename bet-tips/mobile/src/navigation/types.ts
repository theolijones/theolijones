import type { VideoContentType } from "../api/uploads";

export type RootStackParamList = {
  SignUp: undefined;
  Home: undefined;
  Camera: undefined;
  Preview: { videoUri: string; videoContentType: VideoContentType };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
