//
//  CutoutRecorder.m
//  BetTips
//
//  See CutoutRecorder.h. Three external entry points:
//    - JS: startRecording(path)        — open writer, await first frame
//    - JS: stopRecording()             — finalize, return path
//    - JS: mergeAudio(audio, video, out) — splice VC's audio onto our video
//    - Plugin: appendBuffer:width:...  — per-frame, hot path, must be cheap
//
//  Rationale (vs. VisionCamera's built-in recording): VisionCamera 4 records
//  the raw camera CMSampleBuffer from AVCaptureVideoDataOutput, bypassing
//  the Skia worklet and our native composite. We need the cutout pixels in
//  the final mp4, so we run a parallel AVAssetWriter pipeline whose source
//  is the composited buffers the frame processor already produces. Audio
//  still comes from VisionCamera's recording; we merge afterwards.
//

#import "CutoutRecorder.h"

#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <stdatomic.h>

@implementation CutoutRecorder {
  // Hot-path flag. Checked in appendBuffer before any other work so the
  // non-recording case is a single atomic load.
  atomic_bool _isRecording;

  // Writer state. All mutations happen on _writerQueue. The plugin's
  // appendBuffer dispatches synchronously to it so the per-frame work is
  // serialized against start/stop without us holding a lock on the camera
  // frame processor's queue (which would risk a deadlock if the writer
  // queue is also processing a Bridge call).
  dispatch_queue_t _writerQueue;
  AVAssetWriter *_writer;
  AVAssetWriterInput *_videoInput;
  AVAssetWriterInputPixelBufferAdaptor *_adaptor;

  NSURL *_outputURL;
  CMTime _sessionStart;            // PTS of first appended frame
  BOOL _sessionStarted;            // YES after [_writer startSessionAtSourceTime:]
  size_t _writerWidth;
  size_t _writerHeight;
  uint64_t _framesWritten;
  uint64_t _framesDropped;
}

RCT_EXPORT_MODULE();

+ (instancetype)shared {
  // Module instance is created by RN; we mirror it into a static so the
  // PersonCutoutPlugin (which lives outside the bridge) can reach the
  // same recorder instance. allocWithZone overrides the static on init.
  static CutoutRecorder *sShared;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ sShared = [[CutoutRecorder alloc] init]; });
  return sShared;
}

+ (id)allocWithZone:(NSZone *)zone {
  // RN re-instantiates the module on bridge reload. Keep the singleton
  // pointed at whichever instance was created most recently so [shared]
  // and the bridge see the same object.
  static CutoutRecorder *sInstance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ sInstance = [super allocWithZone:zone]; });
  return sInstance;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    atomic_init(&_isRecording, false);
    _writerQueue = dispatch_queue_create("com.bettips.cutoutrecorder.writer",
                                         DISPATCH_QUEUE_SERIAL);
    _sessionStart = kCMTimeInvalid;
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup { return NO; }

#pragma mark - Orientation → display transform

// Transform applied to the video track for player-side rotation. The
// composited pixels are in sensor (camera-buffer) orientation; the player
// uses this transform to rotate them to upright. We don't rotate pixels at
// encode time — that would force a CPU-side reblit per frame.
static CGAffineTransform TransformForOrientation(UIImageOrientation o) {
  switch (o) {
    case UIImageOrientationUp:
    case UIImageOrientationUpMirrored:
      return CGAffineTransformIdentity;
    case UIImageOrientationDown:
    case UIImageOrientationDownMirrored:
      return CGAffineTransformMakeRotation(M_PI);
    case UIImageOrientationLeft:
    case UIImageOrientationLeftMirrored:
      return CGAffineTransformMakeRotation(-M_PI_2);
    case UIImageOrientationRight:
    case UIImageOrientationRightMirrored:
      return CGAffineTransformMakeRotation(M_PI_2);
  }
  return CGAffineTransformIdentity;
}

#pragma mark - JS bridge: start

