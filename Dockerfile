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
COPY lib/db/package.json                 lib/db/
COPY artifacts/api-server/package.json   artifacts/api-server/
COPY artifacts/opengrid-canvas/package.json artifacts/opengrid-canvas/
COPY scripts/package.json                scripts/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
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

# python3 is occasionally needed by `aider` and by some CLI agents. ca-certs
# for outbound HTTPS to LLM providers. tini for proper PID 1 + signal handling.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

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
