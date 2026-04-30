#!/usr/bin/env python3
"""Per-frame ML person segmentation + background composite. Cuts the
subject out of each frame and places them over the chosen background.

Reads `--input` video, runs MediaPipe Selfie Segmentation on each frame,
composites the person over `--bg` (resized to fill the video frame), then
streams the BGR raw frames to ffmpeg which encodes h264 + muxes the
original audio track. Output is `--output` (mp4).
"""
from __future__ import annotations
import argparse
import subprocess
import sys

import cv2
import mediapipe as mp
import numpy as np


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--bg", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ffmpeg", default="/usr/bin/ffmpeg")
    parser.add_argument("--threshold", type=float, default=0.4)
    args = parser.parse_args()

    # opencv ignores stream rotation metadata, so an iOS portrait clip read
    # raw is sideways. Re-encode through ffmpeg first to bake the rotation
    # (and any display matrix) into pixel orientation, drop the metadata.
    normalized_path = args.input + ".oriented.mp4"
    rc = subprocess.run(
        [
            args.ffmpeg, "-y", "-loglevel", "warning",
            "-i", args.input,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-metadata:s:v:0", "rotate=0",
            normalized_path,
        ],
        check=False,
    ).returncode
    if rc != 0:
        print(f"ffmpeg orientation pre-pass failed (rc={rc})", file=sys.stderr)
        return rc

    cap = cv2.VideoCapture(normalized_path)
    if not cap.isOpened():
        print(f"failed to open {normalized_path}", file=sys.stderr)
        return 1

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if w <= 0 or h <= 0:
        print(f"invalid dims {w}x{h}", file=sys.stderr)
        return 1

    bg = cv2.imread(args.bg, cv2.IMREAD_COLOR)
    if bg is None:
        print(f"failed to read bg {args.bg}", file=sys.stderr)
        return 1
    bg = cv2.resize(bg, (w, h))

    # model_selection=0 is the general model — works for full-body framing
    # (model_selection=1 is the upper-body selfie variant and clips legs/arms).
    selfie = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)

    ffmpeg_cmd = [
        args.ffmpeg, "-y", "-loglevel", "warning",
        "-f", "rawvideo", "-pix_fmt", "bgr24",
        "-s", f"{w}x{h}", "-r", f"{fps:.3f}", "-i", "-",
        "-i", normalized_path,
        "-map", "0:v", "-map", "1:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        args.output,
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None

    frame_count = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = selfie.process(rgb)
            mask = result.segmentation_mask
            # Soft mask -> threshold + blur edges to reduce halo.
            mask = cv2.GaussianBlur(mask, (5, 5), 0)
            cond = np.stack((mask,) * 3, axis=-1) > args.threshold
            out = np.where(cond, frame, bg).astype(np.uint8)
            proc.stdin.write(out.tobytes())
            frame_count += 1
    finally:
        cap.release()
        selfie.close()
        try:
            proc.stdin.close()
        except Exception:
            pass

    rc = proc.wait()
    if rc != 0:
        print(f"ffmpeg exited {rc}", file=sys.stderr)
        return rc

    print(f"segment.py: wrote {frame_count} frames to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
