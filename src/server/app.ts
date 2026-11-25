import { Hono } from "hono";
import { serveStatic } from "@hono/bun";
import { auth } from "./auth";
import { withClientIp } from "./client-ip";
import { env } from "./env";
import { UserError } from "./errors";
import { admin } from "./routes/admin";
import { live } from "./routes/live";
import { me } from "./routes/me";
import { localAvatarDir, storageMode } from "./services/storage";
import { tr } from "./messages";

export const app = new Hono()
  .onError((err, c) => {
    if (err instanceof UserError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: tr().serverError }, 500);
  })
  .get("/healthz", (c) => c.text("ok"))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(withClientIp(c.req.raw)))
  .route("/api/live", live)
  .route("/api/me", me)
  .route("/api/admin", admin)
  .all("/api/*", (c) => c.json({ error: tr().notFound }, 404));

if (storageMode === "local") {
  app.use(
    "/avatars/*",
    serveStatic({
      root: localAvatarDir,
      rewriteRequestPath: (p) => p.replace(/^\/avatars/, ""),
      onFound: (_p, c) => {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
}

// The built SPA: hashed assets cache forever, everything else falls back to
// index.html so client-side routes (/me, /admin, /live) work on reload.
app.use(
  "/*",
  serveStatic({
    root: env.staticDir,
    onFound: (path, c) => {
      c.header("Cache-Control", path.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    },
  }),
);
app.get(
  "*",
  // A missing *file* (an old /assets chunk after a rebuild, an absent
  // /sfx/*.mp3) must 404. Answering with index.html makes the browser try to
  // run HTML as a module, and the page silently renders nothing.
  // no-store: a CDN in front (the Cloudflare proxy) must not cache the miss either.
  async (c, next) =>
    /\.[a-z0-9]+$/i.test(c.req.path) ? c.text("Not found", 404, { "Cache-Control": "no-store" }) : next(),
  serveStatic({
    // `path` is resolved against `root`; an absolute path here would be joined
    // onto the default root and miss (STATIC_DIR is absolute in the image).
    root: env.staticDir,
    path: "index.html",
    onFound: (_p, c) => {
      c.header("Cache-Control", "no-cache");
    },
  }),
);
