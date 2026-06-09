# Tidetime performance benchmarks

Tidetime's pitch is speed. This file makes that a number, not an adjective.
Re-run these on any commit and record the results so regressions are obvious.

## 1. Slot engine micro-benchmark

Pure, deterministic, no server or network — measures the core availability math
(`computeSlots`) over a 30-day window against a busy calendar.

```bash
npm run bench
```

Reference (CI runner, Node 20):

| Metric | Value |
| ------ | ----- |
| computeSlots, 30-day window, busy calendar | **avg ≈ 1.1ms / p95 ≈ 1.2ms / p99 ≈ 1.8ms** per call |

A booking page that recomputes a month of availability stays comfortably under
2ms of CPU even with a full calendar of conflicts — before the read-through
[CalendarCache](src/server/calendar/cache.ts) eliminates repeat provider fetches.

## 2. HTTP load test

Hits a running instance's public booking page and `/api/slots` and reports
p50/p95/p99 latency. Start the app, then:

```bash
APP_URL=http://localhost:3100 BENCH_USER=<handle> BENCH_SLUG=<service> npm run bench
# optional: BENCH_REQUESTS=100
```

Record your numbers here:

| Path | p50 | p95 | p99 |
| ---- | --- | --- | --- |
| booking page | _tbd_ | _tbd_ | _tbd_ |
| /api/slots | _tbd_ | _tbd_ | _tbd_ |

## 3. Lighthouse

Build + start the app, then run Lighthouse CI (config in `lighthouserc.json`):

```bash
npm run build && npm run start &   # serve on :3100
npm run lighthouse
```

Budgets asserted (desktop preset): performance ≥ 0.9, FCP ≤ 1.8s, LCP ≤ 2.5s,
TBT ≤ 200ms, CLS ≤ 0.1. Record the scores here per release:

| Page | Performance | FCP | LCP | TBT | CLS |
| ---- | ----------- | --- | --- | --- | --- |
| `/` (landing) | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
| `/login` | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
