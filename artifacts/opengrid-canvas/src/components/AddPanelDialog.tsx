import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SiAnthropic, SiOpenai, SiGooglegemini } from "react-icons/si";
import { Terminal as TerminalIcon, MousePointer2, AlertCircle, FolderOpen, FolderTree, X } from "lucide-react";
import { XaiIcon, VeniceIcon } from "./brand-icons";
import { AgentType, AGENT_PRESETS } from "../lib/store";
import { useCliStatus } from "../lib/useCliStatus";
import { Input } from "@/components/ui/input";

const LAST_CWD_KEY = "opengrid-last-cwd";

function isValidAbsolutePath(s: string): boolean {
  return /^\/[^\0]*$/.test(s);
}

interface AddPanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (agent: AgentType, cwd?: string) => void;
}

const AGENT_VISUALS: Record<AgentType, { color: string; Icon: React.ComponentType<{ className?: string; size?: number }> }> = {
  claude: { color: '#FF6B35', Icon: SiAnthropic },
  codex: { color: '#74AA9C', Icon: SiOpenai },
  gemini: { color: '#4F9EF8', Icon: SiGooglegemini },
  cursor: { color: '#FFFFFF', Icon: MousePointer2 },
  grok: { color: '#FFFFFF', Icon: XaiIcon },
  venice: { color: '#E64545', Icon: VeniceIcon },
  shell: { color: '#888888', Icon: TerminalIcon },
  files: { color: '#A78BFA', Icon: FolderTree },
};

const ORDER: AgentType[] = ['claude', 'codex', 'gemini', 'cursor', 'grok', 'venice', 'shell', 'files'];

export function AddPanelDialog({ open, onOpenChange, onAdd }: AddPanelDialogProps) {
  const { status, loading } = useCliStatus();
  const [cwd, setCwd] = useState<string>("");

  useEffect(() => {
    if (open) {
      // Restore last used cwd, but ONLY if it's a valid absolute path.
      // Defensive: discard any garbage previously saved.
      try {
        const last = localStorage.getItem(LAST_CWD_KEY);
        if (last && isValidAbsolutePath(last)) {
          setCwd(last);
        } else if (last) {
          localStorage.removeItem(LAST_CWD_KEY);
          setCwd("");
        }
      } catch {
        // ignore
      }
    }
  }, [open]);

  const trimmedCwd = cwd.trim();
  const cwdError = useMemo(() => {
    if (!trimmedCwd) return null;
    if (!isValidAbsolutePath(trimmedCwd)) {
      return 'Must start with "/" (e.g. /home/runner/workspace)';
    }
    return null;
  }, [trimmedCwd]);

  const pick = (agent: AgentType) => {
    const alwaysAvailable = agent === 'shell' || agent === 'files';
    if (!alwaysAvailable && (loading || !status[agent])) return;
    if (cwdError) return; // block when path is invalid
    if (trimmedCwd) {
      try { localStorage.setItem(LAST_CWD_KEY, trimmedCwd); } catch { /* ignore */ }
    }
    onAdd(agent, trimmedCwd || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] border-border bg-card max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-mono">Launch Agent</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-white/40 font-mono -mt-2">
          Each pane runs a real PTY. CLI tools must be installed on the server.
        </p>

        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
            <FolderOpen size={11} />
            Working Directory <span className="text-white/20 normal-case tracking-normal">(optional, absolute path)</span>
          </label>
          <div className="relative">
            <Input
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="/home/runner/workspace/my-project"
              className={`bg-background font-mono text-sm pr-8 ${
                cwdError ? "border-red-500/60 focus-visible:ring-red-500/30" : "border-white/10"
              }`}
              data-testid="input-cwd"
            />
            {cwd && (
              <button
                type="button"
                onClick={() => {
                  setCwd("");
                  try { localStorage.removeItem(LAST_CWD_KEY); } catch { /* ignore */ }
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-white/90 hover:bg-white/5"
                aria-label="Clear working directory"
                data-testid="button-clear-cwd"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {cwdError ? (
            <p className="text-[10px] font-mono text-red-400/90 flex items-center gap-1">
              <AlertCircle size={10} />
              {cwdError}
            </p>
          ) : (
            <p className="text-[10px] font-mono text-white/30">
              Leave blank to use the server's default ($HOME).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 py-1">
          {ORDER.map((id) => {
            const preset = AGENT_PRESETS[id];
            const v = AGENT_VISUALS[id];
            const available = status[id];
            const alwaysAvailable = id === 'shell' || id === 'files';
            // Shell + Files are always available; others disabled while loading or if not installed.
            // Any invalid cwd disables all options.
            const disabled = (cwdError !== null) || (alwaysAvailable ? false : (loading || !available));
            return (
              <button
                key={id}
                onClick={() => pick(id)}
                disabled={disabled}
                className={`flex items-start gap-3 p-3 rounded-md border text-left transition-all ${
                  disabled
                    ? 'border-white/5 bg-background/40 opacity-50 cursor-not-allowed'
                    : 'border-white/10 bg-background hover:bg-muted hover:border-white/20'
                }`}
                data-testid={`button-add-agent-${id}`}
              >
                <span style={{ color: v.color, lineHeight: 0 }} className="shrink-0 mt-0.5">
                  <v.Icon size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-white/90">
                      {preset.name}
                    </span>
                    {loading && !alwaysAvailable && (
                      <span className="text-[10px] font-mono text-white/30 animate-pulse">
                        checking…
                      </span>
                    )}
                    {!loading && !available && !alwaysAvailable && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-amber-500/80">
                        <AlertCircle size={10} />
                        not installed
                      </span>
                    )}
                    {!loading && available && !alwaysAvailable && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-white/40 mt-0.5">
                    {preset.description}
                  </div>
                  {!loading && !available && preset.install && (
                    <code className="text-[10px] font-mono text-amber-400/70 mt-1 block break-all">
                      {preset.install}
                    </code>
                  )}
                </div>
                <code className="text-[10px] font-mono text-white/30 shrink-0 mt-1">
                  {preset.command || '$SHELL'}
                </code>
              </button>
            );
          })}
        </div>

        {!loading && (
          <p className="text-[10px] font-mono text-white/30 leading-relaxed">
            Status checked via <code className="text-white/40">which</code> on the server. Refresh page after installing.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
