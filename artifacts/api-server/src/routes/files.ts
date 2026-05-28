import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import { getReqSession, requireSession } from "../lib/auth";
import { ensureSessionWorkspace, isInsideSessionWorkspace } from "../lib/workspaces";

const router: IRouter = Router();
router.use(requireSession);

const MAX_READ_BYTES = 1_000_000;
const MAX_WRITE_BYTES = 5_000_000;
const MAX_LIST_ENTRIES = 2000;
const MAX_SEARCH_RESULTS = 200;
const MAX_SEARCH_FILES = 20000;

function workspaceRoot(req: import("express").Request): string {
  const s = getReqSession(req);
  return ensureSessionWorkspace(s.id);
}

function isPathAllowed(req: import("express").Request, absPath: string): boolean {
  const s = getReqSession(req);
  return isInsideSessionWorkspace(s.id, absPath);
}

function normalize(req: import("express").Request, raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (!path.isAbsolute(raw)) return null;
  const resolved = path.resolve(raw);
  return isPathAllowed(req, resolved) ? resolved : null;
}

async function canonicalize(req: import("express").Request, absPath: string): Promise<string | null> {
  try {
    const real = await fs.realpath(absPath);
    return isPathAllowed(req, real) ? real : null;
  } catch {
    return null;
  }
}

async function resolveTargetForCreate(
  req: import("express").Request,
  rawPath: unknown,
): Promise<{ ok: true; path: string; parent: string } | { ok: false; status: number; error: string }> {
  const lex = normalize(req, rawPath);
  if (!lex) return { ok: false, status: 400, error: "Invalid path. Must be an absolute path inside your workspace." };
  const parentLex = path.dirname(lex);
  const parent = await canonicalize(req, parentLex);
  if (!parent) return { ok: false, status: 403, error: "Parent directory is not accessible." };
  return { ok: true, path: path.join(parent, path.basename(lex)), parent };
}

// ─────────────────────────── LIST ───────────────────────────
router.get("/files/list", async (req, res) => {
  const root = workspaceRoot(req);
  const rawPath = (req.query.path as string) || root;
  const lex = normalize(req, rawPath);
  if (!lex) {
    res.status(400).json({ error: "Invalid path. Must be an absolute path inside your workspace." });
    return;
  }
  const dir = await canonicalize(req, lex);
  if (!dir) {
    res.status(403).json({ error: "Path is not accessible." });
    return;
  }
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: "Not a directory" });
      return;
    }
    const showHidden = req.query.showHidden === "1" || req.query.showHidden === "true";
    const allDirents = await fs.readdir(dir, { withFileTypes: true });
    const dirents = showHidden ? allDirents : allDirents.filter((d) => !d.name.startsWith("."));
    const entries = await Promise.all(
      dirents.slice(0, MAX_LIST_ENTRIES).map(async (d) => {
        const full = path.join(dir, d.name);
        let size = 0;
        let mtime = 0;
        try {
          const s = await fs.stat(full);
          size = s.size;
          mtime = s.mtimeMs;
        } catch {
          /* unreadable */
        }
        return {
          name: d.name,
          path: full,
          type: d.isDirectory() ? "dir" : d.isSymbolicLink() ? "symlink" : "file",
          size,
          mtime,
        };
      }),
    );
    entries.sort((a, b) => {
      if (a.type === "dir" && b.type !== "dir") return -1;
      if (a.type !== "dir" && b.type === "dir") return 1;
      return a.name.localeCompare(b.name);
    });
    res.json({
      path: dir,
      parent: dir === root ? null : path.dirname(dir),
      entries,
      truncated: dirents.length > MAX_LIST_ENTRIES,
      root,
    });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// ─────────────────────────── READ ───────────────────────────
