import { useCallback, useEffect, useState } from "react";

export type AgentType = "claude" | "codex" | "gemini" | "cursor" | "grok" | "venice" | "shell" | "files";

export interface AgentPreset {
  id: AgentType;
  name: string;
  command: string;
  args: string[];
  description: string;
  install?: string;
}

export const AGENT_PRESETS: Record<AgentType, AgentPreset> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    args: [],
    description: "Anthropic's official CLI agent",
    install: "npm i -g @anthropic-ai/claude-code",
  },
  codex: {
    id: "codex",
    name: "Codex CLI",
    command: "codex",
    args: [],
    description: "OpenAI's terminal coding agent",
    install: "npm i -g @openai/codex",
  },
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    args: [],
    description: "Google's open-source CLI agent",
    install: "npm i -g @google/gemini-cli",
  },
  cursor: {
    id: "cursor",
    name: "Cursor Agent",
    command: "cursor-agent",
    args: [],
    description: "Cursor's headless agent",
    install: "curl https://cursor.com/install -fsS | bash",
  },
  grok: {
    id: "grok",
    name: "Grok CLI",
    command: "grok",
    args: [],
    description: "xAI's Grok terminal agent (community CLI)",
    install: "npm i -g @vibe-kit/grok-cli",
  },
  venice: {
    id: "venice",
    name: "Venice",
    command: "aider",
    args: [
      "--openai-api-base",
      "https://api.venice.ai/api/v1",
      "--model",
      "openai/venice-uncensored",
      "--no-show-model-warnings",
    ],
    description: "Private/uncensored — Venice models via Aider (set VENICE_API_KEY=…, exported as OPENAI_API_KEY)",
    install: "pip install aider-chat",
  },
  shell: {
    id: "shell",
    name: "Shell",
    command: "",
    args: [],
    description: "Plain bash terminal",
  },
  files: {
    id: "files",
    name: "Files",
    command: "",
    args: [],
    description: "Browse and edit files",
  },
};

export interface Panel {
  id: string;
  agent: AgentType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  cwd?: string;
  sessionId?: string;
}

function newSessionId(): string {
  // 16 chars, URL-safe. Matches server-side regex /^[a-zA-Z0-9_-]{6,64}$/.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function backfillSessionId(panels: Panel[]): Panel[] {
  let changed = false;
  const next = panels.map((p) => {
    if (!p.sessionId) {
      changed = true;
      return { ...p, sessionId: newSessionId() };
    }
    return p;
  });
  return changed ? next : panels;
}

// One-time migration from pre-rename localStorage keys (agent-canvas-* → opengrid-*).
// Runs at module load. Safe to remove after a few releases.
function migrateLegacyKey(oldKey: string, newKey: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(newKey) != null) return;
    const old = localStorage.getItem(oldKey);
    if (old != null) {
      localStorage.setItem(newKey, old);
      localStorage.removeItem(oldKey);
    }
  } catch {
    // ignore (private mode, quota, etc.)
  }
}
migrateLegacyKey("agent-canvas-panels-v2", "opengrid-panels-v2");
migrateLegacyKey("agent-canvas-saved-layouts-v1", "opengrid-saved-layouts-v1");
migrateLegacyKey("agent-canvas-last-cwd", "opengrid-last-cwd");

export function useCanvasState() {
  const [panels, setPanels] = useState<Panel[]>(() => {
    try {
      const saved = localStorage.getItem("opengrid-panels-v2");
      const parsed = saved ? (JSON.parse(saved) as Panel[]) : [];
      return backfillSessionId(parsed);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("opengrid-panels-v2", JSON.stringify(panels));
  }, [panels]);

  const addPanel = useCallback((panel: Omit<Panel, "id" | "sessionId"> & { sessionId?: string }) => {
    const id = Math.random().toString(36).slice(2, 11);
    const sessionId = panel.sessionId ?? newSessionId();
    setPanels((prev) => [...prev, { ...panel, id, sessionId }]);
    return id;
  }, []);

  const updatePanel = useCallback((id: string, updater: (prev: Panel) => Panel) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  }, []);

  const removePanel = useCallback((id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPanels = useCallback(() => setPanels([]), []);

  // Replace the entire panel set in one go — used by saved-layout restore.
  // Each restored panel gets a fresh client id + sessionId so the new PTYs
  // are isolated from any pre-existing in-flight sessions.
  const replacePanels = useCallback(
    (specs: Array<Omit<Panel, "id" | "sessionId">>) => {
      setPanels(
        specs.map((spec) => ({
          ...spec,
          id: Math.random().toString(36).slice(2, 11),
          sessionId: newSessionId(),
        })),
      );
    },
    [],
  );

  const applyLayout = useCallback(
    (
      positions: Array<{ id: string; x: number; y: number; width: number; height: number; isMinimized: boolean }>,
    ) => {
      setPanels((prev) =>
        prev.map((p) => {
          const next = positions.find((q) => q.id === p.id);
          return next ? { ...p, ...next } : p;
        }),
      );
    },
    [],
  );

  return { panels, addPanel, updatePanel, removePanel, clearPanels, replacePanels, applyLayout };
}

// ─────────────────────────── Saved layouts ───────────────────────────
//
// A "layout" here is a template — the geometry + agent type of every pane at
// the moment of save. Restoring instantiates fresh sessionIds so it never
// clobbers a live PTY. Capped at 20 entries; saving with a duplicate name
// replaces the existing one (intuitive overwrite semantics).

export interface LayoutSnapshot {
  id: string;
  name: string;
  createdAt: number;
  panels: Array<
    Pick<Panel, "agent" | "title" | "x" | "y" | "width" | "height" | "isMinimized" | "cwd">
  >;
}

const LAYOUTS_KEY = "opengrid-saved-layouts-v1";
const LAYOUTS_MAX = 20;

export function useSavedLayouts() {
  const [layouts, setLayouts] = useState<LayoutSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem(LAYOUTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as LayoutSnapshot[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
    } catch {
      // Quota exceeded or storage disabled — silently drop. The in-memory copy
      // remains so the current session still works.
    }
  }, [layouts]);

  const saveLayout = useCallback((name: string, panels: Panel[]) => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed || panels.length === 0) return;
    const snapshot: LayoutSnapshot = {
      id: Math.random().toString(36).slice(2, 11),
      name: trimmed,
      createdAt: Date.now(),
      panels: panels.map(({ agent, title, x, y, width, height, isMinimized, cwd }) => ({
        agent,
        title,
        x,
        y,
        width,
        height,
        isMinimized,
        cwd,
      })),
    };
    setLayouts((prev) =>
      [snapshot, ...prev.filter((l) => l.name !== trimmed)].slice(0, LAYOUTS_MAX),
    );
  }, []);

  const deleteLayout = useCallback((id: string) => {
    setLayouts((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return { layouts, saveLayout, deleteLayout };
}