RCT_EXPORT_METHOD(startRecording:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (atomic_load(&_isRecording)) {
    reject(@"already_recording", @"CutoutRecorder is already recording.", nil);
    return;
  }

  // Empty path → auto-generate a UUID-stamped path under NSTemporaryDirectory.
  // Lets JS stay agnostic of the iOS filesystem layout; it just gets a path
  // back from the resolver and uses it.
  NSString *cleanPath;
  if (path.length == 0) {
    NSString *fileName =
        [NSString stringWithFormat:@"cutout-%@.mp4", [NSUUID UUID].UUIDString];
    cleanPath = [NSTemporaryDirectory() stringByAppendingPathComponent:fileName];
  } else if ([path hasPrefix:@"file://"]) {
    cleanPath = [[NSURL URLWithString:path] path];
  } else {
    cleanPath = path;
  }
  NSURL *url = [NSURL fileURLWithPath:cleanPath];

  // AVAssetWriter refuses to start if the output file already exists.
  [[NSFileManager defaultManager] removeItemAtURL:url error:nil];

  dispatch_async(_writerQueue, ^{
    self->_outputURL = url;
    self->_sessionStart = kCMTimeInvalid;
    self->_sessionStarted = NO;
    self->_writerWidth = 0;
    self->_writerHeight = 0;
    self->_framesWritten = 0;
    self->_framesDropped = 0;
    self->_writer = nil;
    self->_videoInput = nil;
    self->_adaptor = nil;
    atomic_store(&self->_isRecording, true);
    NSLog(@"[CutoutRecorder] startRecording → %@", url.path);
    resolve(@{ @"path" : url.path });
  });
}

#pragma mark - JS bridge: stop

RCT_EXPORT_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  // Flip the hot flag immediately so any in-flight frames after this point
  // are dropped before they touch the writer. Writer teardown then runs
  // on the writer queue.
  atomic_store(&_isRecording, false);

  dispatch_async(_writerQueue, ^{
    AVAssetWriter *w = self->_writer;
    AVAssetWriterInput *in = self->_videoInput;
    NSURL *out = self->_outputURL;
    uint64_t written = self->_framesWritten;
    uint64_t dropped = self->_framesDropped;

    if (w == nil || in == nil) {
      // start was called but no frames arrived — nothing to finalize.
      NSLog(@"[CutoutRecorder] stopRecording: writer never opened (no frames)");
      reject(@"no_frames", @"No frames were captured during recording.", nil);
      self->_writer = nil;
      self->_videoInput = nil;
      self->_adaptor = nil;
      self->_outputURL = nil;
      return;
    }

    [in markAsFinished];
    [w finishWritingWithCompletionHandler:^{
      NSLog(@"[CutoutRecorder] stopRecording: written=%llu dropped=%llu status=%ld",
            (unsigned long long)written, (unsigned long long)dropped, (long)w.status);
      if (w.status == AVAssetWriterStatusCompleted) {
        resolve(@{
          @"path" : out.path,
          @"framesWritten" : @(written),
          @"framesDropped" : @(dropped),
        });
      } else {
        NSError *err = w.error;
        reject(@"writer_failed",
               err.localizedDescription ?: @"AVAssetWriter did not complete.",
               err);
      }
    }];

    self->_writer = nil;
    self->_videoInput = nil;
    self->_adaptor = nil;
    self->_outputURL = nil;
  });
}

#pragma mark - JS bridge: merge audio

