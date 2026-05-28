import { Plus, Command as CommandIcon, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onAddPanel: () => void;
  onOpenPalette: () => void;
}

export function EmptyState({ onAddPanel, onOpenPalette }: EmptyStateProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col items-center gap-5 p-8 rounded-xl max-w-md text-center"
        style={{ background: "rgba(13,13,13,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="empty-state"
      >
        <div
          className="flex items-center justify-center w-14 h-14 rounded-full"
          style={{ background: "rgba(255,69,0,0.15)", border: "1px solid rgba(255,69,0,0.4)" }}
        >
          <TerminalIcon size={24} style={{ color: "#FF4500" }} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-mono font-bold text-white/90">No agents yet</h2>
          <p className="text-sm font-mono text-white/50">
            Each pane runs a real CLI agent (claude, codex, gemini…) over a PTY.
            Launch one to get started.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button
            onClick={onAddPanel}
            className="flex-1 gap-2 font-mono"
            data-testid="empty-state-add"
          >
            <Plus size={14} />
            Add Agent
          </Button>
          <Button
            variant="outline"
            onClick={onOpenPalette}
            className="flex-1 gap-2 font-mono"
            data-testid="empty-state-palette"
          >
            <CommandIcon size={14} />
            <span>Command</span>
            <kbd className="text-[9px] px-1 py-0.5 bg-muted rounded ml-auto">⌘K</kbd>
          </Button>
        </div>

        <div className="text-[10px] font-mono text-white/30 leading-relaxed">
          Tip: Hold <kbd className="px-1 bg-white/5 rounded">Space</kbd> + drag to pan ·{" "}
          <kbd className="px-1 bg-white/5 rounded">Ctrl</kbd>+scroll to zoom
        </div>
      </div>
    </div>
  );
}
