import type { ImageAssetContentType, VideoContentType } from "../api/uploads";
import type { EdlBase } from "../api/edl";

export interface AssetRef {
  layerId: string;
  localUri: string;
  contentType: ImageAssetContentType;
}

export interface BackgroundChoice {
  /** Pre-existing S3 key for a library-sourced background. Set for library
   *  picks; empty string for camera-roll picks (filled in at submit time). */
  assetKey: string;
  /** URL used in-editor preview (file:// for camera roll, presigned https
   *  for library — the latter may expire after ~15 min). */
  previewUri: string;
  /** Display title shown on the chip (filename for camera-roll picks). */
  title: string;
  /** Local file URI for a camera-roll-sourced background. When set, the
   *  submit pipeline uploads this file and overwrites `assetKey`. */
  localUri?: string;
  contentType?: ImageAssetContentType;
}

export type RootStackParamList = {
  SignUp: undefined;
  Home: undefined;
  Camera: undefined;
  Preview: {
    videoUri: string;
    videoContentType: VideoContentType;
    background?: BackgroundChoice;
  };
  Editor: {
    videoUri: string;
    videoContentType: VideoContentType;
    background?: BackgroundChoice;
  };
  Metadata: {
    videoUri: string;
    videoContentType: VideoContentType;
    edl?: EdlBase;
    assetRefs?: AssetRef[];
    background?: BackgroundChoice;
  };
  MyUploads: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
