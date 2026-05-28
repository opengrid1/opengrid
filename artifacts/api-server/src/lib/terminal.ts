import { type IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";
import path from "path";
import fs from "fs";
import { logger } from "./logger";
import { consumeWsTicket, getUserSession, touchUserSession } from "./auth";
import { ensureSessionWorkspace, isInsideSessionWorkspace, sessionWorkspacePath } from "./workspaces";
import {
  attachWs,
  createSession,
  detachWs,
  getSession,
  recordInput,
  snapshotSession,
  getSessionUsage,
} from "./sessions";

// Server-side allowlist. Clients only send the agent key; they CANNOT specify
// an arbitrary command. This prevents the WebSocket from being used as a
// generic RCE channel.
const AGENT_REGISTRY: Record<string, { file: string; args: string[] }> = {
  // --bare forces Anthropic auth to ANTHROPIC_API_KEY only (no OAuth, no
  // keychain reads, no onboarding wizard). Open Grid's whole model is BYO
  // per-session API keys, so the OAuth flow is actively user-hostile here —
  // it doesn't work on mobile and the wizard re-runs every fresh workspace.
  claude: { file: "claude", args: ["--bare"] },
  codex: { file: "codex", args: [] },
  gemini: { file: "gemini", args: [] },
  cursor: { file: "cursor-agent", args: [] },
  grok: { file: "grok", args: [] },
  // @bankr/cli — financial agent CLI from the Bankrbot ecosystem.
  // Unlike claude/codex/gemini (REPLs that own the TTY), bankr is a
  // subcommand-style CLI (`bankr login`, `bankr wallet balance`, `bankr
  // agent run`) — running it bare prints help and exits, which would
  // disconnect the pane immediately. So we spawn a login shell with a
  // one-line banner reminding the user how to auth; bankr itself is on
  // PATH (installed in the Dockerfile), and BANKR_API_KEY is in the
  // PTY env via the per-session key bag.
  bankr: {
    file: "/bin/bash",
    args: [
      "-l",
      "-c",
      "printf '\\033[38;5;215m─ bankr pane ─\\033[0m  try: \\033[1mbankr login --api-key $BANKR_API_KEY\\033[0m, then \\033[1mbankr wallet balance\\033[0m  (\\033[2mbankr --help\\033[0m for all commands)\\n\\n'; exec bash -l",
    ],
  },
  venice: {
    file: "aider",
    args: [
      "--openai-api-base",
      "https://api.venice.ai/api/v1",
      "--model",
      "openai/venice-uncensored",
      "--no-show-model-warnings",
    ],
  },
  shell: { file: process.env.SHELL ?? "/bin/bash", args: ["-l"] },
};

type WireIn =
  | { type: "start"; agent: string; cwd?: string; cols?: number; rows?: number }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "snapshot" };

type WireOut =
  | { type: "data"; data: string }
  | { type: "replay"; data: string }
  | { type: "exit"; code: number }
  | { type: "error"; message: string }
  | { type: "ready"; sessionId: string; agent: string; resumed: boolean }
  | { type: "usage"; bytesIn: number; bytesOut: number; startedAt: number }
  | { type: "snapshot"; path: string }
  | { type: "shutdown"; inSec: number; message: string };

function send(ws: WebSocket, msg: WireOut) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

const ALLOWED_HOSTS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    try {
      return s.includes("://") ? new URL(s).hostname : s;
    } catch {
      return s;
    }
  });
const DEV_MODE = process.env.NODE_ENV !== "production";

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (curl etc.)
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (ALLOWED_HOSTS.includes(u.hostname)) return true;
    if (DEV_MODE) return true;
    return false;
  } catch {
    return false;
  }
}

