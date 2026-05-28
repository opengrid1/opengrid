import { Router, type IRouter } from "express";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

const CLI_TO_CHECK = ["claude", "codex", "gemini", "cursor-agent", "grok", "aider"] as const;

async function hasCommand(name: string): Promise<boolean> {
  try {
    await execFileAsync("which", [name], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// In-memory cache — refreshed every 30s
let cache: { ts: number; data: Record<string, boolean> } | null = null;
const TTL_MS = 30_000;

router.get("/cli-status", async (_req, res) => {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    res.json(cache.data);
    return;
  }

  const entries = await Promise.all(
    CLI_TO_CHECK.map(async (name) => [name, await hasCommand(name)] as const),
  );
  const data: Record<string, boolean> = {
    claude: false,
    codex: false,
    gemini: false,
    cursor: false,
    grok: false,
    venice: false,
    shell: true,
  };
  for (const [name, ok] of entries) {
    if (name === "cursor-agent") data.cursor = ok;
    else if (name === "aider") data.venice = ok; // Venice piggybacks on Aider
    else data[name] = ok;
  }
  cache = { ts: Date.now(), data };
  res.json(data);
});

export default router;
