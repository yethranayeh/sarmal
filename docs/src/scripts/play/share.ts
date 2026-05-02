import type { SharedState } from "./types";

export type ShareResult = { ok: true; url: string } | { ok: false; error: string };

export function captureImageBlob(source: HTMLCanvasElement | SVGSVGElement): Promise<Blob | null> {
  const OG_W = 1200;
  const OG_H = 630;
  const PADDING = 65;

  if (source instanceof HTMLCanvasElement) {
    return captureCanvasBlob(source, OG_W, OG_H, PADDING);
  }

  return captureSVGBlob(source, OG_W, OG_H, PADDING);
}

function captureCanvasBlob(
  canvas: HTMLCanvasElement,
  OG_W: number,
  OG_H: number,
  PADDING: number,
): Promise<Blob | null> {
  const offscreen = document.createElement("canvas");
  offscreen.width = OG_W;
  offscreen.height = OG_H;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  ctx.fillStyle = "#fbf9f5";
  ctx.fillRect(0, 0, OG_W, OG_H);

  const available = Math.min(OG_W - PADDING * 2, OG_H - PADDING * 2);
  const scale = available / Math.max(canvas.width, canvas.height);
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  const drawX = (OG_W - drawW) / 2;
  const drawY = (OG_H - drawH) / 2;
  ctx.drawImage(canvas, drawX, drawY, drawW, drawH);

  drawWatermark(ctx, OG_W, OG_H);

  return new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, "image/png"));
}

function captureSVGBlob(
  svg: SVGSVGElement,
  OG_W: number,
  OG_H: number,
  PADDING: number,
): Promise<Blob | null> {
  const rect = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();

  return new Promise<Blob | null>((resolve) => {
    img.onload = () => {
      URL.revokeObjectURL(url);

      const offscreen = document.createElement("canvas");
      offscreen.width = OG_W;
      offscreen.height = OG_H;
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.fillStyle = "#fbf9f5";
      ctx.fillRect(0, 0, OG_W, OG_H);

      const available = Math.min(OG_W - PADDING * 2, OG_H - PADDING * 2);
      const scale = available / Math.max(img.width, img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (OG_W - drawW) / 2;
      const drawY = (OG_H - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      drawWatermark(ctx, OG_W, OG_H);

      offscreen.toBlob(resolve, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

function drawWatermark(ctx: CanvasRenderingContext2D, OG_W: number, OG_H: number) {
  ctx.font = 'italic 22px "Newsreader", Georgia, serif';
  ctx.fillStyle = "#7a7067";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("sarmal.art", OG_W - 36, OG_H - 30);
}

export async function handleShare(
  canvas: HTMLCanvasElement | SVGSVGElement,
  payload: SharedState,
): Promise<ShareResult> {
  const imageBlobPromise = captureImageBlob(canvas).catch(() => null);

  try {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`${res.status}`);
    }

    const { id } = (await res.json()) as { id: string };
    const url = `${window.location.origin}/play?s=${id}`;

    const imageBlob = await imageBlobPromise;

    await navigator.clipboard.writeText(url);

    if (imageBlob) {
      void fetch(`/api/share-image?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: imageBlob,
        keepalive: true,
      }).catch(() => {});
    }

    return { ok: true, url };
  } catch {
    return { ok: false, error: "Couldn't create link. Try again." };
  }
}
