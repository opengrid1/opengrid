import { useState, useEffect } from "react";
import { useBroadcast } from "../lib/broadcast";

const KEYS: { label: string; data: string; wide?: boolean }[] = [
  { label: "Esc", data: "\x1b" },
  { label: "Tab", data: "\t" },
  { label: "↑", data: "\x1b[A" },
  { label: "↓", data: "\x1b[B" },
  { label: "←", data: "\x1b[D" },
  { label: "→", data: "\x1b[C" },
  { label: "^C", data: "\x03" },
  { label: "^D", data: "\x04" },
  { label: "^Z", data: "\x1a" },
  { label: "↵", data: "\r" },
];

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window && window.innerWidth < 900;
}

export function MobileKeyBar() {
  const [isMobile, setIsMobile] = useState(detectMobile);
  const { sendToFocused, focusedPanelId, broadcast, selected } = useBroadcast();

  useEffect(() => {
    const onResize = () => setIsMobile(detectMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isMobile) return null;
  // Hide while broadcast bar is active (it has its own input UI)
  if (selected.size >= 2) return null;
  // Show if we have either a focused panel OR a single-panel broadcast selection
  if (!focusedPanelId && selected.size === 0) return null;

  const send = (data: string) => {
    if (selected.size > 0) broadcast(data);
    else sendToFocused(data);
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center gap-1 px-2 py-1.5 overflow-x-auto"
      style={{
        bottom: "env(safe-area-inset-bottom, 0)",
        background: "#0a0a0a",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
      data-testid="mobile-key-bar"
    >
      {KEYS.map(({ label, data }) => (
        <button
          key={label}
          onClick={() => send(data)}
          className="shrink-0 px-3 h-9 rounded font-mono text-xs font-semibold text-white/80 active:bg-white/20"
          style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", minWidth: 40 }}
          data-testid={`mobile-key-${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
