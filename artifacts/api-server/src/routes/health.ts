import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sessionCount } from "../lib/sessions";

const router: IRouter = Router();

const MAX_SESSIONS_FOR_READY = Number(process.env.MAX_SESSIONS ?? 64);
// Match the env name used everywhere else (`WORKSPACES_ROOT`, plural) and
// fall back to the same default as workspaces.ts.
const WORKSPACE_ROOT = path.resolve(
  process.env.WORKSPACES_ROOT ??
    (process.env.HOME ? path.join(process.env.HOME, ".opengrid-workspaces") : "/tmp/opengrid-workspaces"),
);

// Liveness: process is up. Cheap, never depends on anything external.
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    uptime: process.uptime(),
    sessions: sessionCount(),
  });
});

// Readiness: process is up AND able to actually serve requests (workspace
// writable, session budget remaining). Used by orchestrators to gate traffic.
router.get("/readyz", async (_req, res) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  let allOk = true;

  try {
    await fs.access(WORKSPACE_ROOT, fsConstants.R_OK | fsConstants.W_OK);
    checks.workspace = { ok: true };
  } catch (err) {
    checks.workspace = { ok: false, detail: (err as Error).message };
    allOk = false;
  }

  const sessions = sessionCount();
  const sessionsOk = sessions < MAX_SESSIONS_FOR_READY;
  checks.sessions = {
    ok: sessionsOk,
    detail: `${sessions}/${MAX_SESSIONS_FOR_READY}`,
  };
  if (!sessionsOk) allOk = false;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ready" : "not-ready",
    uptime: process.uptime(),
    checks,
  });
});

export default router;
