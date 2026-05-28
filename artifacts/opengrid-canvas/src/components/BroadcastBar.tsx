import { useState, useRef, useEffect } from "react";
import { useBroadcast } from "../lib/broadcast";
import { Send, X, Radio } from "lucide-react";

export function BroadcastBar() {
  const { selected, broadcast, clearSelected } = useBroadcast();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const count = selected.size;

  useEffect(() => {
    if (count >= 2) inputRef.current?.focus();
  }, [count]);

  if (count < 2) return null;

  const send = (appendNewline: boolean) => {
    if (!text.trim()) return;
    const payload = appendNewline ? text + "\r" : text;
    broadcast(payload);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearSelected();
    }
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 flex items-end gap-2 p-2 bg-card border-2 rounded-lg shadow-2xl"
      style={{
        borderColor: "#FF4500",
        boxShadow: "0 0 24px rgba(255,69,0,0.25), 0 12px 32px rgba(0,0,0,0.6)",
        width: "min(720px, calc(100vw - 32px))",
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
      data-testid="broadcast-bar"
    >
      <div className="flex flex-col items-center gap-0.5 pt-2 px-2">
        <Radio size={16} style={{ color: "#FF4500" }} className="animate-pulse" />
        <span className="text-[10px] font-mono font-bold" style={{ color: "#FF4500" }}>
          {count}
        </span>
      </div>

      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Broadcast to ${count} agents… (Enter to send, Shift+Enter newline, Esc to cancel)`}
        rows={2}
        className="flex-1 bg-background border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-white/90 resize-none focus:outline-none focus:border-white/30"
        data-testid="broadcast-input"
      />

      <div className="flex flex-col gap-1">
        <button
          onClick={() => send(true)}
          disabled={!text.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono font-semibold text-white disabled:opacity-40 hover:opacity-80 transition-opacity"
          style={{ background: "#FF4500" }}
          data-testid="broadcast-send"
        >
          <Send size={12} />
          Send
        </button>
        <button
          onClick={clearSelected}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-mono text-white/50 hover:text-white/90 border border-white/10 hover:border-white/30 transition-colors"
          data-testid="broadcast-cancel"
        >
          <X size={12} />
          Stop
        </button>
      </div>
    </div>
  );
}
