import { Hono } from "hono";
import { body, requireAdmin, requireUser, type AppEnv } from "../http";
import { createPerson, deletePerson, updatePerson } from "../services/participants";
import { assign, resend, reshuffle, sendPending } from "../services/santa";
import { setLocale, setMessage, setScene } from "../services/scene";
import {
  award,
  createContest,
  deleteContest,
  removeFromEach,
  removeOne,
  setCount,
  setCurrentContest,
  undoLast,
} from "../services/scores";
import { buildAdminState } from "../services/snapshot";
import { closeRound, openVoting, resetVoting } from "../services/voting";
import { handleAvatarUpload } from "./avatar";

const ok = { ok: true } as const;

export const admin = new Hono<AppEnv>()
  .use(requireUser, requireAdmin)
  .get("/state", (c) => c.json(buildAdminState()))

  // People
  .post("/people", async (c) => {
    const b = await body(c.req);
    const p = createPerson({ name: b.name, email: b.email });
    return c.json({ ok: true, id: p.id });
  })
  .patch("/people/:id", async (c) => {
    const b = await body(c.req);
    updatePerson(c.req.param("id"), { name: b.name, email: b.email, inSanta: b.inSanta });
    return c.json(ok);
  })
  .delete("/people/:id", async (c) => {
    await deletePerson(c.req.param("id"));
    return c.json(ok);
  })
  .post("/people/:id/avatar", (c) => handleAvatarUpload(c, c.req.param("id")))

  // Secret Santa
  .post("/santa/assign", async (c) => {
    const b = await body<{ preferredGiverId: string | null }>(c.req);
    const r = assign(typeof b.preferredGiverId === "string" ? b.preferredGiverId : null);
    return c.json({ ok: true, ...r });
  })
  .post("/santa/reshuffle", (c) => {
    reshuffle();
    return c.json(ok);
  })
  .post("/santa/send-pending", async (c) => c.json({ ok: true, ...(await sendPending()) }))
  .post("/santa/resend/:giverId", async (c) => c.json({ ok: true, ...(await resend(c.req.param("giverId"))) }))

  // Krampus voting
  .post("/voting/open", (c) => {
    openVoting();
    return c.json(ok);
  })
  .post("/voting/close-round", (c) => {
    closeRound();
    return c.json(ok);
  })
  .post("/voting/reset", (c) => {
    resetVoting();
    return c.json(ok);
  })

  // Contests & stars
  .post("/contests", async (c) => {
    const b = await body(c.req);
    const ct = createContest(b.name, b.kind);
    return c.json({ ok: true, id: ct.id });
  })
  .delete("/contests/:id", (c) => {
    deleteContest(c.req.param("id"));
    return c.json(ok);
  })
  .post("/contests/current", async (c) => {
    const b = await body(c.req);
    setCurrentContest(b.id);
    return c.json(ok);
  })
  .post("/stars/award", async (c) => {
    const b = await body(c.req);
    return c.json({ ok: true, ...award(b.participantIds, b.contestId) });
  })
  .post("/stars/remove-one", async (c) => {
    const b = await body(c.req);
    removeOne(b.participantId);
    return c.json(ok);
  })
  .post("/stars/remove", async (c) => {
    const b = await body(c.req);
    return c.json({ ok: true, ...removeFromEach(b.participantIds, b.contestId) });
  })
  .post("/stars/undo-last", (c) => {
    undoLast();
    return c.json(ok);
  })
  .post("/stars/set", async (c) => {
    const b = await body(c.req);
    setCount(b.participantId, b.count);
    return c.json(ok);
  })

  // TV
  .post("/scene", async (c) => {
    const b = await body(c.req);
    setScene(b.kind, b.message);
    return c.json(ok);
  })
  .post("/locale", async (c) => {
    const b = await body(c.req);
    setLocale(b.locale);
    return c.json(ok);
  })
  .post("/message", async (c) => {
    const b = await body(c.req);
    setMessage(b.message);
    return c.json(ok);
  });
