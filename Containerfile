# secret-krampus — one Bun process serving the Hono API and the built Solid SPA.
#
# Bun is pinned to the same version as the nix dev shell (bun 1.4.4), so the
# lockfile is read by the exact same package manager that wrote it.

# --- build: install everything, build the client into dist/ ------------------
# dist/ is plain JS/CSS, so this stage runs natively on the build machine even
# when the target is another architecture.
FROM --platform=$BUILDPLATFORM docker.io/oven/bun:1.4.4 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- runtime: production deps + server source + dist/ ------------------------
FROM docker.io/oven/bun:1.4.4-slim
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/kolchurinvv/secret-krampus"
LABEL org.opencontainers.image.description="Secret Santa, Secret Krampus and party contest leaderboard"

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && rm -rf /root/.bun/install/cache

# The server runs straight from TypeScript (Bun transpiles on load). Migrations
# live next to the schema and are applied at startup.
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/dist \
    DATABASE_PATH=/data/krampus.db \
    DATA_DIR=/data \
    # The root filesystem is read-only in the cluster: keep Bun from trying to
    # write its transpiler cache, and give it a writable HOME (/tmp is an emptyDir).
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
    HOME=/tmp

# Unprivileged; the numeric ID needs no /etc/passwd entry. /data is the PVC.
USER 65532:65532
EXPOSE 3000
VOLUME ["/data"]

CMD ["bun", "src/server/index.ts"]