function validateCwd(
  userSessionId: string,
  requestedCwd: string | undefined,
): { ok: true; cwd: string } | { ok: false; error: string } {
  // Default: the user's per-session workspace root.
  const fallback = ensureSessionWorkspace(userSessionId);
  if (!requestedCwd || typeof requestedCwd !== "string") return { ok: true, cwd: fallback };
  if (!path.isAbsolute(requestedCwd)) {
    return { ok: false, error: `Invalid working directory: must be absolute path (got "${requestedCwd}")` };
  }
  // Canonicalize via realpath BEFORE the workspace check — symlink-escape
  // protection.
  let canonical: string;
  try {
    canonical = fs.realpathSync(requestedCwd);
  } catch (err) {
    return { ok: false, error: `Cannot resolve working directory: ${(err as Error).message}` };
  }
  if (!isInsideSessionWorkspace(userSessionId, canonical)) {
    return { ok: false, error: `Working directory must be inside your workspace.` };
  }
  try {
    const stat = fs.statSync(canonical);
    if (!stat.isDirectory()) {
      return { ok: false, error: `Working directory is not a directory: ${canonical}` };
    }
    fs.accessSync(canonical, fs.constants.R_OK);
    return { ok: true, cwd: canonical };
  } catch (err) {
    return { ok: false, error: `Cannot access working directory: ${(err as Error).message}` };
  }
}

let wss: WebSocketServer | null = null;
const liveSockets = new Set<WebSocket>();

const WS_MAX_PAYLOAD = 512 * 1024;
const INPUT_MAX_FRAMES_PER_SEC = 200;

interface UpgradeContext {
  panelId: string;
  userSessionId: string;
}

function getWss(): WebSocketServer {
  if (wss) return wss;
  wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });

  wss.on("connection", async (ws: WebSocket, _req: IncomingMessage, ctx: UpgradeContext) => {
    const { panelId, userSessionId } = ctx;
    liveSockets.add(ws);
    touchUserSession(userSessionId);
    logger.info({ panelId, userSessionId }, "Terminal WS connected");

    const recentInputs: number[] = [];

    // Heartbeat: while this WS is open, treat its user session as active so
    // the idle reaper doesn't kill a terminal that the user is actively
    // watching (even if they aren't typing). 60s cadence is well under the
    // 2h IDLE_TTL.
    const heartbeat = setInterval(() => {
      if (!touchUserSession(userSessionId)) {
        clearInterval(heartbeat);
        try { ws.close(4001, "session expired"); } catch { /* ignore */ }
      }
    }, 60_000);
    heartbeat.unref();

    // Replay-then-attach if a session already exists.
    const existing = getSession(userSessionId, panelId);
    if (existing) {
      send(ws, { type: "ready", sessionId: panelId, agent: existing.agent, resumed: true });
      if (existing.buffer.length > 0) send(ws, { type: "replay", data: existing.buffer });
      if (existing.exited && existing.exitCode !== null) {
        send(ws, { type: "exit", code: existing.exitCode });
      }
      attachWs(existing, ws);
      const u = getSessionUsage(existing);
      send(ws, { type: "usage", bytesIn: u.bytesIn, bytesOut: u.bytesOut, startedAt: u.startedAt });
    }

    // Periodic context-usage broadcast so the per-pane indicator stays in
    // sync without each client having to poll. 5s cadence is sub-perceptual
    // for a "filling up" bar but cheap (~30 bytes/tick).
    const usagePush = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const s = getSession(userSessionId, panelId);
      if (!s) return;
      const u = getSessionUsage(s);
      send(ws, { type: "usage", bytesIn: u.bytesIn, bytesOut: u.bytesOut, startedAt: u.startedAt });
    }, 5_000);
    usagePush.unref();

    ws.on("message", async (msg: Buffer | string) => {
      let parsed: WireIn;
      try {
        parsed = JSON.parse(msg.toString()) as WireIn;
      } catch {
        return;
      }

      if (parsed.type === "input") {
        // Touch session on every input frame so active typing keeps the
        // reaper at bay regardless of heartbeat timing.
        touchUserSession(userSessionId);
        const now = Date.now();
        const cutoff = now - 1000;
        while (recentInputs.length > 0 && recentInputs[0]! < cutoff) recentInputs.shift();
        recentInputs.push(now);
        if (recentInputs.length > INPUT_MAX_FRAMES_PER_SEC) {
          logger.warn({ panelId, rate: recentInputs.length }, "WS input flood — closing connection");
          try { ws.close(1008, "input rate limit exceeded"); } catch { /* ignore */ }
          return;
        }
      }

      switch (parsed.type) {
        case "start": {
          if (getSession(userSessionId, panelId)) return;
          const entry = AGENT_REGISTRY[parsed.agent];
          if (!entry) {
            send(ws, { type: "error", message: `Unknown agent: ${parsed.agent}` });
            return;
          }
          // Re-resolve the user session at start time — it may have been
          // reaped between WS connect and the first start frame.
          const userSession = getUserSession(userSessionId);
          if (!userSession) {
            send(ws, { type: "error", message: "Your session expired. Refresh to start a new one." });
            try { ws.close(4001, "session expired"); } catch { /* ignore */ }
            return;
          }
          const cwdRes = validateCwd(userSessionId, parsed.cwd);
          if (!cwdRes.ok) {
            send(ws, { type: "error", message: cwdRes.error });
            return;
          }
          const cols = parsed.cols && parsed.cols > 0 ? parsed.cols : 80;
          const rows = parsed.rows && parsed.rows > 0 ? parsed.rows : 24;
          const created = await createSession({
            panelId,
            userSessionId,
            agent: parsed.agent,
            file: entry.file,
            args: entry.args,
            cwd: cwdRes.cwd,
            cols,
            rows,
            envExtra: { ...userSession.apiKeys, HOME: sessionWorkspacePath(userSessionId) },
          });
          if ("error" in created) {
            send(ws, { type: "error", message: created.error });
            return;
          }
          attachWs(created, ws);
          send(ws, { type: "ready", sessionId: panelId, agent: parsed.agent, resumed: false });
          return;
        }
        case "input": {
          const session = getSession(userSessionId, panelId);
          if (session && typeof parsed.data === "string") {
            session.pty.write(parsed.data);
            recordInput(session, parsed.data);
          }
          return;
        }
        case "snapshot": {
          const session = getSession(userSessionId, panelId);
          if (!session) {
            send(ws, { type: "error", message: "No active session to snapshot." });
            return;
          }
          const res = snapshotSession(session);
          if ("error" in res) {
            send(ws, { type: "error", message: res.error });
            return;
          }
          send(ws, { type: "snapshot", path: res.path });
          return;
        }
        case "resize": {
          const session = getSession(userSessionId, panelId);
          if (session && parsed.cols > 0 && parsed.rows > 0) {
            session.cols = parsed.cols;
            session.rows = parsed.rows;
            try {
              session.pty.resize(parsed.cols, parsed.rows);
            } catch (err) {
              logger.warn({ err: (err as Error).message }, "resize failed");
            }
          }
          return;
        }
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      clearInterval(usagePush);
      liveSockets.delete(ws);
      logger.info({ panelId }, "Terminal WS disconnected");
      const session = getSession(userSessionId, panelId);
      if (session) detachWs(session, ws);
    });

    ws.on("error", (err: Error) => {
      logger.error({ err, panelId }, "Terminal WS error");
    });
  });

  return wss;
}

