import type { PlaygroundState } from "../playgroundState.svelte";
import type { CurveDef, SarmalOptions } from "@sarmal/core";

import { createSarmal, curves, drawCurve } from "@sarmal/core";

const WEBM_MIN_DURATION = 1;
const WEBM_MAX_DURATION = 8;
const WEBM_FPS = 60;

export function resolveWebMCurve(pg: PlaygroundState): CurveDef {
  if (pg.currentMode === "draw") {
    const pts = pg.drawBoardRef?.getPoints();
    if (!pts || pts.length < 3) {
      throw new Error("Draw mode requires at least 3 points");
    }
    return { ...drawCurve(pts), speed: pg.speed };
  }

  if (pg.presetId) {
    const preset = curves[pg.presetId as keyof typeof curves];
    if (!preset) {
      throw new Error(`Preset "${pg.presetId}" not found`);
    }
    return { ...preset, speed: pg.speed };
  }

  if (!pg.lastCompiledFn) {
    throw new Error("No compiled curve");
  }

  return {
    name: "custom",
    fn: pg.lastCompiledFn,
    period: 2 * Math.PI,
    speed: pg.speed,
  };
}

export function resolveWebMOptions(pg: PlaygroundState): SarmalOptions {
  const opts: SarmalOptions = {
    trailColor: pg.resolvedTrailColor,
    skeletonColor: pg.resolvedSkeletonColor,
    trailStyle: pg.trailStyle,
    trailLength: pg.trailLength,
    autoStart: true,
  };

  if (!pg.headColorAuto) {
    opts.headColor = pg.headColor;
  }

  if (pg.headRadius !== null) {
    opts.headRadius = pg.headRadius;
  }

  return opts;
}

function getWebMPeriod(pg: PlaygroundState): number {
  if (pg.currentMode === "draw") {
    return 2 * Math.PI;
  }

  if (pg.presetId) {
    const preset = curves[pg.presetId as keyof typeof curves];
    return preset?.period ?? 2 * Math.PI;
  }

  return 2 * Math.PI;
}

export function getWebMDurationSeconds(pg: PlaygroundState): number {
  const period = getWebMPeriod(pg);
  const raw = period / pg.speed;
  return Math.max(WEBM_MIN_DURATION, Math.min(WEBM_MAX_DURATION, raw));
}

export function getWebMRawDurationSeconds(pg: PlaygroundState): number {
  return getWebMPeriod(pg) / pg.speed;
}

export async function recordWebM(
  pg: PlaygroundState,
  durationSeconds: number,
  signal?: AbortSignal,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const clamped = Math.max(WEBM_MIN_DURATION, Math.min(WEBM_MAX_DURATION, durationSeconds));

  const curve = resolveWebMCurve(pg);
  const options = resolveWebMOptions(pg);

  const previewRect = pg.previewRef.current?.getBoundingClientRect();
  const containerSize =
    previewRect && previewRect.width > 0 && previewRect.height > 0
      ? Math.max(previewRect.width, previewRect.height)
      : 400;

  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  const style = canvas.style;
  style.position = "fixed";
  style.left = "-9999px";
  style.top = "-9999px";
  style.visibility = "hidden";
  style.width = `${containerSize}px`;
  style.height = `${containerSize}px`;
  document.body.appendChild(canvas);

  canvas.width = containerSize * dpr;
  canvas.height = containerSize * dpr;

  const bgColor =
    getComputedStyle(document.documentElement).getPropertyValue("--color-background").trim() ||
    "#131311";

  const ctx = canvas.getContext("2d")!;
  const origClearRect = ctx.clearRect.bind(ctx);
  ctx.clearRect = (x: number, y: number, w: number, h: number) => {
    origClearRect(x, y, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
  };

  let instance: ReturnType<typeof createSarmal> | null = null;

  const abortHandler = () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  };

  let recorder: MediaRecorder | null = null;

  try {
    instance = createSarmal(canvas, curve, options);

    const stream = canvas.captureStream(WEBM_FPS);

    const codec = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    recorder = new MediaRecorder(stream, { mimeType: codec });

    signal?.addEventListener("abort", abortHandler);

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    let stopTimeout: ReturnType<typeof setTimeout> | null = null;

    const blob = await new Promise<Blob>((resolve, reject) => {
      const startTime = performance.now();
      const totalMs = clamped * 1000;

      const cleanup = () => {
        if (progressInterval !== null) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        if (stopTimeout !== null) {
          clearTimeout(stopTimeout);
          stopTimeout = null;
        }
      };

      recorder!.onstop = () => {
        cleanup();
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        resolve(new Blob(chunks, { type: "video/webm" }));
      };

      recorder!.onerror = () => {
        cleanup();
        reject(new Error("MediaRecorder error"));
      };

      recorder!.start();

      progressInterval = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(progressInterval!);
          progressInterval = null;
          return;
        }
        const elapsed = (performance.now() - startTime) / totalMs;
        onProgress?.(Math.min(elapsed, 1));
      }, 100);

      stopTimeout = setTimeout(() => {
        clearInterval(progressInterval!);
        progressInterval = null;
        if (recorder && recorder.state === "recording") {
          recorder.stop();
        }
      }, totalMs);
    });

    return blob;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    instance?.destroy();
    document.body.removeChild(canvas);
  }
}