RCT_EXPORT_METHOD(mergeAudio:(NSString *)videoPath
                  audio:(NSString *)audioPath
                  output:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *cleanVideo = [videoPath hasPrefix:@"file://"]
      ? [[NSURL URLWithString:videoPath] path] : videoPath;
  NSString *cleanAudio = [audioPath hasPrefix:@"file://"]
      ? [[NSURL URLWithString:audioPath] path] : audioPath;
  NSString *cleanOutput;
  if (outputPath.length == 0) {
    NSString *fileName =
        [NSString stringWithFormat:@"merged-%@.mp4", [NSUUID UUID].UUIDString];
    cleanOutput = [NSTemporaryDirectory() stringByAppendingPathComponent:fileName];
  } else if ([outputPath hasPrefix:@"file://"]) {
    cleanOutput = [[NSURL URLWithString:outputPath] path];
  } else {
    cleanOutput = outputPath;
  }
  NSURL *videoURL = [NSURL fileURLWithPath:cleanVideo];
  NSURL *audioURL = [NSURL fileURLWithPath:cleanAudio];
  NSURL *outputURL = [NSURL fileURLWithPath:cleanOutput];

  [[NSFileManager defaultManager] removeItemAtURL:outputURL error:nil];

  AVAsset *videoAsset = [AVAsset assetWithURL:videoURL];
  AVAsset *audioAsset = [AVAsset assetWithURL:audioURL];

  AVAssetTrack *vTrack = [[videoAsset tracksWithMediaType:AVMediaTypeVideo] firstObject];
  AVAssetTrack *aTrack = [[audioAsset tracksWithMediaType:AVMediaTypeAudio] firstObject];
  if (vTrack == nil) {
    reject(@"no_video_track", @"Cutout video has no video track.", nil);
    return;
  }

  AVMutableComposition *comp = [AVMutableComposition composition];
  AVMutableCompositionTrack *compVideo =
      [comp addMutableTrackWithMediaType:AVMediaTypeVideo
                        preferredTrackID:kCMPersistentTrackID_Invalid];
  NSError *err = nil;
  [compVideo insertTimeRange:CMTimeRangeMake(kCMTimeZero, videoAsset.duration)
                     ofTrack:vTrack
                      atTime:kCMTimeZero
                       error:&err];
  if (err) {
    reject(@"video_track_failed", err.localizedDescription, err);
    return;
  }
  // Carry forward the writer's preferredTransform (set at startup from the
  // first frame's UIImageOrientation) so the final mp4 plays upright.
  compVideo.preferredTransform = vTrack.preferredTransform;

  if (aTrack != nil) {
    AVMutableCompositionTrack *compAudio =
        [comp addMutableTrackWithMediaType:AVMediaTypeAudio
                          preferredTrackID:kCMPersistentTrackID_Invalid];
    // Cap audio at video duration — VisionCamera's audio recording typically
    // starts a tiny fraction earlier (mic warm-up) and ends a tiny fraction
    // later than our video, but for typical 60-second tips the overlap is
    // ample and we don't need to hand-align beyond "start at zero".
    CMTime audioDur = CMTimeMinimum(videoAsset.duration, audioAsset.duration);
    [compAudio insertTimeRange:CMTimeRangeMake(kCMTimeZero, audioDur)
                       ofTrack:aTrack
                        atTime:kCMTimeZero
                         error:&err];
    if (err) {
      reject(@"audio_track_failed", err.localizedDescription, err);
      return;
    }
  } else {
    NSLog(@"[CutoutRecorder] mergeAudio: source had no audio track; producing video-only output");
  }

  AVAssetExportSession *exporter =
      [[AVAssetExportSession alloc] initWithAsset:comp
                                       presetName:AVAssetExportPresetHighestQuality];
  exporter.outputURL = outputURL;
  exporter.outputFileType = AVFileTypeMPEG4;
  exporter.shouldOptimizeForNetworkUse = YES;

  [exporter exportAsynchronouslyWithCompletionHandler:^{
    if (exporter.status == AVAssetExportSessionStatusCompleted) {
      resolve(@{ @"path" : outputURL.path });
    } else {
      NSError *e = exporter.error;
      reject(@"export_failed",
             e.localizedDescription ?: @"AVAssetExportSession did not complete.",
             e);
    }
  }];
}

#pragma mark - Plugin entry: per-frame append

- (void)appendBuffer:(CVPixelBufferRef)buffer
               width:(size_t)width
              height:(size_t)height
           timestamp:(CMTime)timestamp
         orientation:(UIImageOrientation)orientation
          isMirrored:(BOOL)isMirrored {
  // Hot-path fast exit. Single atomic load; no lock, no dispatch, no retain.
  if (!atomic_load(&_isRecording)) return;
  if (buffer == NULL || width == 0 || height == 0) return;

  // CVPixelBuffer must be retained across the dispatch boundary. The plugin
  // rotates between output buffers each frame, so by the time the writer
  // queue gets here, the next frame may already be rendering into the same
  // slot. Retain pins this frame's contents until append completes.
  CVPixelBufferRetain(buffer);

  dispatch_async(_writerQueue, ^{
    [self appendOnWriterQueue:buffer
                        width:width
                       height:height
                    timestamp:timestamp
                  orientation:orientation
                   isMirrored:isMirrored];
    CVPixelBufferRelease(buffer);
  });
}

