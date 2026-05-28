import { Router, type IRouter } from "express";
import {
  ALLOWED_API_KEYS,
  COOKIE_NAME,
  clearSessionCookie,
  createUserSession,
  destroyUserSession,
  getReqSession,
  issueWsTicket,
  readSessionFromCookie,
  requireSession,
  setSessionCookie,
} from "../lib/auth";
import { rateLimit } from "../lib/ratelimit";

const router: IRouter = Router();

// ─── Session lifecycle ────────────────────────────────────────────────────
// No login. The client just calls POST /api/auth/session on first load; the
// server issues a signed cookie + creates an ephemeral workspace.

router.get("/auth/check", (req, res) => {
  const s = readSessionFromCookie(req);
  res.json({ hasSession: !!s });
});

// Per-IP rate limit on session creation: each IP gets 5 fresh sessions per
// hour. Refreshes / GETs do not count.
router.post(
  "/auth/session",
  rateLimit({ name: "session-create", windowMs: 60 * 60 * 1000, max: 5 }),
  (req, res) => {
    // If they already have a valid cookie, reuse it (idempotent).
    const existing = readSessionFromCookie(req);
    if (existing) {
      res.json({ id: existing.id, createdAt: existing.createdAt, apiKeysSet: Object.keys(existing.apiKeys) });
      return;
    }
    const session = createUserSession();
    setSessionCookie(res, session.id);
    res.json({ id: session.id, createdAt: session.createdAt, apiKeysSet: [] });
  },
);

router.get("/auth/session", requireSession, (req, res) => {
  const s = getReqSession(req);
  res.json({ id: s.id, createdAt: s.createdAt, apiKeysSet: Object.keys(s.apiKeys) });
});

router.delete("/auth/session", (req, res) => {
  const s = readSessionFromCookie(req);
  if (s) destroyUserSession(s.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ─── BYO API keys ─────────────────────────────────────────────────────────
// Stored in-memory only, namespaced to the user session. Forwarded into the
// PTY environment when an agent CLI is spawned. Never echoed back.

router.get("/auth/keys", requireSession, (req, res) => {
  const s = getReqSession(req);
  // Return names only, never values.
  res.json({ keys: Object.keys(s.apiKeys), allowed: [...ALLOWED_API_KEYS] });
});

router.put(
  "/auth/keys",
  rateLimit({ name: "keys-write", windowMs: 60_000, max: 30 }),
  requireSession,
  (req, res) => {
    const s = getReqSession(req);
    const body = req.body as { keys?: Record<string, unknown> } | undefined;
    const incoming = body?.keys;
    if (!incoming || typeof incoming !== "object") {
      res.status(400).json({ error: "Expected { keys: { NAME: 'value' | null, ... } }" });
      return;
    }
    let changed = 0;
    for (const [k, v] of Object.entries(incoming)) {
      if (!ALLOWED_API_KEYS.has(k)) continue;
      if (v === null || v === "") {
        if (k in s.apiKeys) {
          delete s.apiKeys[k];
          changed++;
        }
        continue;
      }
      if (typeof v !== "string") continue;
      if (v.length > 4096) continue;
      s.apiKeys[k] = v;
      changed++;
    }
    res.json({ ok: true, changed, keys: Object.keys(s.apiKeys) });
  },
);

// ─── WS ticket ────────────────────────────────────────────────────────────
// Exchange the cookie session for a single-use, 30s ticket bound to it.
router.post(
  "/auth/ws-ticket",
  rateLimit({ name: "ws-ticket", windowMs: 60_000, max: 60 }),
  requireSession,
  (req, res) => {
    const s = getReqSession(req);
    const { ticket, expiresAt } = issueWsTicket(s.id);
    res.json({ ticket, expiresAt });
  },
);

export { COOKIE_NAME };
export default router;
