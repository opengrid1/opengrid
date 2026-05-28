# Contributing to Open Grid

Thanks for your interest. Small fixes don't need a heads-up; for larger
changes, open an issue first so we don't both ship the same thing.

## Dev loop

```bash
pnpm install
export SESSION_SECRET=$(openssl rand -hex 32)
PORT=4000 pnpm --filter @workspace/api-server  run dev   # API + WS
PORT=5173 pnpm --filter @workspace/opengrid-canvas run dev  # web canvas
```

After any change, run the canonical typecheck:

```bash
pnpm run typecheck
```

Editor / LSP diagnostics can lie when composite project references get out
of sync — trust the CLI.

## Code conventions

- **TypeScript everywhere**, strict mode.
- **No `console.log` in server code** — use `req.log` in handlers, the
  singleton `logger` elsewhere. See `.local/skills/pnpm-workspace/references/server.md`.
- **OpenAPI is the API contract** — change `lib/api-spec/openapi.yaml`, run
  `pnpm --filter @workspace/api-spec run codegen`, then the API server and
  the React client are both regenerated. Don't hand-write request/response
  types.
- **No new top-level deps without a reason.** Prefer the existing UI
  primitives in `artifacts/opengrid-canvas/src/components/ui/`.
- **Workspace package names** use the `@workspace/` prefix.
- See `.local/skills/pnpm-workspace/SKILL.md` for monorepo rules
  (devDependencies vs dependencies, project references, etc).

## What we'll happily merge

- Bug fixes with a clear reproduction.
- New agent integrations (add to `AGENT_REGISTRY` in
  `artifacts/api-server/src/lib/terminal.ts` and `AGENT_PRESETS` in
  `artifacts/opengrid-canvas/src/lib/store.ts`).
- Accessibility fixes.
- Mobile/safe-area fixes — we test on iPhone Safari and stock Android.
- Reverse-proxy snippets (nginx, Caddy, Traefik, k8s ingress) in `docs/`.
- Better docs.

## What we'll probably push back on

- Adding accounts/login. The "no accounts" model is a load-bearing design
  decision. If you need auth, deploy behind your own SSO proxy.
- Adding analytics/telemetry to the SPA or the server. We don't ship those.
- Crypto-token / on-chain anything.
- Vendor-specific deploy code (AWS-only / Vercel-only / etc.) — keep the
  core portable.
- Massive feature PRs without prior discussion.

## Commit + PR style

- Conventional commits encouraged but not required:
  `feat(canvas): pinch-zoom on Android`
- Keep PRs focused. Split unrelated changes into separate PRs.
- Update `replit.md` if you change a load-bearing behaviour.
- A short test plan in the PR description is appreciated, even if it's
  just "manual: opened 3 panes on iPhone, broadcast, ok".

## Security issues

Don't open a public issue. See [SECURITY.md](./SECURITY.md).

## License

By submitting a PR you agree your contribution is licensed under MIT, the
same as the rest of the project.
