import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { handleUpgrade, closeAllTerminalWs } from "./lib/terminal";
import { shutdownAllSessions } from "./lib/sessions";

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
  logger.info({ signal }, "Shutdown requested, draining…");

  // Stop accepting new HTTP connections.
  server.close((err) => {
    if (err) logger.error({ err }, "HTTP server close error");
  });

  // Close all open WS sockets, then kill all PTYs deterministically.
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

  // Give in-flight work a moment, then exit.
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
