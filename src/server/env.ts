import { DEFAULT_LOCALE, isLocale } from "../shared/i18n";

// All configuration comes from the environment (bun loads .env in dev).
// Optional integrations fall back to dev-friendly behaviour when unset.

function opt(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

const isProd = process.env.NODE_ENV === "production";
const publicUrl = (opt("PUBLIC_URL") ?? (isProd ? "https://secretkrampus.party" : "http://localhost:5173")).replace(/\/$/, "");

const betterAuthSecret = opt("BETTER_AUTH_SECRET");
if (isProd && !betterAuthSecret) throw new Error("BETTER_AUTH_SECRET is required in production");

export const env = {
  isProd,
  port: Number(opt("PORT") ?? 3000),
  databasePath: opt("DATABASE_PATH") ?? "./data/krampus.db",
  dataDir: opt("DATA_DIR") ?? "./data",
  staticDir: opt("STATIC_DIR") ?? "./dist",
  publicUrl,
  betterAuthUrl: (opt("BETTER_AUTH_URL") ?? publicUrl).replace(/\/$/, ""),
  betterAuthSecret: betterAuthSecret ?? "dev-only-secret-change-me-in-production-please",
  adminEmails: (opt("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  resendApiKey: opt("RESEND_API_KEY"),
  emailFrom: opt("EMAIL_FROM") ?? "Secret Krampus <krampus@secretkrampus.party>",
  /** Console-mailer only: also append each email as a JSON line here (the e2e tests read login codes from it). */
  mailLog: opt("MAIL_LOG"),
  /** Language of a brand-new database (the admin can switch it any time). */
  defaultLocale: isLocale(opt("DEFAULT_LOCALE")) ? (opt("DEFAULT_LOCALE") as typeof DEFAULT_LOCALE) : DEFAULT_LOCALE,
  r2: {
    endpoint: opt("R2_ENDPOINT"),
    bucket: opt("R2_BUCKET"),
    accessKeyId: opt("R2_ACCESS_KEY_ID"),
    secretAccessKey: opt("R2_SECRET_ACCESS_KEY"),
    publicBaseUrl: opt("AVATAR_BASE_URL")?.replace(/\/$/, ""),
  },
};

export const r2Configured = Boolean(
  env.r2.endpoint && env.r2.bucket && env.r2.accessKeyId && env.r2.secretAccessKey && env.r2.publicBaseUrl,
);

export function isAdminEmail(email: string | null | undefined) {
  return !!email && env.adminEmails.includes(email.toLowerCase());
}
