// Outgoing email through Resend, or the server console when no API key is set
// (local dev: the login code shows up in the terminal).
import { appendFileSync } from "node:fs";
import { Resend } from "resend";
import { env } from "../env";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;
export const emailMode: "resend" | "console" = resend ? "resend" : "console";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#1b0f0f;font-family:Helvetica,Arial,sans-serif;color:#f5e9e9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#2a1515;border-radius:16px;border:1px solid #5c2a2a">
<tr><td style="padding:28px 28px 8px;font-size:28px;font-weight:bold;color:#ffca28">😈 ${esc(title)}</td></tr>
<tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.5">${body}</td></tr>
</table>
<p style="color:#a88;font-size:12px;margin-top:16px">Secret Krampus · <a href="${env.publicUrl}" style="color:#a88">${esc(env.publicUrl.replace(/^https?:\/\//, ""))}</a></p>
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
  const subject = `Your Secret Krampus code: ${otp}`;
  const text = `Your login code is ${otp}. It expires in 10 minutes.`;
  const html = layout(
    "Your login code",
    `<p>Type this code into Secret Krampus:</p>
<p style="font-size:40px;letter-spacing:10px;font-weight:bold;color:#fff;text-align:center;margin:24px 0">${esc(otp)}</p>
<p style="color:#c9b">It expires in 10 minutes. If you didn't ask for it, ignore this email.</p>`,
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
  const subject = e.changed ? "🎁 Plot twist: your Secret Santa match changed" : "🎁 Your Secret Santa match is in";
  const wish = e.receiverWishlist.trim();
  const intro = e.changed
    ? `<p>Hi ${esc(e.giverName)}, someone joined the party late, so the elves had to reshuffle a little. <b>Forget the previous email</b> — you are now the Secret Santa for:</p>`
    : `<p>Hi ${esc(e.giverName)}, the elves have drawn the names. You are the Secret Santa for:</p>`;
  const html = layout(
    e.changed ? "Plot twist!" : "Ho ho ho!",
    `${intro}
<p style="font-size:30px;font-weight:bold;color:#fff;text-align:center;margin:24px 0">${esc(e.receiverName)}</p>
${wish ? `<p style="margin:0 0 4px;color:#c9b">Their wishlist:</p><p style="background:#1b0f0f;border-radius:8px;padding:12px;white-space:pre-wrap">${esc(wish)}</p>` : ""}
<p>Keep it secret. Choose wisely — the worst-rated gift of the night crowns its giver the <b>Secret Krampus</b>. 😈</p>
<p><a href="${env.publicUrl}/me" style="color:#ffca28">See it again any time on the site</a></p>`,
  );
  const text =
    `${e.changed ? "Plot twist! Your match changed. Forget the previous email. " : ""}` +
    `Hi ${e.giverName}, you are the Secret Santa for: ${e.receiverName}.` +
    (wish ? `\nTheir wishlist: ${wish}` : "") +
    `\nKeep it secret. ${env.publicUrl}/me`;
  return { subject, html, text };
}

/** Sends assignment emails (Resend batch API, ≤100 per call). Never throws. */
export async function sendAssignmentEmails(jobs: AssignmentEmail[]): Promise<SendResult[]> {
  const results: SendResult[] = [];
  const sendable = jobs.filter((j) => {
    if (j.to) return true;
    results.push({ giverId: j.giverId, ok: false, error: "No email address" });
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
