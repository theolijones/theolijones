import { spawn } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { EdlBase, EdlImageLayer, EdlTextLayer } from "./edl";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const UPLOADS_TABLE = process.env.UPLOADS_TABLE!;
const MEDIA_BUCKET = process.env.MEDIA_BUCKET!;
const FFMPEG = process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg";
// Installed alongside ffmpeg by the Dockerfile, from the same pinned build.
const FFPROBE = process.env.FFPROBE_PATH ?? "/usr/bin/ffprobe";
const FONT_REG = process.env.FONT_REG ?? "/usr/share/fonts/dejavu/DejaVuSans.ttf";
const FONT_BOLD = process.env.FONT_BOLD ?? "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf";
// Bundled TTFs copied into the image by the Dockerfile (COPY render-worker/fonts).
const FONTS_DIR =
  process.env.FONTS_DIR ?? `${process.env.LAMBDA_TASK_ROOT ?? "/var/task"}/fonts`;
const WORK = "/tmp/render";

/** Map an EDL font key to a concrete .ttf path. The app ships the same files,
 *  so the editor preview and the rendered video use identical typefaces. */
const fontFileFor = (family: EdlTextLayer["fontFamily"]): string => {
  switch (family) {
    case "inter":
      return `${FONTS_DIR}/Inter.ttf`;
    case "oswald":
      return `${FONTS_DIR}/Oswald.ttf`;
    case "anton":
      return `${FONTS_DIR}/Anton.ttf`;
    case "bebas":
      return `${FONTS_DIR}/BebasNeue.ttf`;
    case "marker":
      return `${FONTS_DIR}/PermanentMarker.ttf`;
    case "system-bold":
      return FONT_BOLD;
    case "system":
    default:
      return FONT_REG;
  }
};

interface UploadRecord {
  uploadId: string;
  userId: string;
  videoKey: string;
  videoContentType?: string;
  edl?: EdlBase;
  assets?: { assetId: string; assetKey: string; contentType: string }[];
  renderStatus?: string;
  /** Display rotation last written by the rotate op, in degrees clockwise. */
  videoRotation?: number;
  /** Key of the pristine copy taken before the first rotate. */
  rotationBackupKey?: string;
}

interface RenderEvent {
  uploadId: string;
  op?: undefined;
}

interface RotateEvent {
  op: "rotate";
  uploadId: string;
  /** Degrees clockwise to apply on top of the rotation the file already
   *  declares. The admin sends the angle it applied in the preview, so the
   *  caller never has to know what the file currently says. */
  delta: number;
}

export interface RotateResult {
  previousRotation: number;
  rotation: number;
  backedUp: boolean;
}

export const handler = async (
  event: RenderEvent | RotateEvent
): Promise<void | RotateResult> => {
  if (event.op === "rotate") return rotateStoredVideo(event);

  const { uploadId } = event;
  if (!uploadId) throw new Error("uploadId required");

  const record = await loadRecord(uploadId);
  const edl = record.edl;
  if (!edl || (edl.layers.length === 0 && !edl.background)) {
    await updateStatus(uploadId, "not_required");
    return;
  }

  await updateStatus(uploadId, "rendering", { renderStartedAt: new Date().toISOString() });

  try {
    await mkdir(WORK, { recursive: true });
    const inputPath = `${WORK}/input${extFromKey(record.videoKey)}`;
    await downloadToFile(record.videoKey, inputPath);

    // Person-cutout step: if the EDL declares a background, run MediaPipe
    // segmentation + composite first; the result becomes the input for the
    // existing text/image overlay chain.
    let videoForOverlay = inputPath;
    if (edl.background) {
      const bgKey = edl.background.assetKey;
      if (!bgKey) {
        throw new Error("edl.background.assetKey is empty — submit pipeline did not fill it in");
      }
      const bgPath = `${WORK}/bg${extFromKey(bgKey) || ".png"}`;
      await downloadToFile(bgKey, bgPath);
      if (edl.background.mode === "segment") {
        const segmentedPath = `${WORK}/segmented.mp4`;
        await runSegmentation(inputPath, bgPath, segmentedPath);
        videoForOverlay = segmentedPath;
      }
    }

    const imageLayers = edl.layers.filter((l): l is EdlImageLayer => l.type === "image");
    const imagePaths = new Map<string, string>();
    for (const layer of imageLayers) {
      const path = `${WORK}/${layer.id}${extFromKey(layer.assetKey)}`;
      await downloadToFile(layer.assetKey, path);
      imagePaths.set(layer.id, path);
    }

    const outputPath = `${WORK}/output.mp4`;
    // When there are no overlay layers, skip the second ffmpeg pass and just
    // promote the segmented (or original) video directly. Saves a re-encode.
    if (edl.layers.length === 0) {
      const fs = await import("node:fs/promises");
      await fs.copyFile(videoForOverlay, outputPath);
    } else {
      const args = buildFfmpegArgs(videoForOverlay, edl, imagePaths, outputPath);
      await runFfmpeg(args);
    }

    const renderedKey = `renders/${record.userId}/${record.uploadId}/output.mp4`;
    const size = (await stat(outputPath)).size;
    const body = await readFile(outputPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: renderedKey,
        Body: body,
        ContentType: "video/mp4",
      })
    );

    await ddb.send(
      new UpdateCommand({
        TableName: UPLOADS_TABLE,
        Key: { uploadId },
        UpdateExpression:
          "SET renderStatus = :s, renderedVideoKey = :k, renderCompletedAt = :t, updatedAt = :t, renderSizeBytes = :sz REMOVE renderError",
        ExpressionAttributeValues: {
          ":s": "done",
          ":k": renderedKey,
          ":t": new Date().toISOString(),
          ":sz": size,
        },
      })
    );
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    console.error("render failed", message);
    await updateStatus(uploadId, "failed", {
      renderError: message,
      renderCompletedAt: new Date().toISOString(),
    });
    throw e;
  }
};

