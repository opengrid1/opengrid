import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Row = { keys: string[]; label: string };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Canvas",
    rows: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["⌘", "N"], label: "Add a new agent pane" },
      { keys: ["?"], label: "Show this shortcuts overlay" },
      { keys: ["Esc"], label: "Close any open dialog" },
      { keys: ["Space", "drag"], label: "Pan the canvas (mouse)" },
      { keys: ["⌃", "scroll"], label: "Zoom in / out (trackpad / mouse)" },
      { keys: ["pinch"], label: "Zoom on touch devices" },
    ],
  },
  {
    title: "Terminal pane",
    rows: [
      { keys: ["tap input"], label: "Focus the pane and start typing" },
      { keys: ["paste"], label: "Bracketed paste — multi-line prompts don't auto-fire" },
      { keys: ["long-press"], label: "Mobile selection / context menu" },
    ],
  },
  {
    title: "Broadcast bar",
    rows: [
      { keys: ["Enter"], label: "Send to every selected pane" },
      { keys: ["⇧", "Enter"], label: "Newline inside the broadcast input" },
    ],
  },
];

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-white/15 bg-white/[0.04] text-[10px] font-mono text-white/80">
      {children}
    </kbd>
  );
}

export function ShortcutsOverlay({ open, onOpenChange }: ShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg font-mono"
        data-testid="shortcuts-overlay"
      >
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="font-mono text-xs text-white/50">
            Everything you can do without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                {section.title}
              </div>
              <ul className="space-y-1.5">
                {section.rows.map((row, i) => (
                  <li
                    key={`${section.title}-${i}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-white/70">{row.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {row.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && (
                            <span className="text-white/30 text-[10px]">+</span>
                          )}
                          <Key>{k}</Key>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-white/30 pt-2 border-t border-white/5">
          Tip: most actions are also reachable through the command palette
          (<Key>⌘</Key> <Key>K</Key>).
        </div>
      </DialogContent>
    </Dialog>
  );
}
