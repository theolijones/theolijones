//
//  PersonCutoutPlugin.m
//  BetTips
//
//  Frame processor plugin: runs Apple's person-segmentation Vision request,
//  composites the camera frame over a chosen background using Core Image,
//  and returns a uintptr_t pointer to the composited CVPixelBuffer. The
//  JS-side worklet wraps that pointer as a Skia SkImage and draws it once
//  via frame.drawImageRect — eliminating the per-frame Skia.Image.MakeImage +
//  saveLayer allocation churn that previously caused iOS jetsam at ~14 sec
//  (~300 MB unmapped GPU texture pool growth).
//

#import "PersonCutoutPlugin.h"
#import "CutoutRecorder.h"

#import <CoreImage/CoreImage.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <ImageIO/CGImageProperties.h>
#import <Metal/Metal.h>
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>
#import <VisionCamera/Frame.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import <mach/mach.h>

// Static ring of output buffers for the composited frames. Pre-allocated
// once at first frame (or on dimension change) and reused indefinitely.
// Avoids CVPixelBufferPool growth — phys_footprint stays bounded regardless
// of how long the GPU pipeline (or the recording AVAssetWriter) holds an
// IOSurface alive. 3 slots: one being rendered into, one queued for Skia
// draw, one being encoded by the H.264 hardware encoder during recording.
// 2 was enough for preview-only; the recorder retains a buffer briefly
// across its writer-queue dispatch and a 3rd slot keeps the rotation safe.
static const int kOutputBufferCount = 3;

@implementation PersonCutoutPlugin {
  VNGeneratePersonSegmentationRequest *_request API_AVAILABLE(ios(15.0));

  CIContext *_ciContext;
  uint64_t _frameCounter;
  uint64_t _firstFrameMachTime;

  NSString *_lastBgURI;
  CIImage *_cachedBg;            // BG loaded from disk, in image-native orientation
  CIImage *_cachedBgFitted;      // BG transformed to match current camera buffer
  size_t _lastFittedW;
  size_t _lastFittedH;
  UIImageOrientation _lastFittedOrientation;

  CVPixelBufferRef _outputBuffers[3]; // sized to kOutputBufferCount
  int _outputBufferIdx;
  size_t _outputBuffersW;
  size_t _outputBuffersH;

  CGColorSpaceRef _sRGBColorSpace;
}

- (instancetype)initWithProxy:(VisionCameraProxyHolder *)proxy
                  withOptions:(NSDictionary *)options {
  self = [super initWithProxy:proxy withOptions:options];
  if (self) {
    if (@available(iOS 15.0, *)) {
      _request = [[VNGeneratePersonSegmentationRequest alloc] init];
      _request.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelBalanced;
      _request.outputPixelFormat = kCVPixelFormatType_OneComponent8;
    }

    // Metal-backed CIContext with intermediate caching disabled. Build #5
    // showed the per-frame leak (~240 MB/s, dominated by compressed memory
    // growth) was NOT in the output buffer pool — double-buffer didn't help.
    // Reinstating kCIContextCacheIntermediates=NO so CI doesn't keep working
    // textures around between renders. iOS compresses those dirty pages and
    // the compression itself counts toward phys_footprint.
    id<MTLDevice> device = MTLCreateSystemDefaultDevice();
    NSDictionary *ctxOpts = @{
      kCIContextCacheIntermediates : @(NO),
    };
    if (device) {
      _ciContext = [CIContext contextWithMTLDevice:device options:ctxOpts];
    } else {
      _ciContext = [CIContext contextWithOptions:ctxOpts];
    }

    // Destination color space for CIContext render. Without this (passing nil),
    // the camera buffer's BT.709 video gamma got reinterpreted as sRGB at the
    // Skia draw step — blacks crushed, midtones steepened, output looked
    // contrasty and oversaturated. Pinning the destination to sRGB so the
    // rendered pixels match what Skia/the dev client display assumes.
    _sRGBColorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  }
  return self;
}

- (void)dealloc {
  for (int i = 0; i < kOutputBufferCount; i++) {
    if (_outputBuffers[i]) {
      CVPixelBufferRelease(_outputBuffers[i]);
      _outputBuffers[i] = NULL;
    }
  }
  if (_sRGBColorSpace) {
    CGColorSpaceRelease(_sRGBColorSpace);
    _sRGBColorSpace = NULL;
  }
}

