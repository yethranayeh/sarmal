import type { PlaygroundState } from "../playgroundState.svelte";
import type { CurveDef, SarmalOptions } from "@sarmal/core";

import { createSarmal, createSarmalDotMatrix, curves, drawCurve } from "@sarmal/core";

import { resolvePlaygroundRuntimeOptions } from "./serialize";

export type WebMRenderer = "standard" | "dotmatrix";

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
  const resolved = resolvePlaygroundRuntimeOptions(pg);
  return { ...resolved, autoStart: true };
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
  renderer?: WebMRenderer,
  dotCols?: number,
  dotRows?: number,
): Promise<Blob> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const clamped = Math.max(WEBM_MIN_DURATION, Math.min(WEBM_MAX_DURATION, durationSeconds));

  const curve = resolveWebMCurve(pg);
  const options = resolveWebMOptions(pg);

  const effectiveRenderer = renderer ?? "standard";
  const effectiveCols = dotCols ?? 32;
  const effectiveRows = dotRows ?? 32;

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

  const bgR = parseInt(bgColor.slice(1, 3), 16);
  const bgG = parseInt(bgColor.slice(3, 5), 16);
  const bgB = parseInt(bgColor.slice(5, 7), 16);

  const ctx = canvas.getContext("2d")!;
  const origClearRect = ctx.clearRect.bind(ctx);
  ctx.clearRect = (x: number, y: number, w: number, h: number) => {
    origClearRect(x, y, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
  };

  let instance: { destroy(): void } | null = null;

  const abortHandler = () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  };

  let recorder: MediaRecorder | null = null;

  try {
    if (effectiveRenderer === "dotmatrix") {
      const origPutImageData = ctx.putImageData.bind(ctx)
      ctx.putImageData = function (imageData: ImageData, dx: number, dy: number) {
        const data = imageData.data
        const len = data.length
        for (let i = 0; i < len; i += 4) {
          const a = data[i + 3]!
          if (a < 255) {
            const alphaFactor = a / 255
            const bgFactor = 1 - alphaFactor
            data[i] = Math.round(data[i]! * alphaFactor + bgR * bgFactor)
            data[i + 1] = Math.round(data[i + 1]! * alphaFactor + bgG * bgFactor)
            data[i + 2] = Math.round(data[i + 2]! * alphaFactor + bgB * bgFactor)
            data[i + 3] = 255
          }
        }
        origPutImageData(imageData, dx, dy)
      }

      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      instance = createSarmalDotMatrix(canvas, curve, {
        cols: effectiveCols,
        rows: effectiveRows,
        trailColor: options.trailColor ?? "#ffffff",
      });
    } else {
      instance = createSarmal(canvas, curve, options);
    }

    const stream = canvas.captureStream(WEBM_FPS);

    const codec = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    recorder = new MediaRecorder(stream, { mimeType: codec, videoBitsPerSecond: 8_000_000 });

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
