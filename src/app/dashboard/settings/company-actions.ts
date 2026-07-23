"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  setCompanyBookingDefaults,
  setCompanyLegalContents,
  setCompanyProfile,
} from "@/server/company-settings";

export type CompanySettingsState = { ok?: boolean; error?: string } | null;

/* ----------------------------- General / branding ------------------------- */

const profileSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(128),
  logoUrl: z.union([z.string().trim().url("Enter a valid URL"), z.literal("")]).default(""),
  brandColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a hex colour, e.g. #4f46e5"),
});

export async function updateCompanyProfileAction(
  _prev: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  await requireAdmin();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl") ?? "",
    brandColor: formData.get("brandColor"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await setCompanyProfile(parsed.data);
  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------ Business logic ---------------------------- */

const bookingSchema = z.object({
  bookingDisabled: z.coerce.boolean(),
  spamProtectionEnabled: z.coerce.boolean(),
});

export async function updateCompanyBookingAction(
  _prev: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  await requireAdmin();
  const parsed = bookingSchema.safeParse({
    bookingDisabled: formData.get("bookingDisabled") === "on",
    spamProtectionEnabled: formData.get("spamProtectionEnabled") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await setCompanyBookingDefaults(parsed.data);
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/* ------------------------------ Legal contents ---------------------------- */

const legalSchema = z.object({
  cookieNoticeEnabled: z.coerce.boolean(),
  cookieNoticeContent: z.string().max(5000).default(""),
  termsEnabled: z.coerce.boolean(),
  termsContent: z.string().max(20000).default(""),
  privacyEnabled: z.coerce.boolean(),
  privacyContent: z.string().max(20000).default(""),
  legalNoticeUrl: z.union([z.string().trim().url(), z.literal("")]).default(""),
  imprintUrl: z.union([z.string().trim().url(), z.literal("")]).default(""),
  dataRetentionDays: z.coerce.number().int().min(0).max(36500),
});

export async function updateCompanyLegalAction(
  _prev: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  await requireAdmin();
  const parsed = legalSchema.safeParse({
    cookieNoticeEnabled: formData.get("cookieNoticeEnabled") === "on",
    cookieNoticeContent: formData.get("cookieNoticeContent") ?? "",
    termsEnabled: formData.get("termsEnabled") === "on",
    termsContent: formData.get("termsContent") ?? "",
    privacyEnabled: formData.get("privacyEnabled") === "on",
    privacyContent: formData.get("privacyContent") ?? "",
    legalNoticeUrl: formData.get("legalNoticeUrl") ?? "",
    imprintUrl: formData.get("imprintUrl") ?? "",
    dataRetentionDays: formData.get("dataRetentionDays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await setCompanyLegalContents(parsed.data);
  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
