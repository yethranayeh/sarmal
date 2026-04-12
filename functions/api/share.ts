interface Env {
  SARMAL_SHARES: KVNamespace;
}

interface SharedState {
  v: 1;
  code: string;
  trailStyle: string;
  palette: string;
  trailColor: string;
  headColor: string;
  trailLength: number;
  speed: number;
  showSkeleton: boolean;
}

const SHARE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const MAX_CODE_LENGTH = 4000;

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function isValidState(value: unknown): value is SharedState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    s.v === 1 && typeof s.code === "string" && s.code.length > 0 && s.code.length <= MAX_CODE_LENGTH
  );
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidState(body)) {
    return Response.json({ error: "Invalid state payload" }, { status: 400 });
  }

  const id = generateId();
  await env.SARMAL_SHARES.put(id, JSON.stringify(body), {
    expirationTtl: SHARE_TTL_SECONDS,
  });

  return Response.json({ id });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id || !/^[a-z0-9]{8}$/.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const value = await env.SARMAL_SHARES.get(id);

  if (!value) {
    return Response.json({ error: "Not found or expired" }, { status: 404 });
  }

  let state: unknown;
  try {
    state = JSON.parse(value);
  } catch {
    return Response.json({ error: "Corrupted state" }, { status: 500 });
  }

  return Response.json({ state });
};
