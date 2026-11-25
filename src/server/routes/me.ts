import { Hono } from "hono";
import { body, requireUser, type AppEnv } from "../http";
import { updatePerson } from "../services/participants";
import { buildMeState } from "../services/snapshot";
import { castVote } from "../services/voting";
import { handleAvatarUpload } from "./avatar";

export const me = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", (c) => c.json(buildMeState(c.get("participant").id, c.get("user").email, c.get("isAdmin"))))
  .patch("/", async (c) => {
    const b = await body<{ name: unknown; wishlist: unknown }>(c.req);
    updatePerson(c.get("participant").id, { name: b.name, wishlist: b.wishlist });
    return c.json({ ok: true });
  })
  .post("/avatar", (c) => handleAvatarUpload(c, c.get("participant").id))
  .post("/vote", async (c) => {
    const b = await body<{ forId: unknown; score: unknown }>(c.req);
    castVote(c.get("participant").id, b.forId, b.score);
    return c.json({ ok: true });
  });
