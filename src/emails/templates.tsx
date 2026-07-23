import * as React from "react";
import { env } from "@/lib/env";
import { getAppUrl } from "@/server/app-url";

/**
 * React Email templates — a maintainable, component-based replacement for the
 * old inline-HTML strings. Rendered to HTML in `@/server/emails` via
 * `@react-email/render`.
 *
 * Layout is deliberately table-based and centered so it survives Outlook (which
 * ignores `max-width`/`margin:auto` on divs) — the `<table align="center">`
 * technique centers the card in every client. A `<head>` media-query block makes
 * the card and its buttons stack full-width on small screens. The instance brand
 * (`env.appName`) shows in the header; every email carries a "Powered by
 * Tidetime" footer.
 */

const ACCENT = "#0f172a";
const MAX_WIDTH = 600;

type ElementProps = {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  href?: string;
};

const Html = ({ children }: ElementProps) => <html lang="en">{children}</html>;
const Body = ({ children, style }: ElementProps) => <body style={style}>{children}</body>;
const Section = ({ children, style }: ElementProps) => <div style={style}>{children}</div>;
const Heading = ({ children, style }: ElementProps) => <h1 style={style}>{children}</h1>;
const Text = ({ children, style }: ElementProps) => <p style={style}>{children}</p>;
const Link = ({ children, style, href }: ElementProps) => (
  <a href={href} style={style}>{children}</a>
);
const Hr = ({ style }: ElementProps) => <hr style={style} />;
const Preview = ({ children }: ElementProps) => (
  <span style={{ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 }}>
    {children}
  </span>
);

// Client-side responsive rules. Desktop styles stay inline (widely supported);
// these overrides only fire on narrow viewports that honour <style> blocks
// (iOS Mail, Gmail app, Apple Mail, etc.) so the card and buttons never squeeze.
const RESPONSIVE_CSS = `
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  table { border-collapse:collapse; }
  a { text-decoration:none; }
  img { border:0; line-height:100%; outline:none; -ms-interpolation-mode:bicubic; }
  @media only screen and (max-width:620px) {
    .tt-container { width:100% !important; max-width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .tt-pad { padding-left:22px !important; padding-right:22px !important; }
    .tt-btn { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
    .tt-rsvp { display:block !important; width:100% !important; padding:0 0 10px 0 !important; }
    .tt-rsvp-btn { display:block !important; width:100% !important; box-sizing:border-box !important; }
    .tt-label { display:block !important; width:100% !important; padding:6px 0 0 !important; }
    .tt-value { display:block !important; width:100% !important; padding:2px 0 8px !important; }
  }
`;

const Head = () => (
  // This is a standalone email document, not a Next.js page — a real <head> is
  // required; next/head does not apply here.
  // eslint-disable-next-line @next/next/no-head-element
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />
  </head>
);

