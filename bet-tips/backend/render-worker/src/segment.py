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
import os
import subprocess
import sys
import threading

# matplotlib (pulled in transitively by some mediapipe builds) tries to mkdir a
# cache under $HOME, which is read-only in Lambda. Point it at /tmp before any
# import so it doesn't spew warnings on every invocation.
os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")

import cv2
import mediapipe as mp
import numpy as np


def _drain(stream, sink: list[str]) -> None:
    """Read a subprocess stream to EOF, mirroring to our stderr and capturing
    it so a failed ffmpeg's real error can be surfaced (segment.py only pipes
    ffmpeg's stdin, so without this its stderr is the only clue to why it died
    and it would otherwise be lost)."""
    for raw in iter(stream.readline, b""):
        line = raw.decode("utf-8", "replace")
        sink.append(line)
        sys.stderr.write(line)
    stream.close()


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
    pre = subprocess.run(
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
        capture_output=True,
    )
    if pre.returncode != 0:
        sys.stderr.write(pre.stderr.decode("utf-8", "replace"))
        print(f"ffmpeg orientation pre-pass failed (rc={pre.returncode})", file=sys.stderr)
        return pre.returncode

    cap = cv2.VideoCapture(normalized_path)
    if not cap.isOpened():
        print(f"failed to open {normalized_path}", file=sys.stderr)
        return 1

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # Read the first frame up front and take the encoder dimensions from the
    # decoded frame itself, NOT from CAP_PROP_FRAME_WIDTH/HEIGHT. After the
    # rotation bake those properties can disagree with the actual decoded frame
    # on some opencv/ffmpeg builds; a mismatch makes the rawvideo we feed ffmpeg
    # the wrong size. frame.shape is always the ground truth.
    ok, frame = cap.read()
    if not ok or frame is None:
        print("failed to read first frame", file=sys.stderr)
        return 1
    h, w = frame.shape[:2]
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
    print(f"segment.py: encoder dims={w}x{h} fps={fps:.3f}", file=sys.stderr)
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdin is not None and proc.stderr is not None
    ffmpeg_err: list[str] = []
    err_thread = threading.Thread(target=_drain, args=(proc.stderr, ffmpeg_err), daemon=True)
    err_thread.start()

    def composite(bgr_frame):
        rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        mask = selfie.process(rgb).segmentation_mask
        # Soft mask -> threshold + blur edges to reduce halo.
        mask = cv2.GaussianBlur(mask, (5, 5), 0)
        cond = np.stack((mask,) * 3, axis=-1) > args.threshold
        return np.where(cond, bgr_frame, bg).astype(np.uint8)

    frame_count = 0
    broken = False
    try:
        while True:
            try:
                proc.stdin.write(composite(frame).tobytes())
            except BrokenPipeError:
                broken = True
                break
            frame_count += 1
            ok, frame = cap.read()
            if not ok or frame is None:
                break
    finally:
        cap.release()
        selfie.close()
        try:
            proc.stdin.close()
        except Exception:
            pass

    rc = proc.wait()
    err_thread.join(timeout=5)
    tail = "".join(ffmpeg_err)[-1200:].strip()
    # A BrokenPipe with rc==0 is benign: ffmpeg legitimately finished (e.g. hit
    # `-shortest` because the audio track is shorter than the video) and closed
    # its stdin while we were mid-write on the final frame(s). Only a non-zero
    # ffmpeg exit is a real encode failure.
    if rc != 0:
        print(
            f"ffmpeg encode failed (rc={rc}, frames_written={frame_count}, "
            f"broken_pipe={broken}). ffmpeg stderr:\n{tail or '<empty>'}",
            file=sys.stderr,
        )
        return rc

    print(f"segment.py: wrote {frame_count} frames to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
