import type { Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "crypto";
import { logger } from "./logger";
import { ensureSessionWorkspace, removeSessionWorkspace } from "./workspaces";
import { shutdownUserSessions } from "./sessions";

// ─────────────────────────────────────────────────────────────────────────────
// Open Grid uses ephemeral, cookie-based sessions. There is NO login.
// On first visit, the client calls POST /api/auth/session and the server
// issues a signed cookie identifying that browser. The cookie's signing key
// is SESSION_SECRET (required in production).
//
// Each session maps to:
//   - an isolated workspace directory under WORKSPACES_ROOT/<id>
//   - an in-memory bag of BYO LLM API keys (never persisted to disk)
//
// Sessions auto-expire after IDLE_TTL_MS of inactivity; a sweeper kills the
// workspace and forgets the keys.
// ─────────────────────────────────────────────────────────────────────────────

const SECRET = process.env.SESSION_SECRET ?? "";
const isProd = process.env.NODE_ENV === "production";

if (isProd && SECRET.length < 16) {
  throw new Error(
    "SESSION_SECRET is required in production and must be at least 16 characters. " +
      "Generate one with: openssl rand -hex 32",
  );
}

// Fallback dev signing key — never used in production (throws above).
const SIGNING_KEY = SECRET.length >= 16 ? SECRET : "dev-only-insecure-signing-key-do-not-use-in-prod";

export const COOKIE_NAME = "og_sid";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IDLE_TTL_MS = 2 * 60 * 60 * 1000;            // 2 hours of inactivity → reap
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;          // sweep every 10 minutes
const MAX_USER_SESSIONS = Number(process.env.MAX_USER_SESSIONS ?? 500);

// Allowlist of provider keys a user may set per-session. Anything else is
// silently dropped. Keep in sync with sessions.ts ENV_PASSTHROUGH.
export const ALLOWED_API_KEYS = new Set<string>([
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN",
  "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_API_BASE",
  "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY",
  "XAI_API_KEY", "GROK_API_KEY",
  "CURSOR_API_KEY",
  "VENICE_API_KEY",
  "AIDER_MODEL", "AIDER_API_KEY",
  "GITHUB_TOKEN", "GH_TOKEN",
  // Bankr CLI API key (format: bk_...). Picked up by `@bankr/cli` for
  // non-interactive login in fresh per-session PTYs.
  "BANKR_API_KEY",
]);

interface UserSession {
  id: string;
  createdAt: number;
  lastSeen: number;
  apiKeys: Record<string, string>;
  workspace: string;
}

const userSessions = new Map<string, UserSession>();

function hmac(value: string): string {
  return crypto.createHmac("sha256", SIGNING_KEY).update(value).digest("base64url");
}

function signSessionId(id: string): string {
  return `${id}.${hmac(id)}`;
}

function verifyCookie(cookie: string | undefined | null): string | null {
  if (typeof cookie !== "string" || cookie.length === 0) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot < 1) return null;
  const id = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = hmac(id);
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return id;
}

