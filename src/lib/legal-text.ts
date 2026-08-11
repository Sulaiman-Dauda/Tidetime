/**
 * A deliberately tiny formatter for the Terms and Privacy contents.
 *
 * Those fields are plain text typed into Settings, and they used to render
 * through `whitespace-pre-wrap`, which meant a privacy notice arrived as one
 * undifferentiated grey slab with its URLs unclickable. That is a poor way to
 * present the one page a visitor reads when they want to know what happens to
 * their data.
 *
 * The subset is small on purpose: `## ` headings, `- ` bullets, `**bold**`, and
 * links detected from bare URLs and email addresses. There is no raw HTML and
 * no dependency; blocks are returned as data and the caller renders real React
 * elements, so nothing here can inject markup.
 *
 * Existing content keeps rendering exactly as before. A single newline is still
 * a line break and a blank line still separates paragraphs, so an address block
 * someone typed years ago does not silently reflow.
 */

export interface LegalSpan {
  text: string;
  bold?: boolean;
  /** Present when the span should render as a link. */
  href?: string;
}

export type LegalBlock =
  | { kind: "heading"; spans: LegalSpan[] }
  | { kind: "paragraph"; spans: LegalSpan[] }
  | { kind: "list"; items: LegalSpan[][] };

/** Trailing characters that are punctuation in a sentence, not part of a URL. */
const TRAILING = /[.,;:!?)\]]+$/;

/**
 * Bare URLs and email addresses. Deliberately conservative: it requires a
 * scheme for a URL so "e.g." and "17-19 Smeaton Close" are never mistaken for
 * one, and it stops at whitespace.
 */
const LINKABLE = /(https?:\/\/[^\s<]+|[^\s<@]+@[^\s<@]+\.[^\s<@.]+)/g;

const BOLD = /\*\*([^*]+)\*\*/g;

function linkify(text: string, bold: boolean): LegalSpan[] {
  const spans: LegalSpan[] = [];
  let last = 0;

  for (const match of text.matchAll(LINKABLE)) {
    const start = match.index ?? 0;
    let token = match[0];

    // "…visit https://ico.org.uk." must not put the full stop inside the link.
    const trailing = token.match(TRAILING)?.[0] ?? "";
    if (trailing) token = token.slice(0, -trailing.length);
    if (!token) continue;

    if (start > last) spans.push({ text: text.slice(last, start), ...(bold && { bold }) });

    const href = token.includes("@") && !token.startsWith("http") ? `mailto:${token}` : token;
    spans.push({ text: token, href, ...(bold && { bold }) });

    if (trailing) spans.push({ text: trailing, ...(bold && { bold }) });
    last = start + match[0].length;
  }

  if (last < text.length) spans.push({ text: text.slice(last), ...(bold && { bold }) });
  return spans;
}

/** Split one line of source into bold and plain runs, then linkify each run. */
function inline(text: string): LegalSpan[] {
  const spans: LegalSpan[] = [];
  let last = 0;

  for (const match of text.matchAll(BOLD)) {
    const start = match.index ?? 0;
    if (start > last) spans.push(...linkify(text.slice(last, start), false));
    spans.push(...linkify(match[1], true));
    last = start + match[0].length;
  }

  if (last < text.length) spans.push(...linkify(text.slice(last), false));
  return spans.filter((s) => s.text.length > 0);
}

/**
 * Parse the stored text into blocks. Never throws: whatever an admin has typed
 * renders as something reasonable.
 */
export function parseLegalText(source: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];

  // Blank lines separate blocks. \r\n first, so Windows-pasted text behaves.
  const chunks = source.replace(/\r\n/g, "\n").split(/\n\s*\n/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;

    if (lines[0].trimStart().startsWith("## ")) {
      blocks.push({ kind: "heading", spans: inline(lines[0].trimStart().slice(3).trim()) });
      // Anything after the heading in the same chunk is still a paragraph.
      const rest = lines.slice(1);
      if (rest.length > 0) blocks.push({ kind: "paragraph", spans: inline(rest.join("\n")) });
      continue;
    }

    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      blocks.push({
        kind: "list",
        items: lines.map((l) => inline(l.replace(/^\s*-\s+/, ""))),
      });
      continue;
    }

    // Newlines inside a paragraph are preserved, matching the old rendering.
    blocks.push({ kind: "paragraph", spans: inline(lines.join("\n")) });
  }

  return blocks;
}
