<div align="center">

# Open Grid

**A multi-pane terminal canvas for AI coding agents — from any browser, including your phone.**

Run `claude`, `codex`, `gemini`, `cursor-agent`, `grok`, and `aider` side-by-side over real PTYs.
Broadcast one prompt to many agents. No accounts. Self-hostable. MIT.

[Quick start](#quick-start) · [Docker](#run-with-docker) · [Security model](#security-model) · [Roadmap](#roadmap) · [Contributing](./CONTRIBUTING.md)

</div>

---

## What it does

Open Grid is a single-binary, self-hostable workspace that gives every browser tab its own ephemeral sandbox with multiple AI CLI agents inside. Think of it as a tmux-style canvas where each pane is a real PTY running a real CLI — but accessible from a phone, with a global "broadcast bar" to fan one prompt out to several agents at once and compare their answers.

- **Multi-agent panes.** Spawn Claude Code, Codex, Gemini, Cursor, Grok, Aider, or plain shells. Each survives reconnects for ~5 min so your phone backgrounding the tab doesn't kill the agent.
- **Broadcast bar.** Type once, send to every selected pane. Stop wasting tokens A/B-ing by hand.
- **No accounts.** First visit silently issues a signed cookie. Each browser gets its own jailed workspace dir and in-memory API-key bag.
- **BYO LLM keys.** Paste your own `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / etc. We forward them into the PTY env and never write them to disk.
- **2-hour idle reaper.** Untouched sessions are wiped — files, PTYs, keys.
- **Mobile-first.** Bracketed paste, pinch-zoom canvas, on-screen ⌃/⎋ helpers, safe-area aware.

## Quick start

```bash
git clone https://github.com/fleet-watcher/opengrid.git && cd opengrid
./scripts/install.sh   # checks node/pnpm, generates SESSION_SECRET into .env.local
pnpm dev               # API on :4000, web canvas on :5173
# open http://localhost:5173
```

Or run each service yourself if you prefer separate terminals:

```bash
PORT=4000 pnpm --filter @workspace/api-server      run dev   # API + WS
PORT=5173 pnpm --filter @workspace/opengrid-canvas run dev   # web canvas
```

Requirements: **Node ≥ 20**, **pnpm ≥ 9**, **git**. To actually spawn agents, install the CLIs you want and make sure they're on `$PATH`:

```bash
npm i -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli
curl https://cursor.com/install -fsS | bash
pip install aider-chat
```

Then load the app, paste your provider key in the **Keys** panel, click **Add Agent**.

## Run with Docker

Single-image, no extra services. Drop this on any VPS:

```bash
docker run -d --name opengrid \
  -p 8080:8080 \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ALLOWED_ORIGINS="https://opengrid.example.com" \
  -v opengrid-workspaces:/var/lib/opengrid \
  ghcr.io/fleet-watcher/opengrid:latest
```

Or with `docker-compose.yml`:

```bash
SESSION_SECRET=$(openssl rand -hex 32) docker compose up -d
```

The container bundles the API + the prebuilt SPA on a single port. Put nginx/Caddy/Cloudflare in front for TLS.

## Production deployment

### Required environment variables

| Variable           | Required | Description                                                         |
| ------------------ | -------- | ------------------------------------------------------------------- |
| `SESSION_SECRET`   | **yes**  | HMAC signing key for session cookies. Min 16 chars. `openssl rand -hex 32`. |
| `NODE_ENV`         | yes      | Set to `production`.                                                |
| `PORT`             | yes      | Single port the API + SPA bind to inside the container.             |
| `ALLOWED_ORIGINS`  | yes      | Comma-separated hostnames allowed for CORS + WebSocket Origin.      |
| `SERVE_WEB`        | no       | `1` to serve the prebuilt SPA from the API server (Docker default). |
| `WEB_DIST`         | no       | Absolute path to the built SPA. Default: `../opengrid-canvas/dist/public`. |
| `WORKSPACES_ROOT`  | no       | Parent dir for per-session workspaces. Default `~/.opengrid-workspaces`. |
| `MAX_SESSIONS`     | no       | Max concurrent PTYs (default 64).                                   |
| `MAX_USER_SESSIONS`| no       | Max concurrent browser sessions (default 500).                      |

The server fails fast at boot if `NODE_ENV=production` and `SESSION_SECRET` is missing/short or `ALLOWED_ORIGINS` is empty.

### Reverse-proxy notes

The single-port deployment serves three things on the same origin:

- `GET /api/*` — JSON API (cookie auth)
- `GET /ws/terminal` — WebSocket (ticket auth, see below)
- `GET /*` — SPA (static + history fallback)

Make sure your proxy forwards `Upgrade`, `Connection`, and the `Host`/`X-Forwarded-*` headers. Example nginx snippet is in [`docs/nginx.conf.example`](#) (TODO).

### Resource isolation (read this before going multi-tenant)

Open Grid jails each browser at the **filesystem + env-var** layer — per-session workspace dir, per-session in-memory API-key bag, per-session PTY namespace. It does **not** enforce CPU/RAM/disk-quota isolation. For public multi-tenant deployments, run the container with cgroup limits and a disk quota on `WORKSPACES_ROOT`. Single-instance only; horizontal scaling needs sticky cookies (sessions live in memory).

## Security model

- **No login.** First visit calls `POST /api/auth/session`; the server issues a signed (HMAC-SHA256) `og_sid` cookie — HttpOnly, SameSite=Lax, Secure in prod, 7-day max-age — and creates an empty workspace under `WORKSPACES_ROOT/<sessionId>`.
- **2-hour idle reaper.** A background sweeper runs every 10 min and destroys any session whose `lastSeen` is older than 2 h: kills its PTYs, deletes its workspace dir, drops its in-memory API keys.
- **BYO API keys.** Posted via `PUT /api/auth/keys`. Keys live in memory only, never on disk, never logged, never echoed back (`GET` returns names only). Allowlisted names only — see `ALLOWED_API_KEYS` in `artifacts/api-server/src/lib/auth.ts`.
- **WebSocket tickets.** `POST /api/auth/ws-ticket` (cookie-gated) returns a single-use, 30 s ticket bound to the session. Clients connect to `/ws/terminal?sessionId=<panelId>&ticket=…`. No session id appears in WS URLs (= not in proxy logs).
- **Per-session workspace jail.** All `/api/files/*` operations and PTY `cwd` are restricted to that user's workspace; symlink escapes blocked via `realpath`.
- **Per-session PTY namespace.** Internal key is `${userSessionId}:${panelId}` — one user cannot attach to another user's PTY even by guessing a panel id.
- **Server-side agent registry.** The WS protocol only accepts an agent *name*; the actual command + args resolve on the server. Clients can't spawn arbitrary processes.
- **Origin allowlist.** WS upgrades and CORS restricted to `ALLOWED_ORIGINS` in prod.
- **Rate limits.** Session creation (5/h/IP), keys writes (30/min), ws-tickets (60/min), inbound WS frames (200/sec/connection).
- **No secret passthrough.** PTY children explicitly **do not** inherit provider keys from the server's own `process.env`.

Found a security issue? See [SECURITY.md](./SECURITY.md).

## Architecture

```
artifacts/
  opengrid-canvas/   React + Vite SPA — the canvas UI
  api-server/     Express 5 + ws + node-pty — sessions, files, PTYs
lib/
  api-spec/       OpenAPI source of truth (codegen target)
  api-zod/        Generated Zod schemas
  api-client-react/  Generated React Query hooks
```

In dev the SPA runs under Vite on its own port and talks to the API at `/api/*` via the workspace proxy. In prod the API server can serve the prebuilt SPA from the same port (`SERVE_WEB=1`), and that's what the Docker image does.

## Common commands

| Command | Purpose |
| ------- | ------- |
| `pnpm dev` | Start API (:4000) + web canvas (:5173) together. |
| `pnpm run typecheck` | Full typecheck (libs + leaf packages). Canonical truth. |
| `pnpm run build` | Typecheck + build all packages. |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate Zod + React Query hooks from `lib/api-spec/openapi.yaml`. |
| `pnpm --filter @workspace/api-server run dev` | Build + start the API by itself. |
| `pnpm --filter @workspace/opengrid-canvas run dev` | Vite dev server for the UI by itself. |

## Roadmap

Already shipped:
- ✅ Cookie sessions + per-session workspaces + idle reaper
- ✅ Bracketed-paste, ring-buffer replay, 5-min detach grace
- ✅ Broadcast bar, command palette (⌘K), layout presets, mobile pinch/pan
- ✅ Graceful SIGTERM shutdown, healthz/readyz probes
- ✅ Files API with realpath jail
- ✅ Docker image, PWA install

Next up:
- Files tree UI (Backend ready; tree component still WIP.)
- Saved canvas presets
- Shareable room URLs (multi-user collaboration on one canvas)
- Agent presets / templates ("Debug a Python bug" → spawns claude + aider)
- Hosted demo at `try.opengrid.app`

Want to influence priorities? Open an issue or [sponsor](#support).

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). TL;DR: `pnpm install`, edit, `pnpm run typecheck`, open PR.

## Support

If Open Grid saves you time, consider sponsoring development:

- **GitHub Sponsors** — recurring, supports the maintainer directly
- **Open Collective** — for companies that need invoices / fiscal hosting
- **Polar** — pledge to specific GitHub issues to bump priority

(Links live in [`.github/FUNDING.yml`](.github/FUNDING.yml).)

## License

MIT — see [LICENSE](./LICENSE). Use it however you want, including commercially. Attribution appreciated but not required.
