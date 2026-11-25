import { app } from "./app";
import { sqlite } from "./db";
import { env, r2Configured } from "./env";
import { emailMode } from "./services/email";

console.log(
  `🎄 Secret Krampus on :${env.port} · public ${env.publicUrl} · db ${env.databasePath} · ` +
    `email ${emailMode} · avatars ${r2Configured ? "r2" : "local"} · admins ${env.adminEmails.length}`,
);

export default {
  port: env.port,
  fetch: app.fetch,
};

// In the container Bun is PID 1, which gets no default signal handling: without
// this, `kubectl rollout` / `podman stop` wait out the grace period and SIGKILL.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    console.log(`${sig} received, closing the database`);
    sqlite.close();
    process.exit(0);
  });
}