- (void)appendOnWriterQueue:(CVPixelBufferRef)buffer
                      width:(size_t)width
                     height:(size_t)height
                  timestamp:(CMTime)timestamp
                orientation:(UIImageOrientation)orientation
                 isMirrored:(BOOL)isMirrored {
  // Re-check the flag inside the queue — stopRecording could have flipped
  // it after we dispatched but before we ran.
  if (!atomic_load(&_isRecording)) return;

  if (_writer == nil) {
    if (![self setUpWriterWithWidth:width
                             height:height
                        orientation:orientation
                         isMirrored:isMirrored]) {
      // Setup failed — flip flag so subsequent frames don't re-attempt.
      atomic_store(&_isRecording, false);
      return;
    }
  }

  if (!_sessionStarted) {
    _sessionStart = timestamp;
    [_writer startSessionAtSourceTime:timestamp];
    _sessionStarted = YES;
  }

  if (!_videoInput.isReadyForMoreMediaData) {
    _framesDropped++;
    return;
  }

  // The writer wants timestamps relative to the session start. We pass the
  // raw CMSampleBuffer PTS — startSessionAtSourceTime: was called with the
  // first PTS, so AVFoundation handles the offset itself.
  if (![_adaptor appendPixelBuffer:buffer withPresentationTime:timestamp]) {
    _framesDropped++;
    NSLog(@"[CutoutRecorder] adaptor append failed status=%ld err=%@",
          (long)_writer.status, _writer.error);
    return;
  }
  _framesWritten++;
}

- (BOOL)setUpWriterWithWidth:(size_t)width
                      height:(size_t)height
                 orientation:(UIImageOrientation)orientation
                  isMirrored:(BOOL)isMirrored {
  NSError *err = nil;
  AVAssetWriter *w = [[AVAssetWriter alloc] initWithURL:_outputURL
                                               fileType:AVFileTypeMPEG4
                                                  error:&err];
  if (w == nil || err != nil) {
    NSLog(@"[CutoutRecorder] AVAssetWriter init failed: %@", err);
    return NO;
  }

  // Bitrate scaled with pixel count. ~6 Mbps at 1080p is a reasonable
  // target for short tip videos — high enough to preserve cutout edge
  // detail, low enough to keep upload reasonable.
  NSInteger pixels = (NSInteger)(width * height);
  NSInteger avgBitrate = MAX(1500000, (NSInteger)(pixels * 3)); // ~6 Mbps @ 1080p

  NSDictionary *settings = @{
    AVVideoCodecKey : AVVideoCodecTypeH264,
    AVVideoWidthKey : @(width),
    AVVideoHeightKey : @(height),
    AVVideoCompressionPropertiesKey : @{
      AVVideoAverageBitRateKey : @(avgBitrate),
      AVVideoProfileLevelKey : AVVideoProfileLevelH264HighAutoLevel,
      AVVideoMaxKeyFrameIntervalKey : @(60),
    },
  };
  AVAssetWriterInput *in = [[AVAssetWriterInput alloc] initWithMediaType:AVMediaTypeVideo
                                                          outputSettings:settings];
  in.expectsMediaDataInRealTime = YES;
  in.transform = TransformForOrientation(orientation);

  NSDictionary *adaptorAttrs = @{
    (NSString *)kCVPixelBufferPixelFormatTypeKey : @(kCVPixelFormatType_32BGRA),
    (NSString *)kCVPixelBufferWidthKey : @(width),
    (NSString *)kCVPixelBufferHeightKey : @(height),
  };
  AVAssetWriterInputPixelBufferAdaptor *adaptor =
      [[AVAssetWriterInputPixelBufferAdaptor alloc] initWithAssetWriterInput:in
                                                 sourcePixelBufferAttributes:adaptorAttrs];

  if (![w canAddInput:in]) {
    NSLog(@"[CutoutRecorder] writer cannot add video input");
    return NO;
  }
  [w addInput:in];

  if (![w startWriting]) {
    NSLog(@"[CutoutRecorder] startWriting failed: %@", w.error);
    return NO;
  }

  _writer = w;
  _videoInput = in;
  _adaptor = adaptor;
  _writerWidth = width;
  _writerHeight = height;
  _sessionStarted = NO;
  NSLog(@"[CutoutRecorder] writer ready %lux%lu orientation=%ld mirrored=%d",
        (unsigned long)width, (unsigned long)height,
        (long)orientation, (int)isMirrored);
  return YES;
}

@end
