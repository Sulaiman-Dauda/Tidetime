import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export interface MailAttachment {
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

function transporter(): Transporter | null {
  if (!env.smtp.host) return null;
  if (cached) return cached;
  cached = createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
  });
  return cached;
}

/**
 * Send an email. If SMTP isn't configured, log to the console so local
 * development still surfaces what would have been sent (no silent failures).
 */
export async function sendMail(args: SendMailArgs): Promise<void> {
  const t = transporter();
  if (!t) {
    console.info(
      `\n[email:dev] To: ${args.to}\n[email:dev] Subject: ${args.subject}\n[email:dev] (SMTP not configured — set SMTP_HOST to deliver)\n`,
    );
    return;
  }

  try {
    await t.sendMail({
      from: env.smtp.from,
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
