import type { SharedState } from "./state";

import { headColorInput, previewCanvas, shareBtn, shareStatus } from "./dom";
import { state } from "./state";
import { getParams } from "./renderer";

export function setShareStatus(text: string) {
  shareStatus.textContent = text;
  shareStatus.classList.toggle("hidden", text === "");
}

export function captureImageBlob(): Promise<Blob | null> {
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
  const scale = available / previewCanvas.width;
  const drawW = previewCanvas.width * scale;
  const drawH = previewCanvas.height * scale;
  const drawX = (OG_W - drawW) / 2;
  const drawY = (OG_H - drawH) / 2;
  ctx.drawImage(previewCanvas, drawX, drawY, drawW, drawH);

  ctx.font = 'italic 22px "Newsreader", Georgia, serif';
  ctx.fillStyle = "#7a7067";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("sarmal.art", OG_W - 36, OG_H - 30);

  return new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, "image/png"));
}

export async function handleShare() {
  if (!state.currentCode) {
    return;
  }

  const imageBlobPromise = captureImageBlob().catch(() => null);

  const params = getParams();
  const sharedState: SharedState = {
    v: 1,
    code: state.currentCode,
    trailStyle: params.trailStyle,
    palette: params.palette,
    trailColor: params.trailColor,
    headColor: params.headColor ?? headColorInput.value,
    headColorAuto: params.headColorAuto,
    trailLength: params.trailLength,
    speed: params.speed,
    showSkeleton: state.showSkeleton,
  };

  shareBtn.disabled = true;
  setShareStatus("");

  try {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sharedState),
    });

    if (!res.ok) {
      throw new Error(`${res.status}`);
    }

    const { id } = (await res.json()) as { id: string };
    const url = `${window.location.origin}/play?s=${id}`;

    const imageBlob = await imageBlobPromise;

    await navigator.clipboard.writeText(url);

    setShareStatus("Link copied. Expires in 90 days.");
    setTimeout(() => {
      shareBtn.disabled = false;
      setShareStatus("");
    }, 3000);

    if (imageBlob) {
      void fetch(`/api/share-image?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: imageBlob,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    shareBtn.disabled = false;
    setShareStatus("Couldn't create link. Try again.");
    setTimeout(() => setShareStatus(""), 4000);
  }
}
