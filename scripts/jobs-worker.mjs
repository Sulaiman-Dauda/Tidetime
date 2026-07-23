const interval = Math.max(30, Number(process.env.JOBS_INTERVAL_SECONDS || 300)) * 1000;
const secret = process.env.CRON_SECRET?.trim();
if (!secret || secret.length < 32) {
  throw new Error("CRON_SECRET must be at least 32 characters");
}

async function tick() {
  try {
    const response = await fetch("http://app:3100/api/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status}: ${body}`);
    console.info(`[jobs] ${body}`);
  } catch (error) {
    console.error("[jobs] tick failed", error);
  }
}

await tick();
setInterval(tick, interval);
