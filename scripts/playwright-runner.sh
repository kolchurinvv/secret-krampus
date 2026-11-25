#!/usr/bin/env bash
# Runs Playwright with whichever browser runtime is available
# (same shape as kolchurin.dev's frontend/scripts/playwright-runner.sh).
set -euo pipefail

if [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && [ -n "${PLAYWRIGHT_DRIVER_VERSION:-}" ]; then
  # Nix mode (`nix develop`): browsers come from nixpkgs' playwright-driver,
  # which only matches the @playwright/test version it was built for.
  pinned=$(node -p 'require("@playwright/test/package.json").version')
  if [ "$pinned" != "$PLAYWRIGHT_DRIVER_VERSION" ]; then
    echo "@playwright/test is $pinned but nix provides browsers for $PLAYWRIGHT_DRIVER_VERSION." >&2
    echo "Pin it: bun add -d --exact @playwright/test@$PLAYWRIGHT_DRIVER_VERSION" >&2
    exit 1
  fi
  exec node node_modules/@playwright/test/cli.js "$@"
fi

if [ "${CI:-}" = "true" ] || [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  # CI mode: Playwright-managed Chromium.
  unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
  export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-0}"
  bunx playwright install --with-deps chromium
  exec bunx playwright "$@"
fi

echo "No Playwright browser runtime configured." >&2
echo "Either:" >&2
echo "  1) run from 'nix develop' (sets PLAYWRIGHT_BROWSERS_PATH), or" >&2
echo "  2) run in CI with CI=true/GITHUB_ACTIONS=true (installs Chromium)." >&2
exit 1
