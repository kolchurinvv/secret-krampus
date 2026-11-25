import { existsSync, readFileSync } from "node:fs";
import { expect, request, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export const BASE = "http://127.0.0.1:4173";
const MAIL_LOG = ".e2e/mail.log";

type Mail = { to: string; subject: string; text: string; at: number };

/** Every email the server "sent" (the console mailer writes them to .e2e/mail.log). */
export function mails(to?: string): Mail[] {
  if (!existsSync(MAIL_LOG)) return [];
  return readFileSync(MAIL_LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Mail)
    .filter((m) => !to || m.to === to);
}

/** The newest login code mailed to `email` at or after `since`. */
export async function codeFor(email: string, since: number): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      () => {
        code = mails(email)
          .filter((m) => m.at >= since)
          .map((m) => /(\d{6})\s*$/.exec(m.subject)?.[1]) // "…code: 123456" / "…Крампус: 123456"
          .filter(Boolean)
          .at(-1);
        return code;
      },
      { message: `login code for ${email}`, timeout: 5000 },
    )
    .toBeTruthy();
  return code!;
}

/** Signs in through the real login page. */
export async function loginUI(page: Page, email: string, name?: string) {
  const since = Date.now();
  await page.goto("/login");
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  const otp = await codeFor(email, since);
  await page.locator('input[autocomplete="one-time-code"]').fill(otp);
  if (name) await page.locator('input[autocomplete="name"]').fill(name);
  await page.getByRole("button", { name: "Let me in" }).click();
  await expect(page).toHaveURL(/\/me$/);
}

/** A signed-in API client (cookies kept in the context). */
export async function apiUser(email: string, name?: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE } });
  const since = Date.now();
  const sent = await ctx.post("/api/auth/email-otp/send-verification-otp", { data: { email, type: "sign-in" } });
  expect(sent.status(), await sent.text()).toBe(200);
  const otp = await codeFor(email, since);
  const signed = await ctx.post("/api/auth/sign-in/email-otp", { data: { email, otp, ...(name ? { name } : {}) } });
  expect(signed.status(), await signed.text()).toBe(200);
  return ctx;
}

export async function json<T = any>(ctx: APIRequestContext, method: "get" | "post" | "patch", path: string, data?: unknown): Promise<T> {
  const res = await ctx[method](path, data === undefined ? undefined : { data });
  expect(res.ok(), `${method.toUpperCase()} ${path} → ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

/** A browser page signed in as the same user as `api`. */
export async function pageAs(browser: Browser, api: APIRequestContext, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ storageState: await api.storageState(), viewport });
  return context.newPage();
}

/** In `just e2e-watch`, holds the screen so a person can see the moment. */
export async function watchPause(page: Page, ms: number) {
  if (process.env.E2E_WATCH) await page.waitForTimeout(ms);
}

/** Clicks the confirm button of the app's confirm dialog if one opens. */
export async function confirmIfAsked(page: Page) {
  const dialog = page.locator("dialog.sk-confirm.active");
  const opened = await dialog.waitFor({ state: "visible", timeout: 2000 }).then(
    () => true,
    () => false,
  );
  if (opened) await dialog.locator("button").last().click();
}
