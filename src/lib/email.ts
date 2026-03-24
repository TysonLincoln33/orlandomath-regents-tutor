import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Support both env var names (we previously used EMAIL_FROM)
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM;

export async function sendSaveProgressEmail(opts: {
  to: string;
  name: string;
  resumeUrl: string;
  dashboardUrl: string;
}) {
  if (!RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is missing. Add it to .env.local (local) or your host environment variables (prod)."
    );
  }
  if (!FROM_EMAIL) {
    throw new Error(
      "FROM_EMAIL (or EMAIL_FROM) is missing. Example: OrlandoMath <noreply@contact.orlandomath.net>"
    );
  }

  const resend = new Resend(RESEND_API_KEY);

  const subject = "Your OrlandoMath resume link";

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4">
    <h2 style="margin:0 0 12px">Hi ${escapeHtml(opts.name)}!</h2>
    <p style="margin:0 0 12px">
      Here’s your personal resume link. You can use it on any device to pick up right where you left off.
    </p>
    <p style="margin:0 0 12px">
      <a href="${opts.resumeUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0b5fff;color:#fff;text-decoration:none">
        Resume your progress
      </a>
    </p>
    <p style="margin:0 0 12px">Or copy/paste this link:</p>
    <p style="margin:0 0 18px"><a href="${opts.resumeUrl}">${opts.resumeUrl}</a></p>

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0" />

    <p style="margin:0 0 12px">
      Want to keep practicing? Head back to your dashboard here:
      <a href="${opts.dashboardUrl}">${opts.dashboardUrl}</a>
    </p>
    <p style="margin:0;color:#666;font-size:12px">
      If you didn’t request this email, you can ignore it.
    </p>
  </div>
  `;

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject,
    html,
  });

  return result;
}

function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
