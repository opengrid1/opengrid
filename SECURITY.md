# Security policy

## Supported versions

Open Grid is pre-1.0. Only the **latest `main`** is supported. There are no
backported security patches yet — please run a recent build.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Email: `security@opengrid.dev` — **fork maintainers must update this to a real, monitored address before publishing.**

Include:

- A description of the issue and its impact.
- Reproduction steps (a minimal POC is gold).
- Affected commit SHA or release tag.
- Your name / handle for credit, if you want it.

Optional: PGP key fingerprint goes here once published.

### What to expect

- **Acknowledgement** within 72 hours.
- **Triage + severity assessment** within 7 days.
- **Patch on `main`** as soon as the fix is verified; coordinated disclosure
  date agreed with you (typically 14–90 days depending on severity and
  whether mitigations exist).
- **Public credit** in the release notes unless you request anonymity.

We do not currently run a paid bug bounty. We'll happily mention you in the
README hall-of-fame for any verified issue.

## Scope

In scope:

- The API server (`artifacts/api-server`).
- The web canvas (`artifacts/opengrid-canvas`).
- The WebSocket terminal protocol.
- The session / cookie / WS-ticket auth model.
- Any path that can escape the per-session workspace jail.
- Any path that can read another user's PTY, files, or API keys.
- Any RCE that doesn't already require a legitimate session
  (sessions inherently give you a PTY by design).

Out of scope:

- Volunteered DoS by running expensive agent commands inside your own
  session — that's how the product works; bound it with cgroups at deploy.
- Issues that require physical access to a user's unlocked device.
- Issues only reproducible on outdated forks.

## Threat model — short version

- Authenticated user trusts the server with their LLM API keys (in memory
  only, never disk).
- An anonymous attacker should not be able to read or write any session's
  files, attach to its PTYs, recover its keys, or impersonate it.
- A session must not be able to escape its workspace jail, attach to another
  session's PTY, or trigger arbitrary command execution outside the
  server-side `AGENT_REGISTRY`.

## Hardening checklist for self-hosters

- Run the container with a non-root user (the published image already does).
- Put it behind nginx/Caddy/Cloudflare with TLS and HSTS.
- Set strict `ALLOWED_ORIGINS` — never `*`.
- Cap CPU/RAM via cgroups (Docker `--memory` `--cpus`, k8s limits).
- Quota `WORKSPACES_ROOT` on disk.
- Rotate `SESSION_SECRET` periodically (invalidates all live cookies).
- Don't expose the bare container port to the public internet — always
  proxy through TLS.
