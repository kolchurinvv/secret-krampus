# secret-krampus — Secret Santa, Secret Krampus and party contests.
#
# Run recipes inside the dev shell (`nix develop`), which provides bun, just
# and sqlite. podman comes from the system. just itself does NOT load .env (its
# parser rejects unquoted values with spaces, e.g. EMAIL_FROM); the Bun server
# and `image-run` (podman --env-file) read it directly.
set shell := ["bash", "-c"]

# Override per invocation: `just tag=v1 push`
registry := "ghcr.io"
owner    := "kolchurinvv"
image    := "secret-krampus"
tag      := `git rev-parse --short HEAD 2>/dev/null || echo dev`
repo     := registry / owner / image

# The architecture the k3s nodes run — not necessarily your workstation's.
platforms := "linux/amd64"

# List the available recipes.
default:
    @just --list

# Install dependencies exactly as pinned in bun.lock.
install:
    bun install --frozen-lockfile

# Run the API server (:3000, watch mode) and Vite (:5173) together. Ctrl-C stops both.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p data
    trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT
    bun run dev:server &
    bun run dev:client &
    wait

# Run the unit tests.
test:
    bun test

# Run the Playwright e2e suite in Chromium (browsers from the flake). Extra args go to playwright.
e2e *args:
    bash scripts/playwright-runner.sh test {{args}}

# Watch the whole party play out in a visible Chromium (slowed down, pauses on the TV).
e2e-watch *args:
    E2E_WATCH=1 bash scripts/playwright-runner.sh test {{args}}

# Type-check the whole project (server, client, scripts).
typecheck:
    bun run typecheck

# Build the client into dist/ (served by the server in production).
build:
    bun run build

# Serve the production build locally on :3000 (after `just build`).
start:
    bun run start

# Seed fake participants, contests and stars. Pass --reset to wipe app data first.
seed *args:
    bun scripts/seed.ts {{args}}

# Award random stars every 3 s to watch the TV leaderboard overtake (Ctrl-C to stop).
simulate:
    bun scripts/seed.ts --simulate

# Generate a new SQL migration after editing src/server/db/schema.ts.
db-generate name="change":
    bunx drizzle-kit generate --name {{name}}

# Open the local database in sqlite3.
db:
    sqlite3 "${DATABASE_PATH:-./data/krampus.db}"

# Build the image for the cluster's architecture, tagged :<git sha> and :latest.
image:
    podman build --platform {{platforms}} -f Containerfile \
        -t {{repo}}:{{tag}} -t {{repo}}:latest .

# Run the locally built image on :3000 with ./data mounted (reads .env).
image-run: image
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p data
    envfile=()
    [ -f .env ] && envfile=(--env-file .env)
    podman run --rm -it -p 3000:3000 "${envfile[@]}" \
        -e PUBLIC_URL=http://localhost:3000 \
        -v "$PWD/data:/data:Z" --userns=keep-id:uid=65532,gid=65532 \
        {{repo}}:latest

# Authenticate to the registry (needs `gh auth refresh -s write:packages,read:packages` once).
login:
    #!/usr/bin/env bash
    set -euo pipefail
    token="${GHCR_TOKEN:-}"
    if [ -z "$token" ] && command -v gh >/dev/null 2>&1; then
        token="$(gh auth token 2>/dev/null || true)"
    fi
    if [ -z "$token" ]; then
        echo "no token: run 'gh auth refresh -s write:packages,read:packages' or set GHCR_TOKEN" >&2
        exit 1
    fi
    echo "$token" | podman login {{registry}} -u {{owner}} --password-stdin

# Build and push :<git sha> and :latest to GHCR.
push: image
    #!/usr/bin/env bash
    set -euo pipefail
    if ! podman login --get-login {{registry}} >/dev/null 2>&1; then
        echo "not logged in to {{registry}} — run 'just login' first" >&2
        exit 1
    fi
    podman push {{repo}}:{{tag}}
    podman push {{repo}}:latest
    echo "pushed {{repo}}:{{tag}} and :latest ({{platforms}})"

# Remove build output.
clean:
    rm -rf dist
