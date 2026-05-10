import type { DrawingSegment } from "./types";

const GENERIC_ERROR_MSG =
  "Could not parse a path from this input. Paste a 'd' attribute value, a `<path>` element, or a full `<svg>` block.";
const OPEN_PATH_ERROR_MSG =
  "Open path detected! It will be closed automatically by connecting the end back to the start.";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type ParseResult =
  | { ok: true; points: Array<DrawingSegment>; warnings: Array<string> }
  | { ok: false; error: string };

export function parseSvgInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "" };
  }

  let doc: Document | null = null;

  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(trimmed, "image/svg+xml");

    if (doc.querySelector("parsererror")) {
      doc = null;
    }
  } catch {
    doc = null;
  }

  // sarmal metadata allows lossless import
  if (doc) {
    // querySelector('sarmal\\:source') is inconsistent across browsers for namespaced elements — getElementsByTagNameNS is reliable
    const sources = doc.getElementsByTagNameNS("https://sarmal.art/ns/1.0", "source");
    if (sources.length > 0) {
      const pointsAttr = sources[0]!.getAttribute("points");
      if (pointsAttr) {
        try {
          const parsed = JSON.parse(pointsAttr);
          if (isValidDrawingSegments(parsed)) {
            return { ok: true, points: parsed, warnings: [] };
          }
        } catch {
          // JSON parse failed, fall through to d extraction
        }
      }
    }
  }

  // `d` string extraction step
  let d = "";
  if (doc) {
    const path = doc.querySelector("path");
    const pathD = path?.getAttribute("d");
    if (pathD) {
      d = pathD.trim();
    }

    if (!d) {
      return {
        ok: false,
        error: GENERIC_ERROR_MSG,
      };
    }
  } else {
    d = trimmed;
  }

  const subpathResult = extractFirstSubpath(d);
  if ("error" in subpathResult) {
    return subpathResult;
  }

  const { firstSubpath, warnings } = subpathResult;

  // Sample with browser's SVGPathElement
  try {
    const points = samplePath(firstSubpath, 100);

    if (!points || points.length < 2) {
      return {
        ok: false,
        error: "This path has no length and cannot be animated.",
      };
    }

    return { ok: true, points, warnings };
  } catch {
    return {
      ok: false,
      error: GENERIC_ERROR_MSG,
    };
  }
}

function isValidDrawingSegments(value: unknown): value is DrawingSegment[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (pt) =>
      Array.isArray(pt) &&
      pt.length === 2 &&
      typeof pt[0] === "number" &&
      typeof pt[1] === "number",
  );
}

function extractFirstSubpath(
  d: string,
): { firstSubpath: string; warnings: string[] } | { ok: false; error: string } {
  const warnings: string[] = [];

  const mIndex = d.search(/[Mm]/);
  if (mIndex === -1) {
    return {
      ok: false,
      error: GENERIC_ERROR_MSG,
    };
  }

  const mMatches = d.match(/[Mm]/g);
  const subpathCount = mMatches ? mMatches.length : 0;

  let endIndex = -1;
  const afterM = d.slice(mIndex);
  const zMatch = afterM.match(/[Zz]/);

  if (zMatch && zMatch.index !== undefined) {
    endIndex = mIndex + zMatch.index + 1;
  } else {
    const restAfterFirst = afterM.slice(1);
    const nextMMatch = restAfterFirst.match(/[Mm]/);
    if (nextMMatch && nextMMatch.index !== undefined) {
      endIndex = mIndex + 1 + nextMMatch.index;
    }
  }

  let firstSubpath: string;
  if (endIndex === -1) {
    firstSubpath = d.slice(mIndex).trim();
    warnings.push(OPEN_PATH_ERROR_MSG);
  } else {
    firstSubpath = d.slice(mIndex, endIndex).trim();

    if (!zMatch || zMatch.index === undefined) {
      warnings.push(OPEN_PATH_ERROR_MSG);
    }
  }

  if (subpathCount > 1) {
    warnings.push(
      `This path contains ${subpathCount} subpaths. Only the first will be imported. The remaining ${subpathCount - 1} are ignored because the animation engine requires a single continuous loop.`,
    );
  }

  return { firstSubpath, warnings };
}

function samplePath(d: string, numPoints: number): DrawingSegment[] {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  svg.style.width = "0";
  svg.style.height = "0";

  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  // ! detached <path> elements return unreliable values from getTotalLength() in some browsers
  document.body.appendChild(svg);

  try {
    const totalLength = path.getTotalLength();
    if (totalLength === 0) {
      return [];
    }

    const rawPoints: DrawingSegment[] = [];
    const step = totalLength / numPoints;

    for (let i = 0; i < numPoints; i++) {
      const pt = path.getPointAtLength(i * step);
      rawPoints.push([pt.x, pt.y]);
    }

    return normalizePoints(rawPoints);
  } finally {
    document.body.removeChild(svg);
  }
}

function normalizePoints(points: Array<DrawingSegment>): Array<DrawingSegment> {
  if (points.length === 0) {
    return [];
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    if (x < minX) {
      minX = x;
    }

    if (x > maxX) {
      maxX = x;
    }

    if (y < minY) {
      minY = y;
    }

    if (y > maxY) {
      maxY = y;
    }
  }

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  if (rangeX === 0 && rangeY === 0) {
    return points;
  }

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const scale = Math.max(rangeX, rangeY) / 2;

  if (scale === 0) {
    return points;
  }

  return points.map(([x, y]) => [(x - midX) / scale, (y - midY) / scale]);
}
