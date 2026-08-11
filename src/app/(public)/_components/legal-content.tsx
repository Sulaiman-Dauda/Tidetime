import { parseLegalText, type LegalSpan } from "@/lib/legal-text";

/**
 * Renders the stored Terms/Privacy text as real elements.
 *
 * Everything is built from parsed data rather than injected markup, so admin
 * text can never introduce HTML into the page.
 */

function Spans({ spans }: { spans: LegalSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        const content = span.bold ? (
          <strong className="font-medium text-foreground">{span.text}</strong>
        ) : (
          span.text
        );

        if (!span.href) return <span key={i}>{content}</span>;

        const external = span.href.startsWith("http");
        return (
          <a
            key={i}
            href={span.href}
            className="text-foreground underline underline-offset-2 hover:no-underline"
            {...(external && { target: "_blank", rel: "noopener noreferrer" })}
          >
            {content}
          </a>
        );
      })}
    </>
  );
}

export function LegalContent({ content }: { content: string }) {
  const blocks = parseLegalText(content);

  return (
    <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h2 key={i} className="pt-4 text-base font-semibold text-foreground">
              <Spans spans={block.spans} />
            </h2>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground/50">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Spans spans={item} />
                </li>
              ))}
            </ul>
          );
        }

        // Newlines inside a paragraph stay as breaks, matching the old output.
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Spans spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
