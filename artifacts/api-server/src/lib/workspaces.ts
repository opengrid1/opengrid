import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { logger } from "./logger";

const HOME = process.env.HOME ?? "/home/runner";

export const WORKSPACES_ROOT = path.resolve(
  process.env.WORKSPACES_ROOT ?? process.env.WORKSPACE_ROOT ?? path.join(HOME, ".opengrid-workspaces"),
);

try {
  fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
} catch (err) {
  logger.warn({ err: (err as Error).message, dir: WORKSPACES_ROOT }, "Could not create WORKSPACES_ROOT");
}

const SESSION_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function sessionWorkspacePath(sessionId: string): string {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new Error("Invalid session id");
  }
  return path.join(WORKSPACES_ROOT, sessionId);
}

export function ensureSessionWorkspace(sessionId: string): string {
  const dir = sessionWorkspacePath(sessionId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function isInsideSessionWorkspace(sessionId: string, absPath: string): boolean {
  let root: string;
  try {
    root = sessionWorkspacePath(sessionId);
  } catch {
    return false;
  }
  const resolved = path.resolve(absPath);
  return resolved === root || resolved.startsWith(root + path.sep);
}

export async function removeSessionWorkspace(sessionId: string): Promise<void> {
  let dir: string;
  try {
    dir = sessionWorkspacePath(sessionId);
  } catch {
    return;
  }
  try {
    await fsp.rm(dir, { recursive: true, force: true });
    logger.info({ sessionId }, "Removed session workspace");
  } catch (err) {
    logger.warn({ err: (err as Error).message, sessionId }, "Failed to remove session workspace");
  }
}