/**
 * Rewrite the display-rotation tag on the stored upload, in place.
 *
 * Exists because the recorder stamps a fixed rotation onto every file
 * regardless of how the phone was held, so landscape takes play sideways
 * everywhere downstream. Nothing in the container distinguishes a correctly
 * tagged portrait clip from a mis-tagged landscape one, so the correction has
 * to be driven by a human deciding in the admin — hence a delta, not a guess.
 *
 * `-c copy` means the encoded bitstream is untouched: only the container's
 * display matrix changes. Verified byte-identical video packets before and
 * after, so this is lossless and safe to apply repeatedly (rotating back by
 * the inverse restores the original tag exactly).
 */
const rotateStoredVideo = async (event: RotateEvent): Promise<RotateResult> => {
  const { uploadId, delta } = event;
  if (!uploadId) throw new Error("uploadId required");

  const record = await loadRecord(uploadId);
  await mkdir(WORK, { recursive: true });
  const ext = extFromKey(record.videoKey) || ".mp4";
  const inputPath = `${WORK}/rotate-in${ext}`;
  const outputPath = `${WORK}/rotate-out${ext}`;
  await downloadToFile(record.videoKey, inputPath);

  const previousRotation = await probeRotation(inputPath);
  const rotation = normalizeAngle(previousRotation + delta);

  // Keep one pristine copy the first time an upload is touched. The operation
  // is reversible on its own, but this is the only guard if the source is ever
  // rewritten by something less careful.
  const backupKey = `${record.videoKey}.original`;
  const backedUp = !record.rotationBackupKey;
  if (backedUp) {
    await s3.send(
      new CopyObjectCommand({
        Bucket: MEDIA_BUCKET,
        CopySource: `${MEDIA_BUCKET}/${record.videoKey}`,
        Key: backupKey,
      })
    );
  }

  // Explicit mapping rather than ffmpeg's defaults, so an upload that gained an
  // extra track can't silently lose audio here. `0:a?` keeps audio optional —
  // a cutout recording spliced without a mic would otherwise fail the copy.
  await runFfmpeg([
    "-y",
    "-v",
    "error",
    "-display_rotation",
    String(rotation),
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c",
    "copy",
    outputPath,
  ]);

  const written = await probeRotation(outputPath);
  if (written !== rotation) {
    throw new Error(
      `rotation tag not applied: asked for ${rotation}, file reports ${written}`
    );
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: record.videoKey,
      Body: await readFile(outputPath),
      ContentType: record.videoContentType ?? "video/mp4",
    })
  );

  await ddb.send(
    new UpdateCommand({
      TableName: UPLOADS_TABLE,
      Key: { uploadId },
      UpdateExpression:
        "SET videoRotation = :r, rotationBackupKey = :b, updatedAt = :t",
      ExpressionAttributeValues: {
        ":r": rotation,
        ":b": record.rotationBackupKey ?? backupKey,
        ":t": new Date().toISOString(),
      },
    })
  );

  console.log(
    `[rotate] ${uploadId} ${previousRotation}° + ${delta}° -> ${rotation}°`
  );
  return { previousRotation, rotation, backedUp };
};

/** Stream-level rotation in degrees, or 0 when the file declares none.
 *  `stream_side_data` (not `side_data`) yields one line for the stream rather
 *  than one per frame. */
