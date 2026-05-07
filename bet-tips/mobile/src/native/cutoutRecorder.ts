import { NativeModules, Platform } from "react-native";

// Native module that captures the cutout-composited frames produced by
// `PersonCutoutPlugin` into an mp4 in parallel with VisionCamera's regular
// recording. After the user stops, we ask the same module to splice
// VisionCamera's audio track onto our cutout video to produce the final
// upload. iOS-only; on other platforms the methods become no-ops that
// resolve so callers can keep the same shape.
//
// See `mobile/plugins/person-cutout/CutoutRecorder.m`.

interface CutoutRecorderModule {
  startRecording(path: string): Promise<{ path: string }>;
  stopRecording(): Promise<{
    path: string;
    framesWritten: number;
    framesDropped: number;
  }>;
  mergeAudio(
    videoPath: string,
    audioPath: string,
    outputPath: string,
  ): Promise<{ path: string }>;
}

const native = NativeModules.CutoutRecorder as CutoutRecorderModule | undefined;

const ensureNative = (): CutoutRecorderModule => {
  if (!native) {
    throw new Error(
      "CutoutRecorder native module is not linked. Rebuild the dev client.",
    );
  }
  return native;
};

export const CutoutRecorder = {
  isAvailable: Platform.OS === "ios" && native != null,

  startRecording: async (suggestedPath = ""): Promise<string> => {
    const result = await ensureNative().startRecording(suggestedPath);
    return result.path;
  },

  stopRecording: async (): Promise<{
    path: string;
    framesWritten: number;
    framesDropped: number;
  }> => {
    return ensureNative().stopRecording();
  },

  mergeAudio: async (
    videoPath: string,
    audioPath: string,
    outputPath = "",
  ): Promise<string> => {
    const result = await ensureNative().mergeAudio(
      videoPath,
      audioPath,
      outputPath,
    );
    return result.path;
  },
};
