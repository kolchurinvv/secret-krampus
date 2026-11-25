// Outgoing email through Resend, or the server console when no API key is set
// (local dev: the login code shows up in the terminal).
import { appendFileSync } from "node:fs";
import { Resend } from "resend";
import { env } from "../env";
import { tr } from "../messages";
import { getState } from "./state";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;
export const emailMode: "resend" | "console" = resend ? "resend" : "console";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html lang="${getState().locale}"><body style="margin:0;background:#1b0f0f;font-family:Helvetica,Arial,sans-serif;color:#f5e9e9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#2a1515;border-radius:16px;border:1px solid #5c2a2a">
<tr><td style="padding:28px 28px 8px;font-size:28px;font-weight:bold;color:#ffca28">😈 ${esc(title)}</td></tr>
<tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.5">${body}</td></tr>
</table>
<p style="color:#a88;font-size:12px;margin-top:16px">${esc(tr().emailBrand)} · <a href="${env.publicUrl}" style="color:#a88">${esc(env.publicUrl.replace(/^https?:\/\//, ""))}</a></p>
</td></tr></table></body></html>`;
}

async function sendOne(to: string, subject: string, html: string, text: string) {
  if (!resend) {
    console.log(`\n📧 [console mailer] to=${to}\n   subject: ${subject}\n   ${text.replace(/\n/g, "\n   ")}\n`);
    if (env.mailLog) appendFileSync(env.mailLog, JSON.stringify({ to, subject, text, at: Date.now() }) + "\n");
    return;
  }
  const { error } = await resend.emails.send({ from: env.emailFrom, to, subject, html, text });
  if (error) throw new Error(error.message);
}

export async function sendOtpEmail(to: string, otp: string) {
  const m = tr();
  const subject = m.otpSubject(otp);
  const text = m.otpText(otp);
  const html = layout(
    m.otpTitle,
    `<p>${esc(m.otpIntro)}</p>
<p style="font-size:40px;letter-spacing:10px;font-weight:bold;color:#fff;text-align:center;margin:24px 0">${esc(otp)}</p>
<p style="color:#c9b">${esc(m.otpExpiry)}</p>`,
  );
  try {
    await sendOne(to, subject, html, text);
  } catch (err) {
    console.error("OTP email failed", to, err);
  }
}

export type AssignmentEmail = {
  giverId: string;
  to: string | null;
  giverName: string;
  receiverName: string;
  receiverWishlist: string;
  /** The match changed after an earlier email → "plot twist". */
  changed: boolean;
};

export type SendResult = { giverId: string; ok: true } | { giverId: string; ok: false; error: string };

function assignmentMessage(e: AssignmentEmail) {
  const m = tr();
  const subject = e.changed ? m.twistSubject : m.matchSubject;
  const wish = e.receiverWishlist.trim();
  // The intros carry a little HTML (<b>), so only the name is escaped.
  const intro = `<p>${e.changed ? m.twistIntro(esc(e.giverName)) : m.matchIntro(esc(e.giverName))}</p>`;
  const html = layout(
    e.changed ? m.twistTitle : m.matchTitle,
    `${intro}
<p style="font-size:30px;font-weight:bold;color:#fff;text-align:center;margin:24px 0">${esc(e.receiverName)}</p>
${wish ? `<p style="margin:0 0 4px;color:#c9b">${esc(m.theirWishlist)}</p><p style="background:#1b0f0f;border-radius:8px;padding:12px;white-space:pre-wrap">${esc(wish)}</p>` : ""}
<p>${m.keepSecret}</p>
<p><a href="${env.publicUrl}/me" style="color:#ffca28">${esc(m.seeItAgain)}</a></p>`,
  );
  const text =
    m.matchText(e.giverName, e.receiverName, e.changed) +
    (wish ? `\n${m.wishlistText(wish)}` : "") +
    `\n${m.keepSecretText} ${env.publicUrl}/me`;
  return { subject, html, text };
}

/** Sends assignment emails (Resend batch API, ≤100 per call). Never throws. */
export async function sendAssignmentEmails(jobs: AssignmentEmail[]): Promise<SendResult[]> {
  const results: SendResult[] = [];
  const sendable = jobs.filter((j) => {
    if (j.to) return true;
    results.push({ giverId: j.giverId, ok: false, error: tr().noEmailAddress });
    return false;
  });
  if (!resend) {
    for (const j of sendable) {
      const m = assignmentMessage(j);
      await sendOne(j.to!, m.subject, m.html, m.text);
      results.push({ giverId: j.giverId, ok: true });
    }
    return results;
  }
  for (let i = 0; i < sendable.length; i += 100) {
    const chunk = sendable.slice(i, i + 100);
    try {
      const { error } = await resend.batch.send(
        chunk.map((j) => ({ from: env.emailFrom, to: j.to!, ...assignmentMessage(j) })),
      );
      if (error) throw new Error(error.message);
      for (const j of chunk) results.push({ giverId: j.giverId, ok: true });
    } catch (err) {
      for (const j of chunk) results.push({ giverId: j.giverId, ok: false, error: (err as Error).message });
    }
  }
  return results;
}
