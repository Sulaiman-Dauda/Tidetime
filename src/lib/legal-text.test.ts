import { describe, expect, it } from "vitest";
import { parseLegalText, type LegalSpan } from "./legal-text";

/** Flatten spans back to text, so assertions read like the source. */
const textOf = (spans: LegalSpan[]) => spans.map((s) => s.text).join("");
const linksIn = (spans: LegalSpan[]) => spans.filter((s) => s.href).map((s) => s.href);

describe("parseLegalText", () => {
  it("returns nothing for empty or whitespace-only content", () => {
    expect(parseLegalText("")).toEqual([]);
    expect(parseLegalText("   \n\n  \n")).toEqual([]);
  });

  it("treats a blank line as a paragraph break", () => {
    const blocks = parseLegalText("First para.\n\nSecond para.");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "paragraph"]);
  });

  it("preserves a single newline inside a paragraph, as the old renderer did", () => {
    // An address block typed by an existing admin must not reflow.
    const [block] = parseLegalText("Sportsafe UK Ltd\n17-19 Smeaton Close\nColchester");
    expect(block.kind).toBe("paragraph");
    expect(textOf(block.kind === "paragraph" ? block.spans : [])).toBe(
      "Sportsafe UK Ltd\n17-19 Smeaton Close\nColchester",
    );
  });

  it("reads ## as a heading", () => {
    const [block] = parseLegalText("## Your rights");
    expect(block.kind).toBe("heading");
    expect(textOf(block.kind === "heading" ? block.spans : [])).toBe("Your rights");
  });

  it("keeps a paragraph that follows a heading in the same chunk", () => {
    const blocks = parseLegalText("## Cookies\nThis site sets no cookies.");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph"]);
  });

  it("groups consecutive dashes into one list", () => {
    const [block] = parseLegalText("- your name\n- your email address\n- your phone number");
    expect(block.kind).toBe("list");
    expect(block.kind === "list" ? block.items.map(textOf) : []).toEqual([
      "your name",
      "your email address",
      "your phone number",
    ]);
  });

  it("does not treat a hyphenated line as a list", () => {
    const [block] = parseLegalText("17-19 Smeaton Close, Colchester");
    expect(block.kind).toBe("paragraph");
  });

  it("marks **bold** runs without leaking the asterisks", () => {
    const [block] = parseLegalText("Contact **our team** today.");
    const spans = block.kind === "paragraph" ? block.spans : [];
    expect(textOf(spans)).toBe("Contact our team today.");
    expect(spans.find((s) => s.bold)?.text).toBe("our team");
  });

  it("links a bare URL", () => {
    const [block] = parseLegalText("See https://sportsafeuk.com/policies/ for more.");
    const spans = block.kind === "paragraph" ? block.spans : [];
    expect(linksIn(spans)).toEqual(["https://sportsafeuk.com/policies/"]);
    expect(textOf(spans)).toBe("See https://sportsafeuk.com/policies/ for more.");
  });

  it("leaves sentence punctuation outside the link", () => {
    // The trap: "…at https://ico.org.uk." must not link the full stop.
    const [block] = parseLegalText("Complain at https://ico.org.uk.");
    const spans = block.kind === "paragraph" ? block.spans : [];
    expect(linksIn(spans)).toEqual(["https://ico.org.uk"]);
    expect(textOf(spans)).toBe("Complain at https://ico.org.uk.");
  });

  it("turns an email address into a mailto link", () => {
    const [block] = parseLegalText("Write to marketing@sportsafeuk.com and we will reply.");
    const spans = block.kind === "paragraph" ? block.spans : [];
    expect(linksIn(spans)).toEqual(["mailto:marketing@sportsafeuk.com"]);
  });

  it("does not invent links from ordinary prose", () => {
    const [block] = parseLegalText("Call us on 0333 300 0032, e.g. during office hours.");
    const spans = block.kind === "paragraph" ? block.spans : [];
    expect(linksIn(spans)).toEqual([]);
  });

  it("links inside a list item and inside bold", () => {
    const [list] = parseLegalText("- **Our CRM**, at https://sportsafe.sugaropencloud.uk");
    const item = list.kind === "list" ? list.items[0] : [];
    expect(item.find((s) => s.bold)?.text).toBe("Our CRM");
    expect(linksIn(item)).toEqual(["https://sportsafe.sugaropencloud.uk"]);
  });

  it("handles Windows line endings", () => {
    const blocks = parseLegalText("## Heading\r\n\r\nA paragraph.\r\n");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph"]);
  });

  it("never emits an empty span", () => {
    for (const block of parseLegalText("## H\n\n- a\n- b\n\n**x** https://a.example y")) {
      const spans = block.kind === "list" ? block.items.flat() : block.spans;
      expect(spans.every((s) => s.text.length > 0)).toBe(true);
    }
  });
});
