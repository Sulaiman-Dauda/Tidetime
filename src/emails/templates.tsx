import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Link,
  Button,
  Hr,
  Preview,
  Row,
  Column,
} from "@react-email/components";
import { env } from "@/lib/env";

/**
 * React Email templates — a maintainable, component-based replacement for the
 * old inline-HTML strings. Rendered to HTML in `@/server/emails` via
 * `@react-email/render`. Branding (app name + URL) comes from env so the emails
 * white-label with the instance.
 */

const ACCENT = "#0f172a";

const styles = {
  body: { margin: 0, backgroundColor: "#f6f7f9", padding: "24px", fontFamily: "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", color: "#0f172a" } as const,
  container: { backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", maxWidth: "520px", overflow: "hidden" } as const,
  header: { padding: "20px 28px", borderBottom: "1px solid #eef2f6" } as const,
  brand: { fontWeight: 600, fontSize: "16px", letterSpacing: "-0.01em", margin: 0, color: "#0f172a" } as const,
  content: { padding: "28px" } as const,
  heading: { margin: "0 0 6px", fontSize: "20px", letterSpacing: "-0.02em" } as const,
  intro: { margin: "0 0 20px", color: "#475569", fontSize: "14px", lineHeight: "1.5" } as const,
  card: { border: "1px solid #eef2f6", borderRadius: "10px", padding: "8px 16px", marginBottom: "22px" } as const,
  label: { color: "#64748b", fontSize: "13px", width: "120px", verticalAlign: "top", padding: "6px 0", margin: 0 } as const,
  value: { fontSize: "14px", fontWeight: 500, padding: "6px 0", margin: 0 } as const,
  button: { backgroundColor: ACCENT, color: "#ffffff", fontSize: "14px", fontWeight: 500, padding: "10px 18px", borderRadius: "8px", textDecoration: "none" } as const,
  footer: { padding: "18px 28px", borderTop: "1px solid #eef2f6", color: "#94a3b8", fontSize: "12px" } as const,
  list: { margin: "0 0 20px", paddingLeft: "18px", color: "#0f172a", fontSize: "14px" } as const,
};

function Shell({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brand}>{env.appName}</Text>
          </Section>
          <Section style={styles.content}>{children}</Section>
          <Section style={styles.footer}>
            Sent by {env.appName} ·{" "}
            <Link href={env.appUrl} style={{ color: "#94a3b8" }}>
              {env.appUrl.replace(/^https?:\/\//, "")}
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row>
      <Column style={styles.label}>{label}</Column>
      <Column style={styles.value}>{children}</Column>
    </Row>
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
  location: string;
  meetingUrl: string | null;
  description?: string | null;
  manageUrl: string;
  manageLabel?: string;
  /** signed Accept / Decline / Tentative links — when present, an RSVP row renders */
  rsvp?: { accept: string; decline: string; tentative: string } | null;
}

const rsvpStyles = {
  accept: { backgroundColor: "#16a34a", color: "#ffffff", fontSize: "13px", fontWeight: 500, padding: "8px 14px", borderRadius: "8px", textDecoration: "none" } as const,
  tentative: { backgroundColor: "#f1f5f9", color: "#0f172a", fontSize: "13px", fontWeight: 500, padding: "8px 14px", borderRadius: "8px", textDecoration: "none" } as const,
  decline: { backgroundColor: "#fef2f2", color: "#b91c1c", fontSize: "13px", fontWeight: 500, padding: "8px 14px", borderRadius: "8px", textDecoration: "none" } as const,
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
          {p.hostName} &amp; {p.attendeeName}
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
      </Section>
      {p.rsvp ? (
        <Section style={{ marginBottom: "20px" }}>
          <Text style={{ ...styles.intro, margin: "0 0 10px" }}>Will you attend?</Text>
          <Row>
            <Column style={{ width: "33%" }}>
              <Link href={p.rsvp.accept} style={rsvpStyles.accept}>Yes, I&apos;ll be there</Link>
            </Column>
            <Column style={{ width: "33%" }}>
              <Link href={p.rsvp.tentative} style={rsvpStyles.tentative}>Maybe</Link>
            </Column>
            <Column style={{ width: "34%" }}>
              <Link href={p.rsvp.decline} style={rsvpStyles.decline}>Can&apos;t make it</Link>
            </Column>
          </Row>
        </Section>
      ) : null}
      <Button href={p.manageUrl} style={styles.button}>
        {p.manageLabel ?? "Reschedule or cancel"}
      </Button>
    </Shell>
  );
}

export interface SeriesEmailProps {
  heading: string;
  intro: string;
  occurrences: string[];
  manageUrl: string;
}

export function SeriesEmail(p: SeriesEmailProps) {
  return (
    <Shell preview={p.heading}>
      <Heading style={styles.heading}>{p.heading}</Heading>
      <Text style={styles.intro}>{p.intro}</Text>
      <ul style={styles.list}>
        {p.occurrences.map((o, i) => (
          <li key={i} style={{ padding: "4px 0" }}>
            {o}
          </li>
        ))}
      </ul>
      <Button href={p.manageUrl} style={styles.button}>
        Manage bookings
      </Button>
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
      <Button href={resetUrl} style={styles.button}>
        Choose a new password
      </Button>
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
      <Button href={inviteUrl} style={{ ...styles.button, backgroundColor: "#e9a23b", color: "#1a1817" }}>
        Accept invitation
      </Button>
      <Text style={{ margin: "16px 0 0", color: "#94a3b8", fontSize: "12px" }}>
        This invitation expires in 7 days.
      </Text>
    </Shell>
  );
}
