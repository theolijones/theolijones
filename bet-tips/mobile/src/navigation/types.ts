import type { VideoContentType } from "../api/uploads";
import type { EdlBase } from "../api/edl";

export type RootStackParamList = {
  SignUp: undefined;
  Home: undefined;
  Camera: undefined;
  Preview: { videoUri: string; videoContentType: VideoContentType };
  Editor: { videoUri: string; videoContentType: VideoContentType };
  Metadata: { videoUri: string; videoContentType: VideoContentType; edl?: EdlBase };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
