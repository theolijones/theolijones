import { spawn } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { EdlBase, EdlImageLayer, EdlTextLayer } from "./edl";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const UPLOADS_TABLE = process.env.UPLOADS_TABLE!;
const MEDIA_BUCKET = process.env.MEDIA_BUCKET!;
const FFMPEG = process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg";
const FONT_REG = process.env.FONT_REG ?? "/usr/share/fonts/dejavu/DejaVuSans.ttf";
const FONT_BOLD = process.env.FONT_BOLD ?? "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf";
const WORK = "/tmp/render";

interface UploadRecord {
  uploadId: string;
  userId: string;
  videoKey: string;
  videoContentType?: string;
  edl?: EdlBase;
  assets?: { assetId: string; assetKey: string; contentType: string }[];
  renderStatus?: string;
}

interface Event {
  uploadId: string;
}

export const handler = async (event: Event): Promise<void> => {
  const { uploadId } = event;
  if (!uploadId) throw new Error("uploadId required");

  const record = await loadRecord(uploadId);
  if (!record.edl || record.edl.layers.length === 0) {
    await updateStatus(uploadId, "not_required");
    return;
  }

  await updateStatus(uploadId, "rendering", { renderStartedAt: new Date().toISOString() });

  try {
    await mkdir(WORK, { recursive: true });
    const inputPath = `${WORK}/input${extFromKey(record.videoKey)}`;
    await downloadToFile(record.videoKey, inputPath);

    const imageLayers = record.edl.layers.filter((l): l is EdlImageLayer => l.type === "image");
    const imagePaths = new Map<string, string>();
    for (const layer of imageLayers) {
      const path = `${WORK}/${layer.id}${extFromKey(layer.assetKey)}`;
      await downloadToFile(layer.assetKey, path);
      imagePaths.set(layer.id, path);
    }

    const outputPath = `${WORK}/output.mp4`;
    const args = buildFfmpegArgs(inputPath, record.edl, imagePaths, outputPath);
    await runFfmpeg(args);

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
  const fontFile = layer.fontFamily === "system-bold" ? FONT_BOLD : FONT_REG;
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
