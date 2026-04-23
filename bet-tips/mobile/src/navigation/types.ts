import type { ImageAssetContentType, VideoContentType } from "../api/uploads";
import type { EdlBase } from "../api/edl";

export interface AssetRef {
  layerId: string;
  localUri: string;
  contentType: ImageAssetContentType;
}

export type RootStackParamList = {
  SignUp: undefined;
  Home: undefined;
  Camera: undefined;
  Preview: { videoUri: string; videoContentType: VideoContentType };
  Editor: { videoUri: string; videoContentType: VideoContentType };
  Metadata: {
    videoUri: string;
    videoContentType: VideoContentType;
    edl?: EdlBase;
    assetRefs?: AssetRef[];
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
