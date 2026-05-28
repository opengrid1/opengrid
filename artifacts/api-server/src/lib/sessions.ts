import { logger } from "./logger";
import type { WebSocket } from "ws";

export interface IPty {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number }) => void) => void;
}

interface NodePtyModule {
  spawn: (
    file: string,
    args: string[],
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: Record<string, string>;
    },
  ) => IPty;
}

const DETACH_GRACE_MS = 5 * 60 * 1000; // 5 minutes after last client disconnects, kill PTY
const BUFFER_MAX_BYTES = 256 * 1024; // last 256KB of output, replayed on reattach
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS ?? 64);
// If the client can't drain output fast enough (mobile on flaky network,
// background tab), stop sending new data once this much is buffered in the
// socket. Lost output is still captured in the server-side ring buffer and
// replayed on reconnect, so nothing is permanently lost.
const WS_BACKPRESSURE_HIGH_BYTES = 1 * 1024 * 1024; // 1MB outbound buffer cap

// Base environment passthrough for spawned PTY children. We MUST NOT pass
// server secrets (SESSION_SECRET, DATABASE_URL, internal API keys) into a
// shell or agent CLI — they would be trivially exfiltratable via `env` /
// `printenv` from inside the terminal pane.
//
// Provider API keys are NEVER read from process.env any more; they come
// exclusively from the user's per-session key bag (see auth.ts).
const ENV_PASSTHROUGH = new Set<string>([
  "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "LC_CTYPE",
  "TERM", "TERMINFO", "TZ", "TMPDIR", "PWD", "DISPLAY",
  "PATH", "NODE_PATH", "NPM_CONFIG_PREFIX",
]);
// Things that look secretive — never pass through even if listed accidentally.
const ENV_BLOCKLIST_RE = /^(SESSION_SECRET|DATABASE_URL|REPLIT_|REPL_|.*_PRIVATE_KEY|.*_SECRET_KEY|.*_WEBHOOK_SECRET|JWT_SECRET|COOKIE_SECRET|SMTP_PASS(WORD)?|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|STRIPE_SECRET)$/i;

function buildChildEnv(extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== "string") continue;
    if (ENV_BLOCKLIST_RE.test(k)) continue;
    if (!ENV_PASSTHROUGH.has(k)) continue;
    out[k] = v;
  }
  // User-supplied per-session API keys override / extend the base. We trust
  // these because they came from the authenticated user and the route handler
  // already validated each name against ALLOWED_API_KEYS.
  for (const [k, v] of Object.entries(extra)) {
    if (ENV_BLOCKLIST_RE.test(k)) continue;
    if (typeof v !== "string") continue;
    out[k] = v;
  }
  // node-pty requires TERM; default to xterm-256color if missing on host.
  if (!out.TERM) out.TERM = "xterm-256color";
  return out;
}

export interface Session {
  id: string;          // internal key: `${userSessionId}:${panelSessionId}`
  panelId: string;     // panel-level id as supplied by the client
  userSessionId: string;
  agent: string;
  cwd: string;
  pty: IPty;
  buffer: string;
  cols: number;
  rows: number;
  ws: WebSocket | null;
  detachTimer: NodeJS.Timeout | null;
  exited: boolean;
  exitCode: number | null;
}

const sessions = new Map<string, Session>();
// Per-id creation lock to prevent two concurrent `start` frames from racing
// and spawning duplicate orphan PTYs.
const pending = new Set<string>();
let nodePty: NodePtyModule | null = null;
let nodePtyLoaded = false;

async function loadNodePty(): Promise<NodePtyModule | null> {
  if (nodePtyLoaded) return nodePty;
  nodePtyLoaded = true;
  try {
    nodePty = (await import("node-pty")) as unknown as NodePtyModule;
    return nodePty;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "node-pty unavailable");
    return null;
  }
}

export function sessionKey(userSessionId: string, panelId: string): string {
  return `${userSessionId}:${panelId}`;
}

export function getSession(userSessionId: string, panelId: string): Session | undefined {
  return sessions.get(sessionKey(userSessionId, panelId));
}

export interface SpawnArgs {
  panelId: string;
  userSessionId: string;
  agent: string;
  file: string;
  args: string[];
  cwd: string;
  cols: number;
  rows: number;
  envExtra: Record<string, string>;
}

