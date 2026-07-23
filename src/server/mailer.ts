import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import { getSmtpConfig } from "@/server/settings";
import { sha256 } from "@/lib/crypto";

interface MailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  icalEvent?: { method: string; content: string };
  attachments?: MailAttachment[];
}

let cached: Transporter | null = null;
let cachedKey = "";

async function resolveSmtp() {
  return getSmtpConfig();
}

async function transporter(): Promise<Transporter | null> {
  const smtp = await resolveSmtp();
  if (!smtp?.host) return null;
  // Include a one-way password fingerprint so rotating credentials replaces
  // the cached transporter instead of continuing to use the old secret.
  const key = `${smtp.host}:${smtp.port}:${smtp.user}:${sha256(smtp.pass)}`;
  if (cached && cachedKey === key) return cached;
  cached = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  cachedKey = key;
  return cached;
}

/**
 * Send an email. If SMTP isn't configured, log to the console so local
 * development still surfaces what would have been sent (no silent failures).
 */
export async function sendMail(args: SendMailArgs): Promise<void> {
  const t = await transporter();
  const smtp = await resolveSmtp();
  if (!t || !smtp) {
    console.info(
      `\n[email:dev] To: ${args.to}\n[email:dev] Subject: ${args.subject}\n[email:dev] (SMTP not configured — set in Settings → Email)\n`,
    );
    return;
  }

  try {
    await t.sendMail({
      from: smtp.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      icalEvent: args.icalEvent,
      attachments: args.attachments,
    });
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}
