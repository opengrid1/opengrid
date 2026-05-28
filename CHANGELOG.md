# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- One-command dev script: `pnpm dev` boots the API on :4000 and the web canvas
  on :5173 in a single terminal via `concurrently`.
- `.env.example` documenting every supported environment variable.
- Landing page: mobile hamburger nav, smooth-scroll for in-page anchors,
  proper Open Graph + Twitter image meta so shared links render a preview.
- Community files: `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, GitHub issue +
  PR templates.

### Changed
- Bumped CI workflow and Dockerfile to pnpm v10 (was v9.15.0).
- Improved landing page text contrast for WCAG AA compliance on key taglines.
- Refactored hardcoded GitHub URLs into a single `REPO_URL` constant so a
  fork can rename in one place.

### Removed
- `artifacts/mockup-sandbox` — internal design playground, never referenced
  at runtime.
- `lib/db` and the unused `@workspace/db` / `drizzle-orm` dependencies from
  the api-server. Database persistence is still on the roadmap but lives
  behind a feature flag now.

### Fixed
- CI: `pnpm install --frozen-lockfile` no longer fails with
  `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Regenerated lockfile against the
  current workspace config.
- Dockerfile: pass `--legacy` to `pnpm deploy` to keep the existing
  non-injected-workspace semantics under pnpm v10.

## [0.1.0] — 2026-05-28

Initial public release.

### Features
- Multi-pane terminal canvas with real PTYs for `claude`, `codex`, `gemini`,
  `cursor-agent`, `grok`, `aider`, and plain shells.
- Cookie-based ephemeral sessions — no accounts.
- BYO LLM keys via in-memory key bag, never written to disk.
- Broadcast bar: type once, fan out to every selected pane.
- 5-minute detach grace + 256 KB ring-buffer replay on reconnect.
- 2-hour idle reaper destroys stale sessions (PTYs + workspace dir + keys).
- Per-session workspace jail with `realpath`-checked file API.
- WebSocket ticket auth so session ids never appear in proxy logs.
- Mobile-first: bracketed paste, pinch-zoom canvas, on-screen ⌃/⎋ helpers.
- Single-port Docker image (API + prebuilt SPA on one port).