export function closeAllTerminalWs(code: number = 1001, reason: string = "server shutdown"): void {
  for (const ws of liveSockets) {
    try { ws.close(code, reason); } catch { /* ignore */ }
  }
  liveSockets.clear();
}

// Pre-shutdown warning. Broadcast to every live terminal WS so the UI can
// flash a banner before the PTYs are torn down. Matt's point: dying silently
// on a deploy is the worst failure mode, so at minimum we tell users it's
// coming.
export function broadcastShutdown(inSec: number, message: string): number {
  let n = 0;
  for (const ws of liveSockets) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    try {
      ws.send(JSON.stringify({ type: "shutdown", inSec, message } satisfies WireOut));
      n++;
    } catch {
      /* ignore */
    }
  }
  return n;
}

export function handleUpgrade(
  request: IncomingMessage,
  socket: import("net").Socket,
  head: Buffer,
): void {
  const rawUrl = request.url ?? "";
  if (!rawUrl.startsWith("/ws/terminal")) {
    socket.destroy();
    return;
  }

  const origin = request.headers.origin;
  if (!isAllowedOrigin(origin)) {
    logger.warn({ origin }, "Rejected terminal WS from disallowed origin");
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  const url = new URL(rawUrl, "http://localhost");
  const ticket = url.searchParams.get("ticket");
  const consumed = consumeWsTicket(ticket);
  if (!consumed) {
    logger.warn("Rejected terminal WS with bad/missing/expired ticket");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const panelId = url.searchParams.get("sessionId");
  if (!panelId || !/^[a-zA-Z0-9_-]{6,64}$/.test(panelId)) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  const wssInstance = getWss();
  wssInstance.handleUpgrade(request, socket, head, (ws) => {
    wssInstance.emit("connection", ws, request, {
      panelId,
      userSessionId: consumed.userSessionId,
    } satisfies UpgradeContext);
  });
}
