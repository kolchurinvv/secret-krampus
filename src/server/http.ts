import { createMiddleware } from "hono/factory";
import { auth, type Session } from "./auth";
import { isAdminEmail } from "./env";
import { ensureParticipantForUser, type Participant } from "./services/participants";
import { tr } from "./messages";

export type AppEnv = {
  Variables: { user: Session["user"]; participant: Participant; isAdmin: boolean };
};

/** 401 unless signed in; exposes the user and their participant. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s) return c.json({ error: tr().notSignedIn }, 401);
  c.set("user", s.user);
  c.set("participant", ensureParticipantForUser(s.user));
  c.set("isAdmin", isAdminEmail(s.user.email));
  await next();
});

/** 403 unless the signed-in user's email is in ADMIN_EMAILS. Use after requireUser. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("isAdmin")) return c.json({ error: tr().adminsOnly }, 403);
  await next();
});

/** Reads a JSON body, treating an empty or invalid body as {}. */
export async function body<T = Record<string, unknown>>(req: { json: () => Promise<unknown> }): Promise<Partial<T>> {
  try {
    const b = await req.json();
    return (b && typeof b === "object" ? b : {}) as Partial<T>;
  } catch {
    return {};
  }
}
