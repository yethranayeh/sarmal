export interface DemoScenarioAPI {
  start(onDone: () => void): void;
  cleanup(): void;
}

declare global {
  interface Window {
    demoRegistry: Record<string, DemoScenarioAPI>;
  }
}

export type DemoSlide = {
  id: string;
  color: string;
};

export const SLIDES: DemoSlide[] = [
  { id: "pipeline", color: "#2dd4bf" },
  { id: "chat", color: "#a78bfa" },
  { id: "upload", color: "#fb923c" },
  { id: "dashboard", color: "#38bdf8" },
] as const;

export function contentDuration(): number {
  return 2000 + Math.floor(Math.random() * 2000);
}
