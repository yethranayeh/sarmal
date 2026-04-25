interface Env {
  SARMAL_SHARES: KVNamespace;
}

interface SharedState {
  v: number;
  code: string;
  trailStyle: string;
  palette: string;
  trailColor: string;
  headColor: string;
  trailLength: number;
  speed: number;
  showSkeleton: boolean;
}

const SHARE_ID_RE = /^[a-z0-9]{8}$/;
const MAX_CODE_LENGTH = 4000;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function isValidState(value: unknown): value is SharedState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const s = value as Record<string, unknown>;
  return (
    s.v === 1 && typeof s.code === "string" && s.code.length > 0 && s.code.length <= MAX_CODE_LENGTH
  );
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Only intercept /play requests that reference a shared creation
  if (url.pathname !== "/play" || !url.searchParams.has("s")) {
    return context.next();
  }

  const shareId = url.searchParams.get("s");
  if (!shareId || !SHARE_ID_RE.test(shareId)) {
    return context.next();
  }

  // Fetch static HTML first so we can return it unchanged on any error
  const response = await context.next();

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  // Fetch share state from KV
  const kvValue = await context.env.SARMAL_SHARES.get(shareId);
  if (!kvValue) {
    return response;
  }

  let state: unknown;
  try {
    state = JSON.parse(kvValue);
  } catch {
    return response;
  }

  if (!isValidState(state)) {
    return response;
  }

  const html = await response.text();

  const title = "Shared Creation";
  const fullTitle = `${title} · Playground · Sarmal`;
  const description = "A custom parametric curve created on the Sarmal playground.";

  const safeTitle = escapeHtml(title);
  const safeFullTitle = escapeHtml(fullTitle);
  const safeDescription = escapeHtml(description);

  const safeShareUrl = escapeHtml(url.href);

  let modified = html
    .replace(
      /<meta property=["']og:url["'] content=["'][^"']*["']\s*\/?>/,
      `<meta property="og:url" content="${safeShareUrl}">`,
    )
    .replace(
      /<link rel=["']canonical["'] href=["'][^"']*["']\s*\/?>/,
      `<link rel="canonical" href="${safeShareUrl}">`,
    )
    .replace(
      /<meta property=["']og:title["'] content=["'][^"']*["']\s*\/?>/,
      `<meta property="og:title" content="${safeTitle}">`,
    )
    .replace(
      /<meta property=["']og:description["'] content=["'][^"']*["']\s*\/?>/,
      `<meta property="og:description" content="${safeDescription}">`,
    )
    .replace(
      /<meta name=["']twitter:title["'] content=["'][^"']*["']\s*\/?>/,
      `<meta name="twitter:title" content="${safeTitle}">`,
    )
    .replace(
      /<meta name=["']twitter:description["'] content=["'][^"']*["']\s*\/?>/,
      `<meta name="twitter:description" content="${safeDescription}">`,
    )
    .replace(
      /<meta name=["']description["'] content=["'][^"']*["']\s*\/?>/,
      `<meta name="description" content="${safeDescription}">`,
    )
    .replace(/<title>[^<]*<\/title>/, `<title>${safeFullTitle}</title>`);

  const newHeaders = new Headers(response.headers);
  newHeaders.delete("content-length");

  return new Response(modified, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};