const probeRotation = (filePath: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      FFPROBE,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream_side_data=rotation",
        "-of",
        "default=nw=1:nk=1",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited ${code}: ${stderr.slice(-400)}`));
        return;
      }
      const first = stdout.trim().split("\n")[0]?.trim();
      const parsed = first ? Number(first) : 0;
      resolve(Number.isFinite(parsed) ? parsed : 0);
    });
  });

/** Fold any angle into [0, 360). ffmpeg reports negatives (-90), and
 *  `-display_rotation` accepts either, but normalising keeps what we persist
 *  and compare against unambiguous. */
const normalizeAngle = (deg: number): number => ((deg % 360) + 360) % 360;

const loadRecord = async (uploadId: string): Promise<UploadRecord> => {
  const res = await ddb.send(
    new GetCommand({ TableName: UPLOADS_TABLE, Key: { uploadId } })
  );
  if (!res.Item) throw new Error(`upload ${uploadId} not found`);
  return res.Item as UploadRecord;
};

const updateStatus = async (
  uploadId: string,
  status: string,
  extra: Record<string, string | number> = {}
): Promise<void> => {
  const now = new Date().toISOString();
  const sets: string[] = ["renderStatus = :s", "updatedAt = :t"];
  const values: Record<string, unknown> = { ":s": status, ":t": now };
  for (const [k, v] of Object.entries(extra)) {
    const placeholder = `:${k}`;
    sets.push(`${k} = ${placeholder}`);
    values[placeholder] = v;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: UPLOADS_TABLE,
      Key: { uploadId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );
};

const downloadToFile = async (key: string, filePath: string): Promise<void> => {
  const res = await s3.send(new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }));
  const body = res.Body as Readable | undefined;
  if (!body) throw new Error(`empty body for ${key}`);
  await pipeline(body, createWriteStream(filePath));
};

const extFromKey = (key: string): string => {
  const dot = key.lastIndexOf(".");
  return dot >= 0 ? key.slice(dot) : "";
};

const escapeDrawtext = (text: string): string =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");

const buildFfmpegArgs = (
  inputPath: string,
  edl: EdlBase,
  imagePaths: Map<string, string>,
  outputPath: string
): string[] => {
  const args: string[] = ["-y", "-i", inputPath];
  const imageLayers = edl.layers.filter((l): l is EdlImageLayer => l.type === "image");
  for (const layer of imageLayers) {
    const path = imagePaths.get(layer.id);
    if (!path) continue;
    args.push("-i", path);
  }

  const canvasW = edl.width;
  const canvasH = edl.height;

  const filters: string[] = [];
  let lastLabel = "[0:v]";
  let imageInputIdx = 1;

  // Normalize pipeline: rescale the video to its declared canvas size so overlay math is consistent.
  filters.push(`${lastLabel}scale=${canvasW}:${canvasH},format=rgba[v0]`);
  lastLabel = "[v0]";

  let stepIdx = 1;
  const durationSec = Math.max(1, edl.durationMs / 1000).toFixed(3);

  for (const layer of edl.layers) {
    const startSec = (layer.startMs / 1000).toFixed(3);
    const endSec = (layer.endMs / 1000).toFixed(3);
    const enable = `between(t,${startSec},${endSec})`;
    const nextLabel = `[v${stepIdx}]`;
    const rotRad = (layer.rotation * Math.PI) / 180;
    const rotated = Math.abs(rotRad) > 0.001;

    if (layer.type === "text") {
      filters.push(
        ...buildTextFilterChain(
          layer,
          canvasW,
          canvasH,
          lastLabel,
          nextLabel,
          enable,
          durationSec,
          rotRad,
          stepIdx
        )
      );
    } else if (layer.type === "image") {
      const imgLabel = `[${imageInputIdx}:v]`;
      imageInputIdx++;
      const targetW = Math.round(layer.widthRatio * layer.scale * canvasW);
      const scaledLabel = `[img${stepIdx}s]`;
      const readyLabel = rotated ? `[img${stepIdx}r]` : `[img${stepIdx}]`;

      filters.push(`${imgLabel}scale=${targetW}:-1,format=rgba${scaledLabel}`);
      if (rotated) {
        filters.push(
          `${scaledLabel}rotate=${rotRad.toFixed(6)}:c=black@0:ow=rotw(${rotRad.toFixed(6)}):oh=roth(${rotRad.toFixed(6)})${readyLabel}`
        );
      } else {
        filters.push(`${scaledLabel}null${readyLabel}`);
      }

      const xExpr = `(W*${layer.x})-(overlay_w/2)`;
      const yExpr = `(H*${layer.y})-(overlay_h/2)`;
      filters.push(
        `${lastLabel}${readyLabel}overlay=x=${xExpr}:y=${yExpr}:enable='${enable}'${nextLabel}`
      );
    }

    lastLabel = nextLabel;
    stepIdx++;
  }

  const filterComplex = filters.join(";");
  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    lastLabel,
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath
  );
  return args;
};

const buildTextFilterChain = (
  layer: EdlTextLayer,
  canvasW: number,
  canvasH: number,
  inLabel: string,
  outLabel: string,
  enable: string,
  durationSec: string,
  rotRad: number,
  stepIdx: number
): string[] => {
  const fontFile = fontFileFor(layer.fontFamily);
  const fontSize = Math.max(8, Math.round(layer.fontSizeRatio * layer.scale * canvasH));
  const text = escapeDrawtext(layer.text);
  const color = sanitizeColor(layer.color) ?? "white";

  const drawtextBase = [
    `fontfile=${fontFile}`,
    `text='${text}'`,
    `fontsize=${fontSize}`,
    `fontcolor=${color}`,
  ];
  if (layer.background) {
    const bg = sanitizeColor(layer.background);
    if (bg) {
      drawtextBase.push(`box=1`, `boxcolor=${bg}`, `boxborderw=${Math.round(fontSize * 0.25)}`);
    }
  }
  // Stroke (glyph outline). Width scales with the font so it matches the
  // editor preview regardless of canvas size.
  if (layer.strokeColor) {
    const stroke = sanitizeColor(layer.strokeColor);
    if (stroke) {
      const w = Math.max(1, Math.round((layer.strokeWidthRatio ?? 0.08) * fontSize));
      drawtextBase.push(`borderw=${w}`, `bordercolor=${stroke}`);
    }
  }
  // Drop shadow.
  if (layer.shadowColor) {
    const shadow = sanitizeColor(layer.shadowColor);
    if (shadow) {
      const off = Math.max(1, Math.round((layer.shadowOffsetRatio ?? 0.06) * fontSize));
      drawtextBase.push(`shadowcolor=${shadow}`, `shadowx=${off}`, `shadowy=${off}`);
    }
  }

  const rotated = Math.abs(rotRad) > 0.001;

  if (!rotated) {
    // Fast path: draw directly onto the main stream. Positions reference the
    // full canvas (w/h inside drawtext).
    const xExpr =
      layer.align === "left"
        ? `(w*${layer.x})`
        : layer.align === "right"
          ? `(w*${layer.x})-text_w`
          : `(w*${layer.x})-(text_w/2)`;
    const yExpr = `(h*${layer.y})-(text_h/2)`;
    const parts = [
      ...drawtextBase,
      `x=${xExpr}`,
      `y=${yExpr}`,
      `enable='${enable}'`,
    ];
    return [`${inLabel}drawtext=${parts.join(":")}${outLabel}`];
  }

  // Rotated path: draw the text onto a transparent sub-canvas, rotate the
  // sub-canvas around its center, then overlay it at the user's position.
  const textLen = layer.text.length;
  const subW = Math.min(canvasW, Math.max(200, Math.round(textLen * fontSize * 0.7 + fontSize)));
  const subH = Math.max(40, Math.round(fontSize * 2));

  const bgLabel = `[textbg${stepIdx}]`;
  const drawnLabel = `[textdrawn${stepIdx}]`;
  const rotLabel = `[textrot${stepIdx}]`;

  const subDraw = [
    ...drawtextBase,
    `x=(w-text_w)/2`,
    `y=(h-text_h)/2`,
  ];

  const rotFixed = rotRad.toFixed(6);

  return [
    `color=c=black@0:s=${subW}x${subH}:d=${durationSec},format=rgba${bgLabel}`,
    `${bgLabel}drawtext=${subDraw.join(":")}${drawnLabel}`,
    `${drawnLabel}rotate=${rotFixed}:c=black@0:ow=rotw(${rotFixed}):oh=roth(${rotFixed})${rotLabel}`,
    `${inLabel}${rotLabel}overlay=x=(W*${layer.x})-(overlay_w/2):y=(H*${layer.y})-(overlay_h/2):enable='${enable}'${outLabel}`,
  ];
};

const sanitizeColor = (color: string): string | null => {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]+$/.test(trimmed)) return trimmed;
  return null;
};

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    console.log("ffmpeg", args.join(" "));
    const child = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });

const runSegmentation = (
  inputPath: string,
  bgPath: string,
  outputPath: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    console.log("segment.py", inputPath, "+", bgPath, "->", outputPath);
    const scriptPath = `${process.env.LAMBDA_TASK_ROOT ?? "/var/task"}/segment.py`;
    // Strip LD_LIBRARY_PATH so Python doesn't pick up the Node-bundled
    // libcrypto from /var/lang/lib (causes _hashlib import failures).
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    delete childEnv.LD_LIBRARY_PATH;
    const child = spawn(
      "python3",
      [scriptPath, "--input", inputPath, "--bg", bgPath, "--output", outputPath, "--ffmpeg", FFMPEG],
      { stdio: ["ignore", "pipe", "pipe"], env: childEnv }
    );
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`segment.py exited ${code}: ${stderr.slice(-800)}`));
    });
  });