// Map the camera frame's UIImageOrientation to the CGImagePropertyOrientation
// to apply to an upright BG so that the BG, after VisionCamera rotates the
// whole composited surface for display, ends up right-side-up.
//
// Verified empirically (2026-05-07): for frame.orientation=Left (typical
// iPhone portrait back camera in this app), VC rotates the surface 90° CW
// for display. The BG must be rotated 90° CW pre-composite (= CG orientation
// Left = 8) so it lands upright after VC's rotation. Same direction (matched,
// not inverted) for Right. The previous mapping inverted these and produced
// a 180° upside-down BG.
static CGImagePropertyOrientation BgOrientationFromFrame(UIImageOrientation o) {
  switch (o) {
    case UIImageOrientationUp:
    case UIImageOrientationUpMirrored:
      return kCGImagePropertyOrientationUp;
    case UIImageOrientationDown:
    case UIImageOrientationDownMirrored:
      return kCGImagePropertyOrientationDown;
    case UIImageOrientationLeft:
    case UIImageOrientationLeftMirrored:
      return kCGImagePropertyOrientationLeft;
    case UIImageOrientationRight:
    case UIImageOrientationRightMirrored:
      return kCGImagePropertyOrientationRight;
  }
  return kCGImagePropertyOrientationUp;
}

- (BOOL)ensureOutputBuffersForWidth:(size_t)w height:(size_t)h {
  if (_outputBuffers[0] && _outputBuffersW == w && _outputBuffersH == h) return YES;

  // Dimensions changed (or first call). Free any existing and re-allocate.
  for (int i = 0; i < kOutputBufferCount; i++) {
    if (_outputBuffers[i]) {
      CVPixelBufferRelease(_outputBuffers[i]);
      _outputBuffers[i] = NULL;
    }
  }

  NSDictionary *attrs = @{
    (NSString *)kCVPixelBufferIOSurfacePropertiesKey : @{},
    (NSString *)kCVPixelBufferMetalCompatibilityKey : @(YES),
  };
  for (int i = 0; i < kOutputBufferCount; i++) {
    CVPixelBufferRef buf = NULL;
    CVReturn r = CVPixelBufferCreate(NULL, w, h,
                                     kCVPixelFormatType_32BGRA,
                                     (__bridge CFDictionaryRef)attrs,
                                     &buf);
    if (r != kCVReturnSuccess || buf == NULL) {
      // Roll back any partial allocation.
      for (int j = 0; j < i; j++) {
        CVPixelBufferRelease(_outputBuffers[j]);
        _outputBuffers[j] = NULL;
      }
      return NO;
    }
    _outputBuffers[i] = buf;
  }
  _outputBuffersW = w;
  _outputBuffersH = h;
  _outputBufferIdx = 0;
  return YES;
}

- (BOOL)ensureFittedBgForWidth:(size_t)w
                        height:(size_t)h
                   orientation:(UIImageOrientation)orientation {
  if (_cachedBg == nil) return NO;
  if (_cachedBgFitted &&
      _lastFittedW == w &&
      _lastFittedH == h &&
      _lastFittedOrientation == orientation) {
    return YES;
  }
  CGImagePropertyOrientation bgRotate = BgOrientationFromFrame(orientation);
  if (_lastFittedOrientation != orientation || _cachedBgFitted == nil) {
    NSLog(@"[cutout-bg] fitting BG for camera frame.orientation=%ld -> "
          @"applying CG orientation=%u (1=Up,3=Down,6=Right,8=Left); "
          @"buffer=%zux%zu",
          (long)orientation, (unsigned)bgRotate, w, h);
  }
  CIImage *rotated = [_cachedBg imageByApplyingOrientation:bgRotate];
  CGRect ext = rotated.extent;
  if (ext.size.width <= 0 || ext.size.height <= 0) return NO;

  // Aspect-fill: scale the BG so it FILLS the camera buffer, preserving
  // aspect ratio. Overflow on the long axis gets cropped at composite time.
  // Using "stretch to fill" earlier squashed portrait BGs into landscape
  // camera frames.
  CGFloat sx = (CGFloat)w / ext.size.width;
  CGFloat sy = (CGFloat)h / ext.size.height;
  CGFloat scale = MAX(sx, sy);
  CGFloat scaledW = ext.size.width * scale;
  CGFloat scaledH = ext.size.height * scale;
  // Center the scaled BG inside the camera buffer.
  CGFloat dx = ((CGFloat)w - scaledW) / 2.0 - ext.origin.x * scale;
  CGFloat dy = ((CGFloat)h - scaledH) / 2.0 - ext.origin.y * scale;
  CGAffineTransform tx = CGAffineTransformMake(scale, 0, 0, scale, dx, dy);

  _cachedBgFitted = [rotated imageByApplyingTransform:tx];
  _lastFittedW = w;
  _lastFittedH = h;
  _lastFittedOrientation = orientation;
  return YES;
}

