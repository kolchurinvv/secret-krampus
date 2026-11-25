import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getBunServer } from "@hono/bun";
import { currentVersion, subscribe } from "../events";
import { buildPublicState } from "../services/snapshot";

// The snapshot is built once per change and shared by every connection.
// serverNow is appended at send time so clients can sync reveal timelines.
let cache = { version: -1, json: "" };
function snapshotJson() {
  const v = currentVersion();
  if (cache.version !== v) {
    const { serverNow: _drop, ...rest } = buildPublicState();
    cache = { version: v, json: JSON.stringify(rest) };
  }
  return cache.json.slice(0, -1) + `,"serverNow":${Date.now()}}`;
}

export const live = new Hono()
  // Always fresh (the cache lags a change by up to the 30 ms notify debounce).
  .get("/state", (c) => c.json(buildPublicState()))
  .get("/stream", (c) => {
    // Bun closes connections idle for 10 s by default; this one must stay open.
    getBunServer<Bun.Server<undefined>>(c)?.timeout(c.req.raw, 0);
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache, no-transform");
    return streamSSE(c, async (stream) => {
      let unsubscribe = () => {};
      stream.onAbort(() => unsubscribe());
      await stream.writeSSE({ event: "state", data: snapshotJson() });
      unsubscribe = subscribe(() => {
        if (!stream.aborted) stream.writeSSE({ event: "state", data: snapshotJson() }).catch(() => {});
      });
      // Heartbeat keeps proxies (Traefik, Cloudflare) from timing the stream out.
      while (!stream.aborted) {
        await stream.sleep(20_000);
        if (!stream.aborted) await stream.writeSSE({ event: "ping", data: "" });
      }
      unsubscribe();
    });
  });