router.get("/files/read", async (req, res) => {
  const lex = normalize(req, req.query.path);
  if (!lex) {
    res.status(400).json({ error: "Invalid path." });
    return;
  }
  const filePath = await canonicalize(req, lex);
  if (!filePath) {
    res.status(403).json({ error: "Path is not accessible." });
    return;
  }
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      res.status(400).json({ error: "Not a file" });
      return;
    }
    if (stat.size > MAX_READ_BYTES) {
      res.status(413).json({
        error: `File too large (${stat.size} bytes, max ${MAX_READ_BYTES})`,
        size: stat.size,
      });
      return;
    }
    const buf = await fs.readFile(filePath);
    const sample = buf.subarray(0, Math.min(buf.length, 8192));
    const isBinary = sample.includes(0);
    if (isBinary) {
      res.json({ path: filePath, size: stat.size, binary: true, content: "", mtime: stat.mtimeMs });
      return;
    }
    res.json({ path: filePath, size: stat.size, binary: false, content: buf.toString("utf8"), mtime: stat.mtimeMs });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

// ─────────────────────────── WRITE ──────────────────────────
router.put("/files/write", async (req, res) => {
  const body = req.body as { path?: unknown; content?: unknown } | undefined;
  const content = typeof body?.content === "string" ? body.content : null;
  if (content === null) {
    res.status(400).json({ error: "Missing content (must be string)" });
    return;
  }
  if (Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) {
    res.status(413).json({ error: `Content exceeds ${MAX_WRITE_BYTES} bytes` });
    return;
  }
  const target = await resolveTargetForCreate(req, body?.path);
  if (!target.ok) {
    res.status(target.status).json({ error: target.error });
    return;
  }

  try {
    const existing = await fs.lstat(target.path);
    if (existing.isSymbolicLink()) {
      const realTarget = await canonicalize(req, target.path);
      if (!realTarget) {
        res.status(403).json({ error: "Target symlink escapes allowed paths." });
        return;
      }
    }
  } catch {
    /* new file — fine */
  }

  try {
    await fs.access(target.parent, fsConstants.W_OK);
    const O_NOFOLLOW = (fsConstants as unknown as { O_NOFOLLOW?: number }).O_NOFOLLOW;
    if (typeof O_NOFOLLOW !== "number") {
      res.status(500).json({ error: "O_NOFOLLOW unsupported on this platform — refusing unsafe write." });
      return;
    }
    const flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC | O_NOFOLLOW;
    const fh = await fs.open(target.path, flags, 0o644);
    try {
      await fh.writeFile(content, "utf8");
      const stat = await fh.stat();
      res.json({ path: target.path, size: stat.size, mtime: stat.mtimeMs });
    } finally {
      await fh.close();
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─────────────────────────── MKDIR ──────────────────────────
router.post("/files/mkdir", async (req, res) => {
  const body = req.body as { path?: unknown } | undefined;
  const target = await resolveTargetForCreate(req, body?.path);
  if (!target.ok) {
    res.status(target.status).json({ error: target.error });
    return;
  }
  try {
    await fs.access(target.parent, fsConstants.W_OK);
    await fs.mkdir(target.path, { recursive: false });
    res.json({ path: target.path });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─────────────────────────── DELETE ─────────────────────────
router.delete("/files/delete", async (req, res) => {
  const root = workspaceRoot(req);
  const body = req.body as { path?: unknown } | undefined;
  const lex = normalize(req, body?.path);
  if (!lex) {
    res.status(400).json({ error: "Invalid path." });
    return;
  }
  // Never allow deleting the workspace root itself.
  if (lex === root) {
    res.status(403).json({ error: "Refusing to delete the workspace root." });
    return;
  }
  const parent = await canonicalize(req, path.dirname(lex));
  if (!parent) {
    res.status(403).json({ error: "Parent directory is not accessible." });
    return;
  }
  const target = path.join(parent, path.basename(lex));
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) {
      await fs.unlink(target);
    } else if (stat.isDirectory()) {
      await fs.rm(target, { recursive: true, force: false });
    } else {
      await fs.unlink(target);
    }
    res.json({ path: target, deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─────────────────────────── RENAME ─────────────────────────
router.post("/files/rename", async (req, res) => {
  const body = req.body as { from?: unknown; to?: unknown } | undefined;
  const fromLex = normalize(req, body?.from);
  if (!fromLex) {
    res.status(400).json({ error: "Invalid 'from' path." });
    return;
  }
  const fromParent = await canonicalize(req, path.dirname(fromLex));
  if (!fromParent) {
    res.status(403).json({ error: "Source parent not accessible." });
    return;
  }
  const fromPath = path.join(fromParent, path.basename(fromLex));
  const toTarget = await resolveTargetForCreate(req, body?.to);
  if (!toTarget.ok) {
    res.status(toTarget.status).json({ error: toTarget.error });
    return;
  }
  try {
    await fs.rename(fromPath, toTarget.path);
    res.json({ from: fromPath, to: toTarget.path });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─────────────────────────── SEARCH ─────────────────────────
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", ".turbo", ".pnpm-store"]);

router.get("/files/search", async (req, res) => {
  const lex = normalize(req, req.query.path);
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  if (!lex) {
    res.status(400).json({ error: "Invalid path." });
    return;
  }
  if (q.length === 0) {
    res.json({ path: lex, query: q, results: [], visited: 0, truncated: false });
    return;
  }
  const root = await canonicalize(req, lex);
  if (!root) {
    res.status(403).json({ error: "Path is not accessible." });
    return;
  }

  const results: Array<{ name: string; path: string; type: "file" | "dir" }> = [];
  let visited = 0;
  let truncated = false;
  const queue: string[] = [root];

  while (queue.length > 0 && results.length < MAX_SEARCH_RESULTS && visited < MAX_SEARCH_FILES) {
    const dir = queue.shift()!;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dirents) {
      visited++;
      if (visited >= MAX_SEARCH_FILES) {
        truncated = true;
        break;
      }
      if (d.name.startsWith(".") && d.name !== ".env") {
        if (d.isDirectory()) continue;
      }
      const full = path.join(dir, d.name);
      if (d.name.toLowerCase().includes(q)) {
        results.push({
          name: d.name,
          path: full,
          type: d.isDirectory() ? "dir" : "file",
        });
        if (results.length >= MAX_SEARCH_RESULTS) {
          truncated = true;
          break;
        }
      }
      if (d.isDirectory() && !SKIP_DIRS.has(d.name)) {
        queue.push(full);
      }
    }
  }

  if (queue.length > 0) truncated = true;
  res.json({ path: root, query: q, results, visited, truncated });
});

export default router;
