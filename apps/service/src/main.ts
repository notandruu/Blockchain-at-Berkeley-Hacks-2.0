import { boot } from "./boot.js";

// Long-running server: worker loops poll the job table continuously.
async function main(): Promise<void> {
  const { cfg, db, app, worker, accountStream, recover } = await boot();
  if (accountStream) await accountStream.start();
  await recover();
  worker.start();
  await app.listen({ port: cfg.SERVICE_PORT, host: "0.0.0.0" });
  app.log.info({ providers: cfg.providers, environment: "sandbox" }, "beagle service up");

  const shutdown = async () => {
    worker.stop();
    await app.close();
    await db.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
