const presetsDataElResult = document.getElementById("presets-data");
if (!presetsDataElResult) {
  throw new Error("presets-data element not found");
}
export const presetsDataEl = presetsDataElResult;

export const codeInput = document.getElementById("code-input") as HTMLTextAreaElement;
export const errorDisplay = document.getElementById("error-display") as HTMLElement;
export const previewCanvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
export const presetSelect = document.getElementById("preset-select") as HTMLSelectElement;
export const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
export const shareBtn = document.getElementById("share-btn") as HTMLButtonElement;
export const shareStatus = document.getElementById("share-status") as HTMLElement;
export const skeletonToggle = document.getElementById("skeleton-toggle") as HTMLButtonElement;
export const speedSlider = document.getElementById("speed-slider") as HTMLInputElement;
export const speedValue = document.getElementById("speed-value") as HTMLElement;
export const trailSlider = document.getElementById("trail-slider") as HTMLInputElement;
export const trailValue = document.getElementById("trail-value") as HTMLElement;
export const colorInput = document.getElementById("color-input") as HTMLInputElement;
export const headColorInput = document.getElementById("head-color-input") as HTMLInputElement;
export const headColorAutoCheckbox = document.getElementById("head-color-auto") as HTMLInputElement;
export const trailStyleSelect = document.getElementById("trail-style-select") as HTMLSelectElement;
export const paletteSelect = document.getElementById("palette-select") as HTMLSelectElement;
export const paletteContainer = document.getElementById("palette-container") as HTMLDivElement;
export const colorControlsDiv = document.getElementById("color-controls") as HTMLDivElement;
export const palettePreview = document.getElementById("palette-preview") as HTMLDivElement;
