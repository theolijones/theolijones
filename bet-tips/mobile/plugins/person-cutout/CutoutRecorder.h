//
//  CutoutRecorder.h
//  BetTips
//
//  Native iOS module that captures the per-frame composited CVPixelBuffers
//  produced by PersonCutoutPlugin into an mp4 via AVAssetWriter. JS-side
//  records the camera's audio in parallel through VisionCamera, then asks
//  this module to merge our cutout video track with VisionCamera's audio
//  track into the final upload-ready file.
//

#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIImage.h>

NS_ASSUME_NONNULL_BEGIN

@interface CutoutRecorder : NSObject <RCTBridgeModule>

+ (instancetype)shared;

// Per-frame entry called from PersonCutoutPlugin. Cheap no-op when not
// recording — checks an atomic flag before any work.
- (void)appendBuffer:(CVPixelBufferRef)buffer
               width:(size_t)width
              height:(size_t)height
           timestamp:(CMTime)timestamp
         orientation:(UIImageOrientation)orientation
          isMirrored:(BOOL)isMirrored;

@end

NS_ASSUME_NONNULL_END
