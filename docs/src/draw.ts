import { createEngine, createRenderer, createSplineCurve, palettes } from "@sarmal/core";
import type { Point, SarmalInstance, TrailStyle } from "@sarmal/core";

// --- Configuration & State ---
const NODE_RADIUS = 8;
const HOVER_RADIUS = 12;
const GRID_SIZE = 40;

let points: Point[] = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 300 },
  { x: 100, y: 300 },
];

let draggingIdx: number | null = null;
let hoveredIdx: number | null = null;
let showSkeleton = true;
let trailLength = 120;
let speed = 1.1;
let trailStyle: TrailStyle = "default";
let paletteName: keyof typeof palettes = "bard";
let color = "#a78bfa";

let activeInstance: SarmalInstance | null = null;

// --- DOM Elements ---
const elements = {
  canvas: document.getElementById("draw-canvas") as HTMLCanvasElement,
  previewCanvas: document.getElementById("preview-canvas") as HTMLCanvasElement,
  codeOutput: document.getElementById("code-output") as HTMLElement,
  copyBtn: document.getElementById("copy-btn") as HTMLButtonElement,
  clearBtn: document.getElementById("clear-btn") as HTMLButtonElement,
  skeletonToggle: document.getElementById("skeleton-toggle") as HTMLButtonElement,
  trailSlider: document.getElementById("trail-slider") as HTMLInputElement,
  trailValue: document.getElementById("trail-value") as HTMLElement,
  speedSlider: document.getElementById("speed-slider") as HTMLInputElement,
  speedValue: document.getElementById("speed-value") as HTMLElement,
  colorInput: document.getElementById("color-input") as HTMLInputElement,
  trailStyleSelect: document.getElementById("trail-style-select") as HTMLSelectElement,
  paletteSelect: document.getElementById("palette-select") as HTMLSelectElement,
};

const ctx = elements.canvas.getContext("2d")!;

// --- Logic & Rendering ---

function getMousePos(e: MouseEvent | TouchEvent): Point {
  const rect = elements.canvas.getBoundingClientRect();
  const clientX = "touches" in e ? e.touches[0]!.clientX : (e as MouseEvent).clientX;
  const clientY = "touches" in e ? e.touches[0]!.clientY : (e as MouseEvent).clientY;

  return {
    x: ((clientX - rect.left) / rect.width) * elements.canvas.width,
    y: ((clientY - rect.top) / rect.height) * elements.canvas.height,
  };
}

function findNodeAt(pos: Point): number | null {
  const idx = points.findIndex((p) => {
    const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
    return dist < HOVER_RADIUS;
  });
  return idx === -1 ? null : idx;
}

function render() {
  updateUI();
  drawEditor();
  syncPreview();
}

function updateUI() {
  // Update labels
  elements.trailValue.textContent = trailLength.toString();
  elements.speedValue.textContent = speed.toFixed(1);

  // Generate code snippet
  const normPoints = points.map((p) => ({
    x: (p.x - elements.canvas.width / 2) / (elements.canvas.width / 4),
    y: (p.y - elements.canvas.height / 2) / (elements.canvas.height / 4),
  }));

  const ptsAttr = JSON.stringify(normPoints.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]));
  const colorAttr = trailStyle === "default" ? color : JSON.stringify(palettes[paletteName]);

  elements.codeOutput.textContent = `<canvas
  data-sarmal="custom"
  data-points='${ptsAttr}'
  data-trail-color='${colorAttr}'
  data-trail-length="${trailLength}"
  data-trail-style="${trailStyle}"
  data-speed="${speed.toFixed(1)}"
></canvas>`;

  // Toggle buttons
  elements.skeletonToggle.classList.toggle("bg-primary", showSkeleton);
  elements.skeletonToggle.classList.toggle("bg-border", !showSkeleton);
  const knob = elements.skeletonToggle.querySelector("span");
  knob?.classList.toggle("translate-x-5", showSkeleton);
  knob?.classList.toggle("translate-x-0", !showSkeleton);

  const isGradient = trailStyle !== "default";
  elements.paletteSelect.parentElement?.classList.toggle("hidden", !isGradient);
  elements.colorInput.parentElement?.classList.toggle("hidden", isGradient);
}