export async function createSession(args: SpawnArgs): Promise<Session | { error: string }> {
  const id = sessionKey(args.userSessionId, args.panelId);
  if (sessions.has(id)) return { error: "Session already exists" };
  if (pending.has(id)) return { error: "Session is being created" };
  if (sessions.size + pending.size >= MAX_SESSIONS) {
    return { error: `Session limit reached (${MAX_SESSIONS}). Close an existing terminal first.` };
  }
  pending.add(id);

  const mod = await loadNodePty();
  if (!mod) {
    pending.delete(id);
    return { error: "Terminal backend unavailable. node-pty native bindings failed to load." };
  }

  let pty: IPty;
  try {
    pty = mod.spawn(args.file, args.args, {
      name: "xterm-256color",
      cols: args.cols,
      rows: args.rows,
      cwd: args.cwd,
      env: buildChildEnv(args.envExtra),
    });
  } catch (err) {
    pending.delete(id);
    logger.error({ err, agent: args.agent }, "Failed to spawn pty");
    return { error: `Failed to spawn '${args.file}': ${(err as Error).message}. Is the CLI installed?` };
  }

  const session: Session = {
    id,
    panelId: args.panelId,
    userSessionId: args.userSessionId,
    agent: args.agent,
    cwd: args.cwd,
    pty,
    buffer: "",
    cols: args.cols,
    rows: args.rows,
    ws: null,
    detachTimer: null,
    exited: false,
    exitCode: null,
  };

  pty.onData((data) => {
    session.buffer = (session.buffer + data).slice(-BUFFER_MAX_BYTES);
    const ws = session.ws;
    if (!ws || ws.readyState !== 1 /* OPEN */) return;
    if (ws.bufferedAmount > WS_BACKPRESSURE_HIGH_BYTES) {
      return;
    }
    ws.send(JSON.stringify({ type: "data", data }));
  });

  pty.onExit(({ exitCode }) => {
    session.exited = true;
    session.exitCode = exitCode;
    const ws = session.ws;
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: "exit", code: exitCode })); } catch { /* ignore */ }
      try { ws.close(1000, "process exited"); } catch { /* ignore */ }
    }
    if (session.detachTimer) clearTimeout(session.detachTimer);
    sessions.delete(session.id);
    logger.info({ sessionId: session.id, agent: session.agent, exitCode }, "Session exited");
  });

  sessions.set(id, session);
  pending.delete(id);
  logger.info({ sessionId: id, agent: args.agent, cwd: args.cwd }, "Session created");
  return session;
}

export function attachWs(session: Session, ws: WebSocket): void {
  if (session.ws && session.ws !== ws && session.ws.readyState === 1) {
    try { session.ws.close(4000, "superseded by new client"); } catch { /* ignore */ }
  }
  if (session.detachTimer) {
    clearTimeout(session.detachTimer);
    session.detachTimer = null;
  }
  session.ws = ws;
}

export function sessionCount(): number {
  return sessions.size;
}

export function shutdownAllSessions(): void {
  for (const session of sessions.values()) {
    if (session.detachTimer) {
      clearTimeout(session.detachTimer);
      session.detachTimer = null;
    }
    try { session.pty.kill(); } catch { /* ignore */ }
  }
  sessions.clear();
  logger.info("All PTY sessions terminated");
}

// Kill all PTYs belonging to a single user session (called when their cookie
// session is destroyed / reaped). Returns count killed.
export function shutdownUserSessions(userSessionId: string): number {
  let n = 0;
  for (const session of [...sessions.values()]) {
    if (session.userSessionId !== userSessionId) continue;
    if (session.detachTimer) { clearTimeout(session.detachTimer); session.detachTimer = null; }
    try { session.pty.kill(); } catch { /* ignore */ }
    sessions.delete(session.id);
    n++;
  }
  if (n > 0) logger.info({ userSessionId, killed: n }, "Killed PTYs for reaped user session");
  return n;
}

export function detachWs(session: Session, ws: WebSocket): void {
  if (session.ws !== ws) return;
  session.ws = null;
  if (session.exited) {
    sessions.delete(session.id);
    return;
  }
  session.detachTimer = setTimeout(() => {
    if (!session.ws) {
      try { session.pty.kill(); } catch { /* ignore */ }
      sessions.delete(session.id);
      logger.info({ sessionId: session.id }, "Session reaped after detach grace");
    }
  }, DETACH_GRACE_MS);
}
