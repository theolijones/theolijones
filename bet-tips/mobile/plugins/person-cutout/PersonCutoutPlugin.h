//
//  PersonCutoutPlugin.h
//  BetTips
//
//  Vision Camera 4 frame processor plugin: runs Apple's
//  VNGeneratePersonSegmentationRequest and returns the resulting mask
//  bytes (Alpha_8 row-packed) to JS so the camera frame can be composited
//  over a background using Skia in the JS-side worklet.
//

#import <VisionCamera/FrameProcessorPlugin.h>

NS_ASSUME_NONNULL_BEGIN

@interface PersonCutoutPlugin : FrameProcessorPlugin
@end

NS_ASSUME_NONNULL_END
