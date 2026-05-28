# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────────────────
# Open Grid — single-image, single-port deployment.
#   stage `builder`   installs deps + builds the SPA and the API bundle
#   stage `runtime`   minimal node:slim with python3 in PATH (some agent CLIs
#                     need it) and just the production artefacts
# Final image runs the API server, which also serves the SPA on the same port.
# ──────────────────────────────────────────────────────────────────────────────

FROM node:20-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1

# Toolchain for node-pty's native build + git for any postinstall hooks.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy lockfile + workspace manifest first for better cache layer reuse.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json tsconfig.json ./
COPY .npmrc ./

# Copy every package.json so pnpm can resolve the workspace graph before
# the source files invalidate the install layer.
COPY lib/api-spec/package.json           lib/api-spec/
COPY lib/api-zod/package.json            lib/api-zod/
COPY lib/api-client-react/package.json   lib/api-client-react/
COPY artifacts/api-server/package.json   artifacts/api-server/
COPY artifacts/opengrid-canvas/package.json artifacts/opengrid-canvas/
COPY scripts/package.json                scripts/

RUN --mount=type=cache,id=s/011eaa1f-a803-4047-8896-7b437766c7d6-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Now bring in the rest of the source.
COPY . .

# Codegen + build everything.
ENV PORT=8080 \
    BASE_PATH=/
RUN pnpm --filter @workspace/api-spec run codegen \
 && pnpm run typecheck:libs \
 && pnpm --filter @workspace/opengrid-canvas run build \
 && pnpm --filter @workspace/api-server  run build

# Prune to production deps for the api-server only (we don't ship the SPA's
# devDeps in the runtime image — only its built static files).
RUN pnpm --filter @workspace/api-server deploy --legacy --prod /out/api-server

# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    SERVE_WEB=1 \
    WORKSPACES_ROOT=/var/lib/opengrid

# System deps:
#   python3 + pip   — aider-chat runtime
#   ca-certificates — outbound HTTPS to LLM providers
#   tini            — proper PID 1 + signal handling
#   curl            — cursor-agent installer
#   git             — many agents shell out to git
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 python3-pip python3-venv ca-certificates tini curl git \
  && rm -rf /var/lib/apt/lists/*

# ──────────────────────────────────────────────────────────────────────────────
# Agent CLIs.
#
# Mapping to AGENT_REGISTRY in artifacts/api-server/src/lib/terminal.ts:
#   claude       → @anthropic-ai/claude-code  (npm)
#   codex        → @openai/codex              (npm)
#   gemini       → @google/gemini-cli         (npm)
#   cursor-agent → cursor.com installer       (curl | bash)
#   aider        → aider-chat                 (pip, used by `venice` panel)
#   grok         → xAI grok-cli               (not on public npm — manual)
#
# Installed globally before the USER drop so any per-session HOME override
# still resolves them via /usr/local/bin on PATH. PTY children launched by
# the API server inherit this PATH.
#
# `|| true` per agent so a transient registry failure for one CLI doesn't
# tank the whole image build — server reports availability via /api/cli-status.
# ──────────────────────────────────────────────────────────────────────────────
RUN set -eux \
  && npm config set fund false \
  && npm config set audit false \
  && (npm install -g @anthropic-ai/claude-code || echo "WARN: claude-code install failed") \
  && (npm install -g @openai/codex             || echo "WARN: codex install failed") \
  && (npm install -g @google/gemini-cli        || echo "WARN: gemini-cli install failed") \
  && (pip3 install --break-system-packages --no-cache-dir aider-chat || echo "WARN: aider install failed") \
  && (curl -fsSL https://cursor.com/install | bash || echo "WARN: cursor-agent install failed") \
  && if [ -f /root/.local/bin/cursor-agent ]; then \
        install -m 0755 /root/.local/bin/cursor-agent /usr/local/bin/cursor-agent; \
     fi \
  && npm cache clean --force || true

# Non-root.
RUN useradd --system --create-home --uid 10001 opengrid \
 && mkdir -p /var/lib/opengrid \
 && chown -R opengrid:opengrid /var/lib/opengrid

WORKDIR /app

# API server (pruned prod deps + esbuild bundle).
COPY --from=builder --chown=opengrid:opengrid /out/api-server /app/api-server
# Prebuilt SPA — api-server will serve it via SERVE_WEB=1.
COPY --from=builder --chown=opengrid:opengrid /app/artifacts/opengrid-canvas/dist/public /app/web

ENV WEB_DIST=/app/web

USER opengrid
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "/app/api-server/dist/index.mjs"]