function drawEditor() {
  const { width, height } = elements.canvas;
  ctx.clearRect(0, 0, width, height);

  // Draw Grid
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y <= height; y += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  if (points.length < 2) return;

  const normPoints = points.map((p) => ({
    x: (p.x - width / 2) / (width / 4),
    y: (p.y - height / 2) / (height / 4),
  }));
  const spline = createSplineCurve(normPoints, { closed: true });

  // Draw Path Line
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const STEPS = 100;
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * spline.period!;
    const p = spline.fn(t, 0, {});
    const x = p.x * (width / 4) + width / 2;
    const y = p.y * (height / 4) + height / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Nodes
  points.forEach((p, i) => {
    const isHovered = hoveredIdx === i;
    const isDragging = draggingIdx === i;

    ctx.fillStyle = isDragging ? "#7c3aed" : isHovered ? "#a78bfa" : "#ffffff";
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    ctx.fillText((i + 1).toString(), p.x + 12, p.y - 12);
  });
}

function syncPreview() {
  if (activeInstance) {
    activeInstance.pause();
    activeInstance.destroy();
    activeInstance = null;
  }

  if (points.length < 2) return;

  const normPoints = points.map((p) => ({
    x: (p.x - elements.canvas.width / 2) / (elements.canvas.width / 4),
    y: (p.y - elements.canvas.height / 2) / (elements.canvas.height / 4),
  }));

  const splineDef = createSplineCurve(normPoints, {
    name: "Custom Path",
    speed: speed,
    closed: true,
  });

  const resolvedTrailColor =
    trailStyle === "default" ? color : (palettes[paletteName] ?? color);

  activeInstance = createRenderer({
    canvas: elements.previewCanvas,
    engine: createEngine(splineDef, trailLength),
    trailColor: resolvedTrailColor,
    skeletonColor: showSkeleton ? "#ffffff44" : "transparent",
    trailStyle: trailStyle,
  });
}

// --- Event Handlers ---

elements.canvas.addEventListener("mousedown", (e) => {
  const pos = getMousePos(e);
  const nodeIdx = findNodeAt(pos);

  if (nodeIdx !== null) {
    draggingIdx = nodeIdx;
  } else {
    points.push(pos);
  }
  render();
});

window.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e);
  hoveredIdx = findNodeAt(pos);

  if (draggingIdx !== null) {
    points[draggingIdx] = pos;
  }
  render();
});

window.addEventListener("mouseup", () => {
  draggingIdx = null;
  render();
});

elements.canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const pos = getMousePos(e);
  const nodeIdx = findNodeAt(pos);
  if (nodeIdx !== null) {
    points.splice(nodeIdx, 1);
    render();
  }
});

elements.clearBtn.addEventListener("click", () => {
  points = [];
  render();
});

elements.skeletonToggle.addEventListener("click", () => {
  showSkeleton = !showSkeleton;
  render();
});

elements.trailSlider.addEventListener("input", () => {
  trailLength = parseInt(elements.trailSlider.value, 10);
  render();
});

elements.speedSlider.addEventListener("input", () => {
  speed = parseFloat(elements.speedSlider.value);
  render();
});

elements.colorInput.addEventListener("input", () => {
  color = elements.colorInput.value;
  render();
});

elements.trailStyleSelect.addEventListener("change", () => {
  trailStyle = elements.trailStyleSelect.value as TrailStyle;
  render();
});

elements.paletteSelect.addEventListener("change", () => {
  paletteName = elements.paletteSelect.value as any;
  render();
});

elements.copyBtn.addEventListener("click", () => {
  const code = elements.codeOutput.textContent || "";
  navigator.clipboard.writeText(code);
  const originalText = elements.copyBtn.innerHTML;
  elements.copyBtn.innerHTML = "Copied!";
  setTimeout(() => (elements.copyBtn.innerHTML = originalText), 2000);
});

// --- Start ---
render();