function newSessionId(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function createUserSession(): UserSession {
  if (userSessions.size >= MAX_USER_SESSIONS) {
    // Force-sweep to make room. If still full, reap the oldest.
    sweepIdleSessions();
    if (userSessions.size >= MAX_USER_SESSIONS) {
      const oldest = [...userSessions.values()].sort((a, b) => a.lastSeen - b.lastSeen)[0];
      if (oldest) destroyUserSession(oldest.id);
    }
  }
  const id = newSessionId();
  const workspace = ensureSessionWorkspace(id);
  const now = Date.now();
  const session: UserSession = { id, createdAt: now, lastSeen: now, apiKeys: {}, workspace };
  userSessions.set(id, session);
  logger.info({ sessionId: id, workspace }, "User session created");
  return session;
}

export function getUserSession(id: string | null | undefined): UserSession | null {
  if (!id) return null;
  const s = userSessions.get(id);
  if (!s) return null;
  s.lastSeen = Date.now();
  return s;
}

export function destroyUserSession(id: string): void {
  const s = userSessions.get(id);
  if (!s) return;
  userSessions.delete(id);
  // Kill any live PTYs owned by this user BEFORE removing the workspace so
  // child processes don't keep writing into a dir that's about to be rm-rf'd.
  try {
    shutdownUserSessions(s.id);
  } catch (err) {
    logger.warn({ err: (err as Error).message, sessionId: id }, "Error killing PTYs during session destroy");
  }
  void removeSessionWorkspace(s.id);
  logger.info({ sessionId: id }, "User session destroyed");
}

// Refresh lastSeen on activity. Returns true if the session is still alive.
// Cheap enough to call on every WS input frame.
export function touchUserSession(id: string): boolean {
  const s = userSessions.get(id);
  if (!s) return false;
  s.lastSeen = Date.now();
  return true;
}

export function userSessionCount(): number {
  return userSessions.size;
}

export function sweepIdleSessions(): void {
  const cutoff = Date.now() - IDLE_TTL_MS;
  let reaped = 0;
  for (const s of [...userSessions.values()]) {
    if (s.lastSeen < cutoff) {
      destroyUserSession(s.id);
      reaped++;
    }
  }
  if (reaped > 0) logger.info({ reaped, remaining: userSessions.size }, "Swept idle user sessions");
}

// Start the sweeper on import. unref() so it doesn't keep the process alive
// during shutdown.
const sweeper = setInterval(sweepIdleSessions, SWEEP_INTERVAL_MS);
sweeper.unref();

// ─── Cookie helpers ────────────────────────────────────────────────────────

export function setSessionCookie(res: Response, id: string): void {
  const signed = signSessionId(id);
  res.cookie(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function readSessionFromCookie(req: Request): UserSession | null {
  // Express types for cookie-parser augment req.cookies at runtime; treat
  // permissively here.
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};
  const id = verifyCookie(cookies[COOKIE_NAME]);
  return getUserSession(id);
}

// Middleware: require a valid session cookie. Most /api/* routes use this.
// Auth endpoints (/auth/session) that may run BEFORE a session exists must
// not use this.
export const requireSession: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const session = readSessionFromCookie(req);
  if (!session) {
    res.status(401).json({ error: "No session — call POST /api/auth/session first." });
    return;
  }
  (req as unknown as { userSession: UserSession }).userSession = session;
  next();
};

export function getReqSession(req: Request): UserSession {
  const s = (req as unknown as { userSession?: UserSession }).userSession;
  if (!s) throw new Error("requireSession middleware not applied");
  return s;
}

// ─── One-time short-lived WebSocket tickets ───────────────────────────────
// Avoids putting any session identifier in the WS URL query string (visible
// in proxy/access logs). Each ticket carries the userSessionId it was issued
// for; consumption returns that id so the WS handler can look up the right
// workspace + keys.
const TICKET_TTL_MS = 30_000;
const tickets = new Map<string, { userSessionId: string; expiresAt: number }>();

function gcTickets() {
  const now = Date.now();
  for (const [t, v] of tickets) if (v.expiresAt < now) tickets.delete(t);
}

export function issueWsTicket(userSessionId: string): { ticket: string; expiresAt: number } {
  gcTickets();
  const ticket = crypto.randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + TICKET_TTL_MS;
  tickets.set(ticket, { userSessionId, expiresAt });
  return { ticket, expiresAt };
}

export function consumeWsTicket(ticket: string | undefined | null): { userSessionId: string } | null {
  if (typeof ticket !== "string" || ticket.length === 0) return null;
  const v = tickets.get(ticket);
  if (!v) return null;
  tickets.delete(ticket);
  if (v.expiresAt < Date.now()) return null;
  const session = getUserSession(v.userSessionId);
  if (!session) return null;
  return { userSessionId: v.userSessionId };
}
