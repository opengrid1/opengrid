import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";
import { refreshSession, useSession } from "../lib/auth";
import { Key, Loader2, Check, X } from "lucide-react";

// Subset of provider keys we surface in the UI. The server allows more, but
// most users only need these. Order matters — top is most common.
const KEY_FIELDS: { name: string; label: string; placeholder: string; agent: string }[] = [
  { name: "ANTHROPIC_API_KEY",            label: "Anthropic (claude)",      placeholder: "sk-ant-…",  agent: "claude" },
  { name: "OPENAI_API_KEY",               label: "OpenAI (codex)",          placeholder: "sk-…",       agent: "codex" },
  { name: "GEMINI_API_KEY",               label: "Google (gemini)",         placeholder: "AIza…",      agent: "gemini" },
  { name: "XAI_API_KEY",                  label: "xAI (grok)",              placeholder: "xai-…",      agent: "grok" },
  { name: "CURSOR_API_KEY",               label: "Cursor",                  placeholder: "key_…",      agent: "cursor" },
  { name: "VENICE_API_KEY",               label: "Venice (aider)",          placeholder: "vc-…",       agent: "venice" },
];

interface KeysPanelProps {
  onClose: () => void;
}

export function KeysPanel({ onClose }: KeysPanelProps) {
  const session = useSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setKeys = new Set(session?.apiKeysSet ?? []);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Send all non-empty fields as setters; explicit empty fields as null
      // (deletes the key on the server).
      const payload: Record<string, string | null> = {};
      for (const f of KEY_FIELDS) {
        const v = values[f.name];
        if (v === undefined) continue;
        payload[f.name] = v === "" ? null : v;
      }
      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }
      await apiJson("/api/auth/keys", { method: "PUT", json: { keys: payload } });
      await refreshSession();
      setValues({});
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="keys-panel-backdrop"
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 p-5 flex flex-col gap-4 font-mono"
        onClick={(e) => e.stopPropagation()}
        data-testid="keys-panel"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Key size={15} className="text-orange-500" />
            <h2 className="text-sm font-semibold">API keys</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white"
            data-testid="keys-panel-close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[11px] text-white/40 leading-relaxed">
          Paste your provider keys. They live in memory for this session only — never written to disk, never logged. They're forwarded into the agent CLI via env vars when you start a pane.
        </p>

        <div className="flex flex-col gap-3">
          {KEY_FIELDS.map((f) => {
            const isSet = setKeys.has(f.name);
            return (
              <div key={f.name} className="flex flex-col gap-1.5">
                <label className="flex items-center justify-between text-[11px] text-white/60">
                  <span>{f.label}</span>
                  {isSet && (
                    <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                      <Check size={11} /> set
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={isSet ? "(already set — type to replace, empty to delete)" : f.placeholder}
                  className="px-3 h-9 rounded bg-black border border-white/10 text-white text-[12px] focus:outline-none focus:border-orange-500/60"
                  data-testid={`input-key-${f.agent}`}
                />
              </div>
            );
          })}
        </div>

        {error && (
          <div className="text-[11px] text-red-400" data-testid="keys-panel-error">
            {error}
          </div>
        )}
        {saved && (
          <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
            <Check size={12} /> saved
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || Object.keys(values).length === 0}
            className="flex-1 h-10 rounded bg-orange-500 hover:bg-orange-400 text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            data-testid="button-keys-save"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded border border-white/10 text-white/60 hover:text-white text-sm"
            data-testid="button-keys-close"
          >
            Close
          </button>
        </div>

        <p className="text-[10px] text-white/30 leading-relaxed pt-1 border-t border-white/[0.06]">
          Tip: you only need the keys for the agents you'll actually use. Anything unset just means that pane will fail to start until you paste a key here.
        </p>
      </div>
    </div>
  );
}
