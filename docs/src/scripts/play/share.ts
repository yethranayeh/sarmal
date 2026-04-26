import type { SharedState } from "./types";

export type ShareResult = { ok: true; url: string } | { ok: false; error: string };

export function captureImageBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const OG_W = 1200;
  const OG_H = 630;
  const PADDING = 65;

  const offscreen = document.createElement("canvas");
  offscreen.width = OG_W;
  offscreen.height = OG_H;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  ctx.fillStyle = "#fbf9f5";
  ctx.fillRect(0, 0, OG_W, OG_H);

  const available = Math.min(OG_W - PADDING * 2, OG_H - PADDING * 2);
  const scale = available / canvas.width;
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  const drawX = (OG_W - drawW) / 2;
  const drawY = (OG_H - drawH) / 2;
  ctx.drawImage(canvas, drawX, drawY, drawW, drawH);

  ctx.font = 'italic 22px "Newsreader", Georgia, serif';
  ctx.fillStyle = "#7a7067";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("sarmal.art", OG_W - 36, OG_H - 30);

  return new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, "image/png"));
}

export async function handleShare(
  canvas: HTMLCanvasElement,
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