const styles = {
  body: { margin: 0, backgroundColor: "#f6f7f9", fontFamily: "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", color: "#0f172a" } as const,
  outer: { backgroundColor: "#f6f7f9" } as const,
  container: { width: `${MAX_WIDTH}px`, maxWidth: `${MAX_WIDTH}px`, backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden", margin: "0 auto" } as const,
  header: { padding: "20px 28px", borderBottom: "1px solid #eef2f6" } as const,
  brand: { fontWeight: 600, fontSize: "16px", letterSpacing: "-0.01em", margin: 0, color: "#0f172a" } as const,
  content: { padding: "28px" } as const,
  heading: { margin: "0 0 6px", fontSize: "20px", letterSpacing: "-0.02em" } as const,
  intro: { margin: "0 0 20px", color: "#475569", fontSize: "14px", lineHeight: "1.5" } as const,
  card: { border: "1px solid #eef2f6", borderRadius: "10px", padding: "8px 16px", marginBottom: "22px" } as const,
  label: { color: "#64748b", fontSize: "13px", width: "120px", verticalAlign: "top", padding: "6px 0", margin: 0 } as const,
  value: { fontSize: "14px", fontWeight: 500, padding: "6px 0", margin: 0 } as const,
  footer: { padding: "18px 28px", borderTop: "1px solid #eef2f6", color: "#94a3b8", fontSize: "12px", textAlign: "center", lineHeight: "1.6" } as const,
  footerLink: { color: "#64748b", fontWeight: 600, textDecoration: "none" } as const,
};

/** Bulletproof, table-wrapped CTA button — Outlook honours the padding, and the
 *  `.tt-btn` class makes it full-width on mobile. */
function CtaButton({
  href,
  label,
  bg = ACCENT,
  color = "#ffffff",
}: {
  href: string;
  label: string;
  bg?: string;
  color?: string;
}) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ margin: "4px 0 0" }}>
      <tbody>
        <tr>
          <td align="center" style={{ backgroundColor: bg, borderRadius: "8px" }}>
            <a
              href={href}
              className="tt-btn"
              style={{
                display: "inline-block",
                backgroundColor: bg,
                color,
                fontSize: "14px",
                fontWeight: 500,
                padding: "12px 24px",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              {label}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

async function Shell({ preview, children }: { preview: string; children: React.ReactNode }) {
  const appUrl = await getAppUrl();
  const host = appUrl.replace(/^https?:\/\//, "");
  return (
    <Html>
      <Head />
      <Body style={styles.body}>
        <Preview>{preview}</Preview>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={styles.outer}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 12px" }}>
                <table
                  role="presentation"
                  align="center"
                  width={MAX_WIDTH}
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  className="tt-container"
                  style={styles.container}
                >
                  <tbody>
                    <tr>
                      <td className="tt-pad" style={styles.header}>
                        <Text style={styles.brand}>{env.appName}</Text>
                      </td>
                    </tr>
                    <tr>
                      <td className="tt-pad" style={styles.content}>
                        {children}
                      </td>
                    </tr>
                    <tr>
                      <td className="tt-pad" style={styles.footer}>
                        Powered by{" "}
                        <Link href={appUrl} style={styles.footerLink}>
                          Tidetime
                        </Link>
                        {" · "}
                        <Link href={appUrl} style={{ color: "#94a3b8", textDecoration: "none" }}>
                          {host}
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td className="tt-label" style={styles.label}>{label}</td>
          <td className="tt-value" style={styles.value}>{children}</td>
        </tr>
      </tbody>
    </table>
  );
}

export interface BookingEmailProps {
  heading: string;
  intro: string;
  accent?: string;
  title: string;
  when: string;
  timeZone: string;
  hostName: string;
  attendeeName: string;
  /** primary attendee's email, shown under their name in the Who row */
  attendeeEmail?: string | null;
  location: string;
  meetingUrl: string | null;
  description?: string | null;
  /** answers to the service's custom booking questions, in form order */
  answers?: { label: string; value: string }[];
  manageUrl: string;
  manageLabel?: string;
  /** signed Accept / Decline / Tentative links — when present, an RSVP row renders */
  rsvp?: { accept: string; decline: string; tentative: string } | null;
}

const rsvpBase: React.CSSProperties = {
  display: "inline-block",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "center",
  fontSize: "13px",
  fontWeight: 500,
  padding: "11px 8px",
  borderRadius: "8px",
  textDecoration: "none",
};

const rsvpStyles = {
  accept: { ...rsvpBase, backgroundColor: "#16a34a", color: "#ffffff" } as React.CSSProperties,
  tentative: { ...rsvpBase, backgroundColor: "#f1f5f9", color: "#0f172a" } as React.CSSProperties,
  decline: { ...rsvpBase, backgroundColor: "#fef2f2", color: "#b91c1c" } as React.CSSProperties,
};

export function BookingEmail(p: BookingEmailProps) {
  return (
    <Shell preview={p.heading}>
      <Heading style={{ ...styles.heading, color: p.accent ?? ACCENT }}>{p.heading}</Heading>
      <Text style={styles.intro}>{p.intro}</Text>
      <Section style={styles.card}>
        <DetailRow label="What">{p.title}</DetailRow>
        <DetailRow label="When">
          {p.when} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({p.timeZone.replace(/_/g, " ")})</span>
        </DetailRow>
        <DetailRow label="Who">
          <span style={{ display: "block" }}>
            {p.hostName} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· Host</span>
          </span>
          <span style={{ display: "block" }}>
            {p.attendeeName}
            {p.attendeeEmail ? (
              <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {p.attendeeEmail}</span>
            ) : null}
          </span>
        </DetailRow>
        <DetailRow label="Where">
          {p.meetingUrl ? (
            <Link href={p.meetingUrl} style={{ color: "#2563eb" }}>
              {p.location || "Join meeting"}
            </Link>
          ) : (
            p.location
          )}
        </DetailRow>
        {p.description ? <DetailRow label="Notes">{p.description}</DetailRow> : null}
        {(p.answers ?? []).map((answer) => (
          <DetailRow key={answer.label} label={answer.label}>{answer.value}</DetailRow>
        ))}
      </Section>
      {p.rsvp ? (
        <Section style={{ marginBottom: "20px" }}>
          <Text style={{ ...styles.intro, margin: "0 0 10px" }}>Will you attend?</Text>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
            <tbody>
              <tr>
                <td className="tt-rsvp" style={{ width: "33.33%", padding: "0 6px 0 0", verticalAlign: "top" }}>
                  <a href={p.rsvp.accept} className="tt-rsvp-btn" style={rsvpStyles.accept}>Yes, I&apos;ll be there</a>
                </td>
                <td className="tt-rsvp" style={{ width: "33.33%", padding: "0 3px", verticalAlign: "top" }}>
                  <a href={p.rsvp.tentative} className="tt-rsvp-btn" style={rsvpStyles.tentative}>Maybe</a>
                </td>
                <td className="tt-rsvp" style={{ width: "33.33%", padding: "0 0 0 6px", verticalAlign: "top" }}>
                  <a href={p.rsvp.decline} className="tt-rsvp-btn" style={rsvpStyles.decline}>Can&apos;t make it</a>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      ) : null}
      <CtaButton href={p.manageUrl} label={p.manageLabel ?? "Reschedule or cancel"} />
    </Shell>
  );
}

export function PasswordResetEmail({ resetUrl, ttlMinutes }: { resetUrl: string; ttlMinutes: number }) {
  return (
    <Shell preview="Reset your password">
      <Heading style={styles.heading}>Reset your password</Heading>
      <Text style={styles.intro}>
        We received a request to reset your {env.appName} password. This link expires in {ttlMinutes}{" "}
        minutes. If you didn&apos;t request this, you can safely ignore this email.
      </Text>
      <CtaButton href={resetUrl} label="Choose a new password" />
      <Hr style={{ borderColor: "#eef2f6", margin: "18px 0 0" }} />
      <Text style={{ margin: "12px 0 0", color: "#94a3b8", fontSize: "12px", wordBreak: "break-all" }}>
        Or paste this URL into your browser: {resetUrl}
      </Text>
    </Shell>
  );
}

export function InviteEmail({
  teamName,
  inviterName,
  inviteUrl,
}: {
  teamName: string;
  inviterName: string;
  inviteUrl: string;
}) {
  return (
    <Shell preview={`Join ${teamName} on ${env.appName}`}>
      <Heading style={styles.heading}>You&rsquo;ve been invited to join {teamName}</Heading>
      <Text style={styles.intro}>
        {inviterName} has invited you to join their team on {env.appName}. Click below to create your
        account and get started.
      </Text>
      <CtaButton href={inviteUrl} label="Accept invitation" bg="#e9a23b" color="#1a1817" />
      <Text style={{ margin: "16px 0 0", color: "#94a3b8", fontSize: "12px" }}>
        This invitation expires in 7 days.
      </Text>
    </Shell>
  );
}