- (id)callback:(Frame *)frame withArguments:(NSDictionary *)arguments {
  if (@available(iOS 15.0, *)) {
    if (_request == nil) return nil;

    // The frame processor runs on a non-runloop dispatch queue. Without an
    // explicit pool, CIImage / CIFilter / VNImageRequestHandler autoreleased
    // objects accumulate every frame — each retains its source CVPixelBuffer
    // — and memory climbs ~6 MB/frame until iOS jetsam (3 GB ActiveHard limit)
    // kills the app in ~18 sec.
    __block id resultDict = nil;
    @autoreleasepool {
      NSString *bgURI = arguments[@"bgUri"];
      if (![bgURI isKindOfClass:[NSString class]] || bgURI.length == 0) return nil;

      if (![bgURI isEqualToString:_lastBgURI]) {
        NSURL *url = [NSURL URLWithString:bgURI];
        if (url == nil) return nil;

        // Load raw pixels via ImageIO and read EXIF orientation as a
        // separate step. [CIImage imageWithContentsOfURL:] sometimes
        // auto-applies EXIF (and sometimes doesn't) depending on iOS
        // version and image format — but in either case it still reports
        // the original orientation tag in .properties, which led to a
        // double-rotation (BG ended up 180° upside down for typical
        // iPhone portrait photos with EXIF=6). CGImageSource never
        // auto-rotates, so this is unambiguous.
        CGImageSourceRef src = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
        if (src == NULL) return nil;

        CGImagePropertyOrientation exifOrient = kCGImagePropertyOrientationUp;
        CFDictionaryRef cfProps = CGImageSourceCopyPropertiesAtIndex(src, 0, NULL);
        if (cfProps != NULL) {
          NSDictionary *props = (__bridge_transfer NSDictionary *)cfProps;
          NSNumber *orientNum = props[(NSString *)kCGImagePropertyOrientation];
          if (orientNum != nil) {
            exifOrient = (CGImagePropertyOrientation)orientNum.intValue;
          }
        }

        CGImageRef cgImg = CGImageSourceCreateImageAtIndex(src, 0, NULL);
        CFRelease(src);
        if (cgImg == NULL) return nil;

        CIImage *raw = [CIImage imageWithCGImage:cgImg];
        CGImageRelease(cgImg);
        if (raw == nil) return nil;

        CIImage *upright = (exifOrient == kCGImagePropertyOrientationUp)
            ? raw
            : [raw imageByApplyingOrientation:exifOrient];

        NSLog(@"[cutout-bg] loaded BG, exif=%u, raw extent=%@, upright extent=%@",
              (unsigned)exifOrient,
              NSStringFromCGRect(raw.extent),
              NSStringFromCGRect(upright.extent));

        _cachedBg = upright;
        _cachedBgFitted = nil;
        _lastBgURI = [bgURI copy];
      }

      CMSampleBufferRef sampleBuffer = frame.buffer;
      if (sampleBuffer == NULL) return nil;
      CVPixelBufferRef cameraBuf = CMSampleBufferGetImageBuffer(sampleBuffer);
      if (cameraBuf == NULL) return nil;

      size_t w = CVPixelBufferGetWidth(cameraBuf);
      size_t h = CVPixelBufferGetHeight(cameraBuf);
      if (w == 0 || h == 0) return nil;

      // VNImageRequestHandler is the right tool here — segmentation is
      // stateless per-frame, not a sequence-tracking request. The handler
      // is autoreleased and freed by the surrounding @autoreleasepool.
      VNImageRequestHandler *handler =
          [[VNImageRequestHandler alloc] initWithCVPixelBuffer:cameraBuf options:@{}];
      NSError *error = nil;
      if (![handler performRequests:@[ _request ] error:&error] || error != nil) {
        return nil;
      }
      NSArray *results = _request.results;
      if (results.count == 0) return nil;
      id first = results.firstObject;
      if (![first isKindOfClass:[VNPixelBufferObservation class]]) return nil;
      VNPixelBufferObservation *observation = (VNPixelBufferObservation *)first;
      CVPixelBufferRef maskBuf = observation.pixelBuffer;
      if (maskBuf == NULL) return nil;

      CIImage *cameraCI = [CIImage imageWithCVPixelBuffer:cameraBuf];
      CIImage *maskCI = [CIImage imageWithCVPixelBuffer:maskBuf];
      size_t mw = CVPixelBufferGetWidth(maskBuf);
      size_t mh = CVPixelBufferGetHeight(maskBuf);
      if (mw == 0 || mh == 0) return nil;
      if (mw != w || mh != h) {
        CGAffineTransform ms = CGAffineTransformMakeScale((CGFloat)w / mw, (CGFloat)h / mh);
        maskCI = [maskCI imageByApplyingTransform:ms];
      }

      // While a take is in progress the recorded file's display orientation is
      // already fixed (AVAssetWriterInput.transform is set once, at writer
      // setup). Follow that same orientation for the BG instead of the live
      // frame's, so rotating the phone mid-take doesn't spin the background 90°
      // while the person stays put. One atomic load, no allocation — this stays
      // off the path that caused the historical jetsam.
      int locked = [[CutoutRecorder shared] lockedOrientation];
      UIImageOrientation bgOrientation =
          locked >= 0 ? (UIImageOrientation)locked : frame.orientation;

      if (![self ensureFittedBgForWidth:w height:h orientation:bgOrientation]) {
        return nil;
      }

      CIFilter *blend = [CIFilter filterWithName:@"CIBlendWithMask"];
      [blend setValue:cameraCI forKey:kCIInputImageKey];
      [blend setValue:_cachedBgFitted forKey:kCIInputBackgroundImageKey];
      [blend setValue:maskCI forKey:kCIInputMaskImageKey];
      CIImage *composited = blend.outputImage;
      if (composited == nil) return nil;

      if (![self ensureOutputBuffersForWidth:w height:h]) return nil;
      // Ring buffer: render into the next slot. The previous slot is still
      // being sampled by Skia's queued GPU draw (and during recording, by
      // the H.264 encoder via AVAssetWriter), so we never write where a
      // consumer is still reading. 3 slots is enough for the longest
      // overlap (encoder taking ~2 frame times to compress).
      _outputBufferIdx = (_outputBufferIdx + 1) % kOutputBufferCount;
      CVPixelBufferRef outBuf = _outputBuffers[_outputBufferIdx];

      [_ciContext render:composited
         toCVPixelBuffer:outBuf
                  bounds:CGRectMake(0, 0, w, h)
              colorSpace:_sRGBColorSpace];

      // Hand the composited frame to the recorder. Cheap atomic-load
      // no-op when not recording. When recording, the recorder retains
      // the pixel buffer across an internal serial-queue dispatch and
      // the H.264 encoder reads from it; the next 2 ring slots cover
      // the encoder's read window before this slot is reused.
      CMTime pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer);
      [[CutoutRecorder shared] appendBuffer:outBuf
                                      width:w
                                     height:h
                                  timestamp:pts
                                orientation:frame.orientation
                                 isMirrored:frame.isMirrored];

      // Memory instrumentation. phys_footprint is the metric iOS uses for
      // jetsam decisions — it counts compressed pages and IOSurface
      // commitments that resident_size omits. resident_size in earlier
      // builds undercounted by 3-4× and was not predictive of the kill.
      _frameCounter++;
      if ((_frameCounter % 30) == 1) {
        struct task_vm_info vmInfo;
        mach_msg_type_number_t vmCount = TASK_VM_INFO_COUNT;
        kern_return_t kr = task_info(mach_task_self(), TASK_VM_INFO,
                                     (task_info_t)&vmInfo, &vmCount);
        if (kr == KERN_SUCCESS) {
          if (_firstFrameMachTime == 0) _firstFrameMachTime = mach_absolute_time();
          mach_timebase_info_data_t tb;
          mach_timebase_info(&tb);
          uint64_t elapsedNs = (mach_absolute_time() - _firstFrameMachTime) * tb.numer / tb.denom;
          double elapsedSec = (double)elapsedNs / 1.0e9;
          NSLog(@"[cutout-mem] frame=%llu t=%.2fs footprint=%.1fMB resident=%.1fMB compressed=%.1fMB frameSize=%lux%lu",
                (unsigned long long)_frameCounter,
                elapsedSec,
                (double)vmInfo.phys_footprint / (1024.0 * 1024.0),
                (double)vmInfo.resident_size / (1024.0 * 1024.0),
                (double)vmInfo.compressed / (1024.0 * 1024.0),
                (unsigned long)w,
                (unsigned long)h);
        }
      }

      // Return the pointer as a string. JSI's BigInt extraction (via
      // Skia.Image.MakeImageFromNativeBuffer) requires a JSI BigInt, but
      // VisionCamera marshals NSNumber as jsi::Number (double). Strings
      // marshal cleanly as jsi::String, and JS converts via BigInt(string).
      resultDict = @{
        @"buffer" : [NSString stringWithFormat:@"%lu", (unsigned long)(uintptr_t)outBuf],
        @"width" : @(w),
        @"height" : @(h),
      };
    }
    return resultDict;
  }
  return nil;
}

VISION_EXPORT_FRAME_PROCESSOR(PersonCutoutPlugin, runPersonCutout)

@end
