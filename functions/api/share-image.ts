interface Env {
  SARMAL_SHARES: KVNamespace;
}

const SHARE_ID_RE = /^[a-z0-9]{8}$/;
const SHARE_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id || !SHARE_ID_RE.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const stateExists = await env.SARMAL_SHARES.get(id);
  if (!stateExists) {
    return Response.json({ error: "Share not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("image/png")) {
    return Response.json({ error: "Expected image/png" }, { status: 415 });
  }

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image too large" }, { status: 413 });
  }

  await Promise.all([
    env.SARMAL_SHARES.put(`ogimg:${id}`, buffer, { expirationTtl: SHARE_TTL_SECONDS }),
    env.SARMAL_SHARES.put(`og:${id}`, "1", { expirationTtl: SHARE_TTL_SECONDS }),
  ]);

  return new Response(null, { status: 204 });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id || !SHARE_ID_RE.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const buffer = await env.SARMAL_SHARES.get(`ogimg:${id}`, { type: "arrayBuffer" });
  if (!buffer) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
