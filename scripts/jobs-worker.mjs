import { writeFile } from "node:fs/promises";

const interval = Math.max(30, Number(process.env.JOBS_INTERVAL_SECONDS || 300)) * 1000;
const targetUrl = process.env.JOBS_TARGET_URL || "http://app:3100/api/cron";
// Touched after every completed tick; the container healthcheck compares its
// age against the interval to catch a wedged (not crashed) worker.
const heartbeatFile = process.env.JOBS_HEARTBEAT_FILE || "/tmp/jobs-heartbeat";
const secret = process.env.CRON_SECRET?.trim();
if (!secret || secret.length < 32) {
  throw new Error("CRON_SECRET must be at least 32 characters");
}

async function tick() {
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      // A hung request must never stall the loop past the next tick.
      signal: AbortSignal.timeout(Math.min(interval, 10 * 60 * 1000)),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status}: ${body}`);
    console.info(`[jobs] ${body}`);
  } catch (error) {
    console.error("[jobs] tick failed", error);
  }
  await writeFile(heartbeatFile, String(Date.now())).catch(() => undefined);
}

await tick();
setInterval(tick, interval);
