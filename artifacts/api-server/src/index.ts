import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { handleUpgrade, closeAllTerminalWs, broadcastShutdown } from "./lib/terminal";
import { shutdownAllSessions } from "./lib/sessions";

// Seconds between SIGTERM and actually killing PTYs. Gives the client UI
// time to render a warning banner so users can copy their work or hit the
// per-pane "snapshot" button before the agent dies.
const SHUTDOWN_GRACE_SEC = Number(process.env.SHUTDOWN_GRACE_SEC ?? 4);

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

server.on("upgrade", (request, socket, head) => {
  handleUpgrade(request, socket as import("net").Socket, head);
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal, graceSec: SHUTDOWN_GRACE_SEC }, "Shutdown requested, warning clients…");

  // Phase 1: tell every connected terminal that the server is going down.
  // Doesn't actually fix the session-death problem (Matt is right that the
  // real fix is process persistence), but it converts "agent vanished
  // silently mid-thought" into "user got 4 seconds of warning + a snapshot
  // button". Big perceived improvement for zero new infrastructure.
  try {
    const notified = broadcastShutdown(
      SHUTDOWN_GRACE_SEC,
      "Server is restarting. Use the snapshot button to save your conversation.",
    );
    if (notified > 0) {
      logger.info({ notified, graceSec: SHUTDOWN_GRACE_SEC }, "Shutdown warning broadcast");
    }
  } catch (err) {
    logger.error({ err }, "Error broadcasting shutdown warning");
  }

  // Stop accepting new HTTP connections immediately.
  server.close((err) => {
    if (err) logger.error({ err }, "HTTP server close error");
  });

  // Phase 2: wait the grace window so the warning actually reaches the
  // browser AND the user has a beat to tap "snapshot" before everything
  // gets killed.
  await new Promise<void>((resolve) =>
    setTimeout(resolve, SHUTDOWN_GRACE_SEC * 1000),
  );

  // Phase 3: tear down WS sockets, then kill all PTYs deterministically.
  try {
    closeAllTerminalWs(1001, "server shutting down");
  } catch (err) {
    logger.error({ err }, "Error closing WS sockets");
  }

  try {
    shutdownAllSessions();
  } catch (err) {
    logger.error({ err }, "Error shutting down PTY sessions");
  }

  // Final drain — give in-flight Node IO a moment, then exit.
  setTimeout(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  }, 1500);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Fatal crash policy: log, attempt graceful WS+PTY teardown, then exit so the
// supervisor (systemd, pm2, docker, etc.) restarts us cleanly instead of
// running on in an undefined state. The 2s timeout bounds the drain.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — exiting");
  try { closeAllTerminalWs(1011, "server crashed"); } catch { /* ignore */ }
  try { shutdownAllSessions(); } catch { /* ignore */ }
  setTimeout(() => process.exit(1), 500).unref();
});
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection — exiting");
  try { closeAllTerminalWs(1011, "server crashed"); } catch { /* ignore */ }
  try { shutdownAllSessions(); } catch { /* ignore */ }
  setTimeout(() => process.exit(1), 500).unref();
});
