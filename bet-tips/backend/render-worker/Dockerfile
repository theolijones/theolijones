FROM public.ecr.aws/lambda/nodejs:20 AS build
WORKDIR /build
COPY render-worker/package.json ./
RUN npm install --include=dev
COPY render-worker/tsconfig.json ./
COPY render-worker/src ./src
RUN npx esbuild src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/index.js \
  --external:@aws-sdk/*

FROM public.ecr.aws/lambda/nodejs:20

# ffmpeg static binary (arm64, GPL build with drawtext/libass/libfreetype).
# BtbN's builds are the standard choice for ffmpeg-in-docker and include
# all the text rendering filters we need.
ARG FFMPEG_URL=https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl.tar.xz

RUN dnf -y update \
  && dnf -y install tar xz dejavu-sans-fonts python3 python3-pip mesa-libGL \
  && dnf clean all \
  && curl -fsSL "$FFMPEG_URL" -o /tmp/ffmpeg.tar.xz \
  && tar -C /tmp -xf /tmp/ffmpeg.tar.xz \
  && cp /tmp/ffmpeg-master-latest-linuxarm64-gpl/bin/ffmpeg /usr/bin/ffmpeg \
  && cp /tmp/ffmpeg-master-latest-linuxarm64-gpl/bin/ffprobe /usr/bin/ffprobe \
  && chmod +x /usr/bin/ffmpeg /usr/bin/ffprobe \
  && rm -rf /tmp/ffmpeg*

# MediaPipe Selfie Segmentation + opencv for the person-cutout pipeline
# (segment.py reads frames from the input video, runs the segmenter, and
# pipes BGR raw frames to ffmpeg for h264 + audio mux).
#
# Lambda's Node 20 base image bundles an older libcrypto under /var/lang/lib
# and exports it via LD_LIBRARY_PATH. Python's _hashlib then loads the wrong
# OpenSSL and crashes. We unset LD_LIBRARY_PATH for pip install, and the Node
# handler also spawns python3 with LD_LIBRARY_PATH stripped at runtime.
RUN unset LD_LIBRARY_PATH \
  && python3 -m pip install --no-cache-dir \
      mediapipe \
      opencv-python-headless \
      numpy

ENV FFMPEG_PATH=/usr/bin/ffmpeg \
    FONT_REG=/usr/share/fonts/dejavu/DejaVuSans.ttf \
    FONT_BOLD=/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf

# Install prod deps for AWS SDK (marked external in the esbuild step above).
COPY render-worker/package.json ${LAMBDA_TASK_ROOT}/
WORKDIR ${LAMBDA_TASK_ROOT}
RUN npm install --omit=dev

COPY --from=build /build/dist/index.js ${LAMBDA_TASK_ROOT}/
COPY render-worker/src/segment.py ${LAMBDA_TASK_ROOT}/segment.py

# Bundled caption fonts (Inter, Oswald, Anton, Bebas Neue, Permanent Marker).
# The mobile app ships the identical TTFs so the editor preview matches the
# rendered video. Referenced via FONTS_DIR in index.ts.
COPY render-worker/fonts ${LAMBDA_TASK_ROOT}/fonts
ENV FONTS_DIR=${LAMBDA_TASK_ROOT}/fonts

CMD ["index.handler"]
