"use client";

/**
 * One-time celebration for a freshly made booking (`?confirmed=1`): a ring of
 * dots bursts outward from the status icon. Pure CSS, renders once and fades —
 * revisits of the page (no query param) never show it.
 */
export function SuccessBurst() {
  const DOTS = 12;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: DOTS }, (_, index) => {
        const angle = (index / DOTS) * 2 * Math.PI;
        const distance = index % 2 === 0 ? 52 : 40;
        return (
          <span
            key={index}
            className="tt-burst-dot absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-primary"
            style={{
              opacity: 0,
              ["--tt-tx" as string]: `${Math.cos(angle) * distance}px`,
              ["--tt-ty" as string]: `${Math.sin(angle) * distance}px`,
              animation: `tt-burst 650ms ease-out ${120 + index * 18}ms both`,
            }}
          />
        );
      })}
    </div>
  );
}
