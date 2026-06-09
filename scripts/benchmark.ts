/**
 * Reproducible performance benchmark for Tidetime's hot paths.
 *
 * Two parts:
 *  1. A pure micro-benchmark of the slot engine (computeSlots) — no server, no
 *     network, deterministic. Proves the core availability math is fast.
 *  2. An optional HTTP load test against a running instance's public booking
 *     page + /api/slots endpoint, reporting p50/p95/p99 latency.
 *
 * Usage:
 *   npm run bench                              # engine micro-benchmark only
 *   APP_URL=http://localhost:3100 \
 *   BENCH_USER=jane BENCH_SLUG=intro \
 *   npm run bench                              # + HTTP load test
 */

import { computeSlots, type AvailabilityRule } from "../src/lib/slots";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label: string, samples: number[]): void {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const fmt = (n: number) => `${n.toFixed(2)}ms`;
  console.log(
    `${label.padEnd(28)} n=${samples.length} ` +
      `avg=${fmt(sum / samples.length)} ` +
      `p50=${fmt(percentile(sorted, 50))} ` +
      `p95=${fmt(percentile(sorted, 95))} ` +
      `p99=${fmt(percentile(sorted, 99))}`,
  );
}

/* -------------------------------------------------------------------------- */
/*  1. Slot engine micro-benchmark                                             */
/* -------------------------------------------------------------------------- */

function benchSlotEngine(): void {
  const rules: AvailabilityRule[] = [
    { days: [1, 2, 3, 4, 5], date: null, startTime: "09:00:00", endTime: "17:00:00" },
  ];
  // Simulate a busy calendar: 6 conflicts per weekday across the window.
  const busy: { start: number; end: number }[] = [];
  const base = Date.UTC(2026, 5, 8, 0, 0, 0);
  for (let d = 0; d < 30; d++) {
    for (let k = 0; k < 6; k++) {
      const start = base + d * 86_400_000 + (10 + k) * 3_600_000;
      busy.push({ start, end: start + 30 * 60_000 });
    }
  }

  const ITER = 2000;
  const samples: number[] = [];
  for (let i = 0; i < ITER; i++) {
    const t = performance.now();
    computeSlots({
      rangeStart: new Date(base),
      rangeEnd: new Date(base + 30 * 86_400_000),
      scheduleTimeZone: "America/New_York",
      rules,
      duration: 30,
      slotInterval: 15,
      offsetStart: 0,
      beforeBuffer: 0,
      afterBuffer: 0,
      minimumNotice: 0,
      busy,
      now: new Date(base),
    });
    samples.push(performance.now() - t);
  }
  console.log("\n=== Slot engine (computeSlots, 30-day window, busy calendar) ===");
  summarize("computeSlots", samples);
}

/* -------------------------------------------------------------------------- */
/*  2. HTTP load test (optional)                                              */
/* -------------------------------------------------------------------------- */

async function timeRequest(url: string): Promise<number | null> {
  const t = performance.now();
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
    await res.arrayBuffer();
    return res.ok ? performance.now() - t : null;
  } catch {
    return null;
  }
}

async function benchHttp(): Promise<void> {
  const appUrl = process.env.APP_URL;
  const user = process.env.BENCH_USER;
  const slug = process.env.BENCH_SLUG;
  if (!appUrl || !user || !slug) {
    console.log(
      "\n(Skipping HTTP load test — set APP_URL, BENCH_USER and BENCH_SLUG to run it.)",
    );
    return;
  }

  const N = Number(process.env.BENCH_REQUESTS ?? 50);
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const pageUrl = `${appUrl}/${user}/${slug}`;
  const slotsUrl = `${appUrl}/api/slots?username=${user}&slug=${slug}&start=${start}&end=${end}&tz=UTC`;

  console.log(`\n=== HTTP load test (${N} requests each) ===`);
  for (const [label, url] of [
    ["booking page", pageUrl],
    ["/api/slots", slotsUrl],
  ] as const) {
    const samples: number[] = [];
    for (let i = 0; i < N; i++) {
      const ms = await timeRequest(url);
      if (ms !== null) samples.push(ms);
    }
    if (samples.length === 0) console.log(`${label}: all requests failed (is the server running?)`);
    else summarize(label, samples);
  }
}

async function main(): Promise<void> {
  console.log("Tidetime performance benchmark");
  benchSlotEngine();
  await benchHttp();
  console.log("\nDone. Record numbers in BENCHMARKS.md.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
