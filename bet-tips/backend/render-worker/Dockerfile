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

# ffmpeg static binary (arm64). Using a pinned John Van Sickle release for
# reproducibility. The Lambda arch is set to arm64 in CDK.
ARG FFMPEG_URL=https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz

RUN dnf -y update \
  && dnf -y install tar xz dejavu-sans-fonts \
  && dnf clean all \
  && curl -fsSL "$FFMPEG_URL" -o /tmp/ffmpeg.tar.xz \
  && tar -C /tmp -xf /tmp/ffmpeg.tar.xz \
  && cp /tmp/ffmpeg-*-arm64-static/ffmpeg /usr/bin/ffmpeg \
  && cp /tmp/ffmpeg-*-arm64-static/ffprobe /usr/bin/ffprobe \
  && chmod +x /usr/bin/ffmpeg /usr/bin/ffprobe \
  && rm -rf /tmp/ffmpeg*

ENV FFMPEG_PATH=/usr/bin/ffmpeg \
    FONT_REG=/usr/share/fonts/dejavu/DejaVuSans.ttf \
    FONT_BOLD=/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf

# Install prod deps for AWS SDK (marked external in the esbuild step above).
COPY render-worker/package.json ${LAMBDA_TASK_ROOT}/
WORKDIR ${LAMBDA_TASK_ROOT}
RUN npm install --omit=dev

COPY --from=build /build/dist/index.js ${LAMBDA_TASK_ROOT}/

CMD ["index.handler"]
