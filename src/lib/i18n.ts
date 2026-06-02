/**
 * Lean i18n foundation. No runtime dependency — dictionaries are plain objects
 * keyed by locale, with English as the source of truth and fallback. Strings
 * support `{name}`-style interpolation. This is intentionally a framework only:
 * add more locales by extending `dictionaries`, and resolve a user/attendee's
 * preferred locale from the `locale` column already present in the schema.
 */

export const DEFAULT_LOCALE = "en";

/** Locales we ship translations for. Extend as dictionaries are added. */
export const SUPPORTED_LOCALES = ["en", "es", "fr", "de"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Translation keys. Keeping these typed catches missing/renamed strings. */
export type TranslationKey =
  | "booking.confirmTitle"
  | "booking.confirmSubtitle"
  | "booking.yourName"
  | "booking.yourEmail"
  | "booking.submit"
  | "booking.submitting"
  | "booking.cancel"
  | "booking.reschedule"
  | "booking.cancelled"
  | "booking.pendingApproval"
  | "booking.tooManyAttempts"
  | "booking.genericError"
  | "email.confirmedSubject"
  | "email.cancelledSubject"
  | "email.reminderSubject"
  | "common.poweredBy";

type Dictionary = Partial<Record<TranslationKey, string>>;

const en: Record<TranslationKey, string> = {
  "booking.confirmTitle": "Confirm your booking",
  "booking.confirmSubtitle": "Enter your details to finish booking.",
  "booking.yourName": "Your name",
  "booking.yourEmail": "Your email",
  "booking.submit": "Confirm booking",
  "booking.submitting": "Booking…",
  "booking.cancel": "Cancel",
  "booking.reschedule": "Reschedule",
  "booking.cancelled": "This booking has been cancelled.",
  "booking.pendingApproval": "Your booking is pending approval.",
  "booking.tooManyAttempts": "Too many attempts. Please try again later.",
  "booking.genericError": "We couldn't process that request. Please try again.",
  "email.confirmedSubject": "Your booking is confirmed",
  "email.cancelledSubject": "Your booking was cancelled",
  "email.reminderSubject": "Reminder: your upcoming booking",
  "common.poweredBy": "Powered by Tidetime",
};

/**
 * Translation overrides per locale. Only keys that differ from English need to
 * be present; anything missing falls back to English automatically.
 */
const dictionaries: Record<Locale, Dictionary> = {
  en,
  es: {
    "booking.confirmTitle": "Confirma tu reserva",
    "booking.confirmSubtitle": "Introduce tus datos para finalizar la reserva.",
    "booking.yourName": "Tu nombre",
    "booking.yourEmail": "Tu correo electrónico",
    "booking.submit": "Confirmar reserva",
    "booking.submitting": "Reservando…",
    "booking.cancel": "Cancelar",
    "booking.reschedule": "Reprogramar",
    "booking.cancelled": "Esta reserva ha sido cancelada.",
    "booking.pendingApproval": "Tu reserva está pendiente de aprobación.",
    "booking.tooManyAttempts": "Demasiados intentos. Inténtalo más tarde.",
    "booking.genericError": "No pudimos procesar la solicitud. Inténtalo de nuevo.",
    "email.confirmedSubject": "Tu reserva está confirmada",
    "email.cancelledSubject": "Tu reserva fue cancelada",
    "email.reminderSubject": "Recordatorio: tu próxima reserva",
    "common.poweredBy": "Con tecnología de Tidetime",
  },
  fr: {
    "booking.confirmTitle": "Confirmez votre réservation",
    "booking.confirmSubtitle": "Saisissez vos coordonnées pour finaliser.",
    "booking.yourName": "Votre nom",
    "booking.yourEmail": "Votre e-mail",
    "booking.submit": "Confirmer la réservation",
    "booking.submitting": "Réservation…",
    "booking.cancel": "Annuler",
    "booking.reschedule": "Reprogrammer",
    "booking.cancelled": "Cette réservation a été annulée.",
    "booking.pendingApproval": "Votre réservation est en attente d'approbation.",
    "booking.tooManyAttempts": "Trop de tentatives. Réessayez plus tard.",
    "booking.genericError": "Impossible de traiter la demande. Réessayez.",
    "email.confirmedSubject": "Votre réservation est confirmée",
    "email.cancelledSubject": "Votre réservation a été annulée",
    "email.reminderSubject": "Rappel : votre prochaine réservation",
    "common.poweredBy": "Propulsé par Tidetime",
  },
  de: {
    "booking.confirmTitle": "Bestätige deine Buchung",
    "booking.confirmSubtitle": "Gib deine Daten ein, um die Buchung abzuschließen.",
    "booking.yourName": "Dein Name",
    "booking.yourEmail": "Deine E-Mail",
    "booking.submit": "Buchung bestätigen",
    "booking.submitting": "Buchung läuft…",
    "booking.cancel": "Stornieren",
    "booking.reschedule": "Verschieben",
    "booking.cancelled": "Diese Buchung wurde storniert.",
    "booking.pendingApproval": "Deine Buchung wartet auf Bestätigung.",
    "booking.tooManyAttempts": "Zu viele Versuche. Bitte später erneut versuchen.",
    "booking.genericError": "Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen.",
    "email.confirmedSubject": "Deine Buchung ist bestätigt",
    "email.cancelledSubject": "Deine Buchung wurde storniert",
    "email.reminderSubject": "Erinnerung: deine bevorstehende Buchung",
    "common.poweredBy": "Bereitgestellt von Tidetime",
  },
};

/** Type guard: is `value` a locale we support? */
export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Normalize an arbitrary locale string (e.g. "en-US", "FR") to a supported
 * locale, falling back to the default. Matches on the primary subtag.
 */
export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  const lower = value.toLowerCase();
  if (isSupportedLocale(lower)) return lower;
  const primary = lower.split("-")[0]!;
  return isSupportedLocale(primary) ? primary : DEFAULT_LOCALE;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Translate `key` for `locale`, with optional `{var}` interpolation. Falls back
 * to English, then to the key itself if nothing is found.
 */
export function t(
  locale: string | null | undefined,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const resolved = resolveLocale(locale);
  const template = dictionaries[resolved]?.[key] ?? en[key] ?? key;
  return interpolate(template, vars);
}

/**
 * Bind a locale once and get a `t`-style function — convenient inside a request
 * or component scope: `const tr = getTranslator(user.locale); tr("booking.submit")`.
 */
export function getTranslator(locale: string | null | undefined) {
  const resolved = resolveLocale(locale);
  return (key: TranslationKey, vars?: Record<string, string | number>): string =>
    t(resolved, key, vars);
}
