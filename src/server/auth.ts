import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "./db";
import { account, session, user, verification } from "./db/schema";
import { env } from "./env";
import { sendOtpEmail } from "./services/email";
import { ensureParticipantForUser } from "./services/participants";

/** The origin this request was addressed to (Traefik sets X-Forwarded-Proto). */
function ownOrigin(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

// Passwordless: type your email, get a 6-digit code, type it in. The login is
// only there to tell people apart, so sessions are long (30 days).
export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  // The configured URL, plus the server's own origin. The SPA is always served
  // by this same server, so a same-origin request is safe even when the app
  // is reached at another address than PUBLIC_URL: `just start` on :3000 with
  // a dev .env (PUBLIC_URL=…:5173), or a phone on the LAN. A cross-site
  // request still fails, because its Origin never matches this Host.
  trustedOrigins: (request) => [env.publicUrl, env.betterAuthUrl, request ? ownOrigin(request) : null],
  database: drizzleAdapter(db, { provider: "sqlite", schema: { user, session, account, verification } }),
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      // The plugin's production default is 3 requests per minute per IP for
      // sending a code and for signing in. At the party every guest shares the
      // venue Wi-Fi's public IP, so the 4th login in a minute would fail.
      // Guessing stays hopeless either way: 5 tries per 6-digit code.
      rateLimit: { window: 60, max: 20 },
      async sendVerificationOTP({ email, otp, type }) {
        // Not awaited on purpose (Better Auth's advice, avoids timing leaks).
        if (type === "sign-in") void sendOtpEmail(email, otp);
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          ensureParticipantForUser(u);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
