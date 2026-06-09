/**
 * Remember a returning booker's contact details in localStorage so repeat
 * bookings don't make them re-type their name/email/phone. Privacy-conscious:
 * stored only in the visitor's own browser, never sent anywhere extra, and
 * clearable from the form. Safe to import in client components (guards window).
 */

const KEY = "tidetime.booker.v1";

export interface SavedBooker {
  name?: string;
  email?: string;
  phone?: string;
}

export function loadSavedBooker(): SavedBooker | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedBooker;
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveBooker(booker: SavedBooker): void {
  if (typeof window === "undefined") return;
  const clean: SavedBooker = {};
  if (booker.name?.trim()) clean.name = booker.name.trim();
  if (booker.email?.trim()) clean.email = booker.email.trim();
  if (booker.phone?.trim()) clean.phone = booker.phone.trim();
  if (!clean.name && !clean.email && !clean.phone) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function clearSavedBooker(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
