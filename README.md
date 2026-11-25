# Secret Krampus 😈🎄

A small party app for **[secretkrampus.party](https://secretkrampus.party)**:

- **Secret Santa** — people sign up with just their email (a 6-digit login code, no
  passwords). One admin button assigns givers → receivers as a single loop and emails
  everyone their match through Resend. Registration never closes: late joiners are
  spliced into the existing loop, which changes exactly one existing person's match
  (they get a "plot twist" email).
- **Secret Krampus** — everyone rates the gift they received (half-star slider). The
  giver of the lowest-rated gift is the Krampus. Ties trigger automatic tie-break rounds
  where everyone rates the tied gifts.
- **Contests** — individual or team contests; every win is a ⭐. The admin ticks a group
  and gives them all +1.
- **The TV** — `/live` is a full-screen public display the admin drives: title,
  sign-up lobby with QR code, voting progress, a live 3D leaderboard, and the Krampus
  (sad trombone) and champion (fanfare + confetti) reveals.

| Path | Who | What |
|---|---|---|
| `/login` | anyone | email → 6-digit code |
| `/me` | signed-in | profile & avatar, your Secret Santa match, gift rating |
| `/admin` | `ADMIN_EMAILS` | people, Santa draw & emails, Krampus vote, contests, TV control |
| `/live` | public | the TV display (live over SSE) |

The admin page never shows who gives to whom (or the Krampus before the reveal), so
the admin can play too.

## Stack

Bun 1.4 runs a single process: a [Hono](https://hono.dev) API, a Server-Sent Events
stream, and the built [SolidJS](https://solidjs.com) SPA. State is one SQLite file
(`bun:sqlite` + Drizzle, migrations applied at startup). Auth is
[Better Auth](https://better-auth.com) with the email-OTP plugin; email via
[Resend](https://resend.com); avatars in Cloudflare R2; UI with
[BeerCSS](https://beercss.com); effects with canvas-confetti, the Web Animations API
and synthesized Web Audio.

```
src/shared/types.ts   the client ↔ server contract (all JSON shapes + API list)
src/server/           Hono app, Better Auth, Drizzle schema + migrations, services
src/client/           Solid SPA: pages/{Login,Me,Admin,Live}, components, lib
scripts/seed.ts       fake data + a star "simulator" for the TV leaderboard
```

## Local development

```bash
nix develop            # bun, just, sqlite (podman comes from the system)
just install           # bun install --frozen-lockfile
cp .env.example .env   # set ADMIN_EMAILS to your email; everything else is optional
just dev               # API on :3000 + Vite on :5173 — open http://localhost:5173
```

- **Login codes** — without `RESEND_API_KEY`, every email (including the 6-digit login
  code) is printed to the server console instead of being sent.
- **Avatars** — without R2 credentials they're stored in `./data/avatars` and served
  by the app.
- **Fake data** — `just seed` adds 14 participants, 3 contests and some stars
  (`just seed --reset` wipes app data first; accounts are kept).
- **Watch the leaderboard move** — open `/live`, switch the TV to *Leaderboard* in
  `/admin`, then `just simulate` awards random stars every 3 s. The server picks up
  the script's writes and pushes them to every screen.
- **TV mock** — `/live?mock=1` renders the display with built-in mock data.
- `just test` runs the unit tests, `just typecheck` type-checks everything, and
  `just db-generate <name>` creates a migration after editing
  `src/server/db/schema.ts`. `just db` opens the database in sqlite3.
- `just e2e` runs the Playwright suite in Chromium (browsers come from the
  flake, nothing is downloaded). It builds into `.e2e/` and starts its own
  production-mode server on :4173 with a throwaway database and the console
  mailer, without loading `.env`, so it never touches your running server or
  your Resend/R2 keys. `just e2e --headed` shows the browser; failures leave
  screenshots and traces in `.e2e/results/`.
- `just e2e-watch` runs the same suite in a visible Chromium, slowed down and
  pausing on the TV's big moments, so you can watch the whole party play out:
  the draw, a late joiner, stars climbing the leaderboard, the tie-break, the
  Krampus reveal and the champion.

## Where the keys go

| Key | Local dev | Cluster |
|---|---|---|
| `RESEND_API_KEY` | `.env` | Secret `secret-krampus-env` |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `.env` | Secret `secret-krampus-env` |
| `BETTER_AUTH_SECRET` | `.env` (any string) | Secret `secret-krampus-env` (`openssl rand -base64 32`) |
| `ADMIN_EMAILS` | `.env` | Secret `secret-krampus-env` |
| URLs, bucket, sender | `.env` | ConfigMap `secret-krampus` |

`.env` is gitignored and loaded automatically by Bun (and by `just`). Never commit
real values; `.env.example` lists every variable.

## Deploying to k3s-lab

The manifests live in the infra repo:
`~/Dev_Projects/k3s-migration/infra/secret-krampus/krampus.yaml`, one multi-document
file like the other services there. The image is built
here and pushed to GHCR:

```bash
just login    # once: podman login ghcr.io (uses `gh auth token`)
just push     # builds linux/amd64, pushes :<git sha> and :latest
```

### One-time setup checklist

1. **Cloudflare DNS** — `A secretkrampus.party → 135.125.237.68` (ovh-s1, where
   Traefik listens), **DNS-only** (grey cloud) like the kolchurin.dev hosts, so the
   SSE stream and the Let's Encrypt cert go straight to Traefik.
2. **cert-manager token** — edit the Cloudflare API token behind the
   `cloudflare-api-token` Secret and add the `secretkrampus.party` zone
   (Zone:DNS:Edit). Without it the DNS-01 challenge can't issue the certificate.
3. **R2**
   - Bucket `secret-krampus` (EEUR) ✅ — no CORS policy needed (the browser never
     talks to R2), r2.dev URL stays disabled.
   - Custom domain `img.secretkrampus.party` ✅
   - An **account** API token with *Object Read & Write* on `secret-krampus` only
     (separate from the backups token). Use its S3 credentials: **Access Key ID** →
     `R2_ACCESS_KEY_ID`, **Secret Access Key** → `R2_SECRET_ACCESS_KEY`.
4. **Resend** — add the domain `secretkrampus.party` and use *Sign in to Cloudflare*
   auto-setup (MX + SPF on `send`, DKIM on `resend._domainkey`, all DNS-only). Make sure
   the API key may send from this domain.
5. **Cluster** (from the k3s-migration repo; exact commands in the header of
   `infra/secret-krampus/krampus.yaml`):
   ```bash
   kubectl create namespace secret-krampus
   kubectl create secret docker-registry ghcr-pull -n secret-krampus ...
   kubectl create secret generic secret-krampus-env -n secret-krampus --from-env-file=...
   kubectl apply -f infra/secret-krampus/krampus.yaml
   ```

Updating later: `just push`, then
`kubectl rollout restart deployment/secret-krampus -n secret-krampus`.

### Verify

```bash
kubectl get certificate -n secret-krampus            # READY=True
curl -fsS https://secretkrampus.party/healthz        # ok
curl -N https://secretkrampus.party/api/live/stream  # a "state" event, then pings every 20 s
```

Then sign in at https://secretkrampus.party with a real address (the code arrives via
Resend) and upload an avatar — it should load from `https://img.secretkrampus.party/avatars/…`.

### Running the image locally

```bash
just image-run   # builds, then serves on http://localhost:3000 with ./data mounted
curl -N localhost:3000/api/live/stream   # should stay open well past 60 s
```
