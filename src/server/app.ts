import { Hono } from "hono";
import { serveStatic } from "@hono/bun";
import { auth } from "./auth";
import { env } from "./env";
import { UserError } from "./errors";
import { admin } from "./routes/admin";
import { live } from "./routes/live";
import { me } from "./routes/me";
import { localAvatarDir, storageMode } from "./services/storage";

export const app = new Hono()
  .onError((err, c) => {
    if (err instanceof UserError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Something went wrong on our side." }, 500);
  })
  .get("/healthz", (c) => c.text("ok"))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .route("/api/live", live)
  .route("/api/me", me)
  .route("/api/admin", admin)
  .all("/api/*", (c) => c.json({ error: "Not found" }, 404));

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
  async (c, next) => (/\.[a-z0-9]+$/i.test(c.req.path) ? c.text("Not found", 404) : next()),
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
