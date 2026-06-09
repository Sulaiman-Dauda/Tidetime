"use server";

import { z } from "zod";
import { headers } from "next/headers";
import {
  getPublicRoutingForm,
  recordRoutingResponse,
  resolveEventTypeBookingPath,
} from "@/server/routing-forms";
import { evaluateRouting, validateRoutingAnswers } from "@/lib/routing";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

// Bound the unauthenticated answer payload: capped keys, value sizes, and count.
const answersSchema = z
  .record(z.string().max(128), z.string().max(5000))
  .refine((value) => Object.keys(value).length <= 100, "Too many fields");

export type RoutingDestination =
  | { kind: "path"; value: string }
  | { kind: "url"; value: string }
  | { kind: "message"; value: string };

export type SubmitRoutingState =
  | { ok: true; destination: RoutingDestination }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> }
  | null;

/** Evaluate a routing form submission and return where the respondent goes. */
export async function submitRoutingFormAction(
  slug: string,
  answers: Record<string, string>,
): Promise<SubmitRoutingState> {
  // `answers` is an untyped server-action argument — validate it at runtime
  // before it reaches the DB (jsonb) and rate-limit per client IP.
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return { ok: false, error: "Invalid submission." };
  answers = parsed.data;

  const ip = clientIpFromHeaders(await headers());
  if (!checkRateLimit(`routing:ip:${ip}`, { limit: 20, windowMs: 60 * 1000 }).ok) {
    return { ok: false, error: "Too many submissions. Please slow down and try again." };
  }

  const form = await getPublicRoutingForm(slug);
  if (!form) return { ok: false, error: "This form is no longer available." };

  const fieldErrors = validateRoutingAnswers(form.fields, answers);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const action = evaluateRouting(form.routes, form.fallback, answers);
  await recordRoutingResponse(form.id, answers, action).catch(() => undefined);

  if (!action) {
    return { ok: true, destination: { kind: "message", value: "Thanks for your response." } };
  }
  if (action.type === "message") {
    return { ok: true, destination: { kind: "message", value: action.message } };
  }
  if (action.type === "external_url") {
    return { ok: true, destination: { kind: "url", value: action.url } };
  }
  // event_type → resolve to a booking path
  const path = await resolveEventTypeBookingPath(action.eventTypeId);
  if (!path) {
    return { ok: true, destination: { kind: "message", value: "Thanks for your response." } };
  }
  return { ok: true, destination: { kind: "path", value: path } };
}
