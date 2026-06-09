import "server-only";

/**
 * Optional AI content moderation for public free-text (booking answers, names,
 * notes). Disabled unless OPENAI_API_KEY is set — Tidetime stays lean and never
 * hard-depends on an external AI service.
 *
 * Fail-open by design: if the API errors or times out, content is allowed. We
 * would rather accept a booking than block a legitimate customer on a flaky
 * third-party call.
 */

const ENDPOINT = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";
const TIMEOUT_MS = 4000;

export function isModerationEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface ModerationResult {
  flagged: boolean;
  categories?: string[];
}

/** Returns { flagged } — true only on a confident positive from the provider. */
export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const input = text.trim();
  if (!apiKey || input.length === 0) return { flagged: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: input.slice(0, 4000) }),
      signal: controller.signal,
    });
    if (!res.ok) return { flagged: false };
    const data = (await res.json()) as {
      results?: { flagged?: boolean; categories?: Record<string, boolean> }[];
    };
    const result = data.results?.[0];
    if (!result?.flagged) return { flagged: false };
    const categories = Object.entries(result.categories ?? {})
      .filter(([, on]) => on)
      .map(([name]) => name);
    return { flagged: true, categories };
  } catch {
    return { flagged: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience: moderate several fields at once. */
export async function moderateFields(values: (string | null | undefined)[]): Promise<ModerationResult> {
  if (!isModerationEnabled()) return { flagged: false };
  const text = values.filter(Boolean).join("\n").trim();
  if (!text) return { flagged: false };
  return moderateText(text);
}
