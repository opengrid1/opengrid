#!/bin/bash
# Runs after a successful merge to keep the local checkout in sync with
# whatever changed in the lockfile or generated artifacts.
set -e

pnpm install --frozen-lockfile

# Regenerate the Zod schemas + React Query hooks from the OpenAPI spec
# in case lib/api-spec/openapi.yaml changed.
pnpm --filter @workspace/api-spec run codegen >/dev/null 2>&1 || true
