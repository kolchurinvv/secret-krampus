#!/usr/bin/env bash
# A fresh, isolated server for the Playwright suite: its own build, database
# and mail log under .e2e/, the console mailer and local avatars. It builds into
# .e2e/dist so a server you have running on ./dist is never disturbed, and
# --no-env-file keeps your real .env (Resend, R2) out of it. Production mode,
# so auth rate limits are the real ones.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .e2e && mkdir -p .e2e
bunx vite build --outDir .e2e/dist --emptyOutDir --logLevel warn
exec env -u RESEND_API_KEY -u R2_ACCESS_KEY_ID -u R2_SECRET_ACCESS_KEY \
  NODE_ENV=production PORT=4173 PUBLIC_URL=http://127.0.0.1:4173 \
  STATIC_DIR=.e2e/dist DATABASE_PATH=.e2e/test.db DATA_DIR=.e2e MAIL_LOG=.e2e/mail.log \
  ADMIN_EMAILS=admin@example.com BETTER_AUTH_SECRET=e2e-only-secret-never-used-in-production \
  bun --no-env-file src/server/index.ts
