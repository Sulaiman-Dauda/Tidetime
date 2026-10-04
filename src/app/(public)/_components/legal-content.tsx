import { parseLegalText, type LegalSpan } from "@/lib/legal-text";
import { cn } from "@/lib/utils";

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
            className="font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
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
    <div className="max-w-prose break-words text-sm leading-6 text-muted-foreground">
      {blocks.map((block, i) => {
        // Headings sit closer to the text they introduce than to the text above.
        const gap = i === 0 ? "" : blocks[i - 1].kind === "heading" ? "mt-2" : "mt-4";

        if (block.kind === "heading") {
          return (
            <h2 key={i} className={cn("text-base font-semibold text-foreground", i > 0 && "mt-8")}>
              <Spans spans={block.spans} />
            </h2>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={i} className={cn("list-disc space-y-1.5 pl-5 marker:text-muted-foreground/60", gap)}>
              {block.items.map((item, j) => (
                <li key={j} className="pl-1">
                  <Spans spans={item} />
                </li>
              ))}
            </ul>
          );
        }

        // Newlines inside a paragraph stay as breaks, matching the old output.
        return (
          <p key={i} className={cn("whitespace-pre-wrap", gap)}>
            <Spans spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
