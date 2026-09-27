export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const g = globalThis as unknown as { __dsCron?: boolean };
  if (g.__dsCron) return;
  g.__dsCron = true;
  const { hourly } = await import("./lib/cron");
  const run = () => hourly().catch((e) => console.error("[cron]", e));
  setTimeout(run, 60_000);
  setInterval(run, 3600_000);
}
