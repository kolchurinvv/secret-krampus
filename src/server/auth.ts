import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "./db";
import { account, session, user, verification } from "./db/schema";
import { env } from "./env";
import { sendOtpEmail } from "./services/email";
import { ensureParticipantForUser } from "./services/participants";

// Passwordless: type your email, get a 6-digit code, type it in. The login is
// only there to tell people apart, so sessions are long (30 days).
export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  trustedOrigins: [env.publicUrl],
  database: drizzleAdapter(db, { provider: "sqlite", schema: { user, session, account, verification } }),
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
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
