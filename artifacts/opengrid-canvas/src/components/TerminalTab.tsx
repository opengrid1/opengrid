import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { Play, RefreshCcw, Wifi, WifiOff, AlertTriangle, Copy, Keyboard, ClipboardPaste, Save } from 'lucide-react';
import { useBroadcast } from '../lib/broadcast';
import { apiJson } from '../lib/api';
import { useCliStatus } from '../lib/useCliStatus';
import { AgentType, AGENT_PRESETS } from '../lib/store';

// Approximate context-window size (in tokens) per agent. Used only for the
// "context used" indicator — it's a hint, not enforcement. Values reflect
// each CLI's default model as of mid-2026; users on smaller models will see
// the bar fill faster, which is arguably the right behaviour anyway.
const AGENT_CONTEXT_TOKENS: Partial<Record<AgentType, number>> = {
  claude: 200_000,
  codex: 256_000,
  gemini: 1_000_000,
  cursor: 200_000,
  grok: 256_000,
  venice: 64_000,
};

interface TerminalTabProps {
  panelId: string;
  agent: string;
  sessionId: string;
  cwd?: string;
  onAttentionChange?: (waiting: boolean) => void;
}

const DRACULA_THEME = {
  background: '#000000',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#000000',
  selectionBackground: '#44475a',
  black: '#000000',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#bfbfbf',
  brightBlack: '#4d4d4d',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#f8f8f2',
};

type WireOut =
  | { type: 'data'; data: string }
  | { type: 'replay'; data: string }
  | { type: 'ready'; sessionId: string; agent: string; resumed: boolean }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string }
  | { type: 'usage'; bytesIn: number; bytesOut: number; startedAt: number }
  | { type: 'snapshot'; path: string }
  | { type: 'shutdown'; inSec: number; message: string };

const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]/g;

const PROMPT_PATTERNS: RegExp[] = [
  /\([yY]\/[nN]\)\s*[?:]?\s*$/,
  /\[[yY]\/[nN]\]\s*[?:]?\s*$/,
  /Press\s+(any\s+key|enter|return)\b/i,
  /\b(continue|proceed|approve|allow|confirm)\?\s*$/i,
  /^\s*\?\s+\S.+[?:]\s*$/,
  /^\s*\?\s+.+\s\(.+\)\s*$/,
];

function detectsPrompt(text: string): boolean {
  const clean = text.replace(ANSI_RE, '').trimEnd();
  if (!clean) return false;
  const tail = clean.slice(-400);
  const lines = tail.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const lastLine = lines[lines.length - 1] ?? '';
  return PROMPT_PATTERNS.some((re) => re.test(lastLine));
}

export function TerminalTab({ panelId, agent, sessionId, cwd, onAttentionChange }: TerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [resumed, setResumed] = useState(false);
  const [usage, setUsage] = useState<{ bytesIn: number; bytesOut: number } | null>(null);

  const broadcast = useBroadcast();
  const { status: cliStatus, loading: cliLoading } = useCliStatus();

  const bufferRef = useRef<string>('');
  const attentionTimerRef = useRef<number | null>(null);
  const lastAttentionRef = useRef<boolean>(false);
  const connectTimeoutRef = useRef<number | null>(null);

  const setAttention = (next: boolean) => {
    if (lastAttentionRef.current === next) return;
    lastAttentionRef.current = next;
    onAttentionChange?.(next);
  };

  const scheduleAttentionCheck = () => {
    if (attentionTimerRef.current) window.clearTimeout(attentionTimerRef.current);
    attentionTimerRef.current = window.setTimeout(() => {
      const waiting = detectsPrompt(bufferRef.current);
      setAttention(waiting);
    }, 450);
  };

  const sendCtrl = (msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const sendInput = (data: string) => sendCtrl({ type: 'input', data });

  const connect = async (force = false) => {
    // Pre-flight: if CLI is known-missing, don't even open the WS — show
    // install instructions instead. `force=true` (used by "try anyway")
    // bypasses this so the server gets a chance to attempt the spawn anyway.
    if (!force && !cliLoading && cliStatus[agent as AgentType] === false) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    setResumed(false);
    setAttention(false);
    if (wsRef.current) wsRef.current.close();

    // Trade the cookie session for a single-use, 30s WebSocket ticket so the
    // session id never appears in WS URLs (and thus proxy/access logs).
    let ticket: string;
    try {
      const res = await apiJson<{ ticket: string }>('/api/auth/ws-ticket', { method: 'POST', json: {} });
      ticket = res.ticket;
    } catch {
      setStatus('disconnected');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}&ticket=${encodeURIComponent(ticket)}`);
    wsRef.current = ws;

    if (connectTimeoutRef.current) window.clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        try { ws.close(); } catch { /* ignore */ }
        setStatus('disconnected');
      }
    }, 8000);

    ws.onopen = () => {
      if (connectTimeoutRef.current) {
        window.clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      const cols = xtermRef.current?.cols ?? 80;
      const rows = xtermRef.current?.rows ?? 24;
      // Always send 'start' — server ignores it if the session already exists,
      // and uses it to spawn a fresh PTY otherwise.
      ws.send(JSON.stringify({ type: 'start', agent, cwd, cols, rows }));
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      let parsed: WireOut;
      try {
        parsed = JSON.parse(e.data) as WireOut;
      } catch {
        return;
      }
      const term = xtermRef.current;
      if (!term) return;
      switch (parsed.type) {
        case 'ready':
          setStatus('connected');
          if (parsed.resumed) setResumed(true);
          return;
        case 'replay':
          // Server resumed an existing PTY — wipe local terminal and replay
          // the recent output buffer so the screen matches reality.
          term.reset();
          term.write(parsed.data);
          bufferRef.current = parsed.data.slice(-800);
          scheduleAttentionCheck();
          return;
        case 'data':
          term.write(parsed.data);
          bufferRef.current = (bufferRef.current + parsed.data).slice(-800);
          scheduleAttentionCheck();
          return;
        case 'exit':
          term.writeln(`\r\n\x1b[33m[process exited: ${parsed.code}]\x1b[0m`);
          setStatus('disconnected');
          setAttention(false);
          return;
        case 'error':
          term.writeln(`\r\n\x1b[31m${parsed.message}\x1b[0m`);
          setStatus('disconnected');
          setAttention(false);
          return;
        case 'usage':
          // ~4 bytes/token is the standard rule-of-thumb; server already
          // strips ANSI before counting so this stays in the right
          // ballpark for both Claude/Codex (English code) and Gemini
          // (heavier formatting). Imperfect, useful.
          setUsage({ bytesIn: parsed.bytesIn, bytesOut: parsed.bytesOut });
          return;
        case 'snapshot':
          term.writeln(`\r\n\x1b[36m[snapshot saved: ${parsed.path}]\x1b[0m`);
          return;
        case 'shutdown':
          // Re-broadcast as a window event so a single top-level banner can
          // show this once (instead of every pane rendering its own).
          window.dispatchEvent(
            new CustomEvent('opengrid:shutdown', {
              detail: { inSec: parsed.inSec, message: parsed.message },
            }),
          );
          term.writeln(
            `\r\n\x1b[33m[server restarting in ${parsed.inSec}s — tap snapshot to save your work]\x1b[0m`,
          );
          return;
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setAttention(false);
    };
    ws.onerror = () => {
      setStatus('disconnected');
      setAttention(false);
    };
  };

  // Listen for "reconnect all" command from the Toolbar — reconnects panels
  // that are currently disconnected. Idle panels are left alone (respecting
  // lazy-start; user can still tap them individually).
  useEffect(() => {
    const onReconnectAll = () => {
      if (status === 'disconnected') void connect();
    };
    window.addEventListener('opengrid:reconnect-all', onReconnectAll);
    return () => window.removeEventListener('opengrid:reconnect-all', onReconnectAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, agent, sessionId, cwd, cliStatus, cliLoading]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: DRACULA_THEME,
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.5,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    // Custom URL handler — the default tries to use the click event's window,
    // which is unreliable inside a transformed canvas on iOS Safari. Opening
    // explicitly with noopener works everywhere.
    term.loadAddon(
      new WebLinksAddon((event, uri) => {
        event.preventDefault();
        window.open(uri, '_blank', 'noopener,noreferrer');
      }),
    );
    term.open(terminalRef.current);

    requestAnimationFrame(() => fitAddon.fit());

    term.onData((data) => {
      sendCtrl({ type: 'input', data });
      setAttention(false);
    });
    term.onResize(({ cols, rows }) => sendCtrl({ type: 'resize', cols, rows }));
    const textarea = terminalRef.current.querySelector('textarea');
    const onFocus = () => broadcast.setFocused(panelId);
    textarea?.addEventListener('focus', onFocus);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const unregister = broadcast.register(panelId, sendInput);

    // Lazy start: do NOT auto-connect. User taps "start" / "resume" to attach.

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    ro.observe(terminalRef.current);

    return () => {
      ro.disconnect();
      if (connectTimeoutRef.current) window.clearTimeout(connectTimeoutRef.current);
      if (attentionTimerRef.current) window.clearTimeout(attentionTimerRef.current);
      setAttention(false);
      unregister();
      textarea?.removeEventListener('focus', onFocus);
      broadcast.clearFocusIf(panelId);
      wsRef.current?.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId]);

  const installCommand = AGENT_PRESETS[agent as AgentType]?.install;
  const cliMissing = !cliLoading && cliStatus[agent as AgentType] === false;

  // Compute context-usage percent. Returns null when the agent has no
  // window assigned (shell / files) or no usage data yet.
  const contextWindow = AGENT_CONTEXT_TOKENS[agent as AgentType];
  const usagePct: number | null =
    usage && contextWindow
      ? Math.min(100, Math.round(((usage.bytesIn + usage.bytesOut) / 4 / contextWindow) * 100))
      : null;
  const usageColor =
    usagePct === null
      ? ''
      : usagePct >= 80
        ? 'bg-red-500/80'
        : usagePct >= 50
          ? 'bg-yellow-500/80'
          : 'bg-emerald-500/70';
  const usageTextColor =
    usagePct === null
      ? 'text-white/40'
      : usagePct >= 80
        ? 'text-red-300'
        : usagePct >= 50
          ? 'text-yellow-300'
          : 'text-emerald-300/80';

  const requestSnapshot = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'snapshot' }));
    }
  };

  // iOS keyboard only opens when focus() is called *synchronously* inside a
  // user gesture. The hidden xterm textarea sometimes loses focus during
  // transform/scale operations on the canvas, so we re-focus on every tap.
  const focusKeyboard = () => {
    const ta = terminalRef.current?.querySelector('textarea');
    if (ta) (ta as HTMLTextAreaElement).focus();
    xtermRef.current?.focus();
  };

  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      xtermRef.current?.writeln(
        `\r\n\x1b[33m[clipboard API not available — use the on-screen keyboard to type instead]\x1b[0m`,
      );
      return;
    }
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      xtermRef.current?.writeln(
        `\r\n\x1b[33m[paste blocked by browser — tap Allow when iOS asks, or allow clipboard in Safari settings]\x1b[0m`,
      );
      return;
    }
    if (!text) return;
    // Normalize line endings so newlines don't double-fire.
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Wrap in bracketed-paste markers so the agent / shell treats the whole
    // chunk as one paste event instead of executing each line on its newline.
    // Modern shells and CLI agents (claude, codex, gemini) honor this when
    // bracketed-paste mode is enabled (default in most). Agents that haven't
    // enabled it see the markers as harmless bytes they strip or ignore.
    const BPM_START = '\x1b[200~';
    const BPM_END = '\x1b[201~';
    sendCtrl({ type: 'input', data: BPM_START + normalized + BPM_END });
    setAttention(false);
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#000' }}
      onPointerDown={() => {
        broadcast.setFocused(panelId);
        focusKeyboard();
      }}
    >
      <div className="flex-1 relative overflow-hidden">
        <div ref={terminalRef} className="absolute inset-0" />

        {status === 'idle' && cliMissing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm p-4 text-center">
            <AlertTriangle size={24} className="text-yellow-400" />
            <div className="text-xs font-mono text-yellow-300">{agent} CLI is not installed</div>
            {installCommand && (
              <div className="w-full max-w-xs flex items-center gap-1.5 bg-black border border-white/10 rounded px-2 py-1.5">
                <code className="flex-1 text-[10px] font-mono text-white/70 truncate text-left" data-testid="text-install-command">
                  {installCommand}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(installCommand).catch(() => {})}
                  className="text-white/40 hover:text-white"
                  title="Copy install command"
                  data-testid="button-copy-install"
                >
                  <Copy size={11} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => void connect(true)}
              className="text-[10px] font-mono text-white/40 underline hover:text-white/70"
              data-testid="button-terminal-try-anyway"
            >
              try anyway
            </button>
          </div>
        )}

        {status === 'idle' && !cliMissing && (
          <button
            type="button"
            onClick={() => void connect()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm hover:bg-black/40 transition-colors"
            data-testid="button-terminal-start"
          >
            <Play size={28} className="text-white/70" />
            <span className="text-xs font-mono text-white/70">tap to start {agent}</span>
          </button>
        )}
      </div>

      <div
        className="flex-none flex items-center justify-between px-3 h-7"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: '#0a0a0a',
        }}
      >
        <div className="flex items-center gap-1.5">
          {status === 'idle' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <span className="text-[10px] font-mono text-white/40">idle</span>
            </>
          )}
          {status === 'connected' && (
            <>
              <Wifi size={10} className="text-green-500" />
              <span className="text-[10px] font-mono" style={{ color: resumed ? '#bd93f9' : '#50fa7b' }}>
                {resumed ? 'resumed' : 'connected'}
              </span>
            </>
          )}
          {status === 'connecting' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-[10px] font-mono text-yellow-400">connecting…</span>
            </>
          )}
          {status === 'disconnected' && (
            <>
              <WifiOff size={10} className="text-red-400" />
              <span className="text-[10px] font-mono text-red-400">disconnected</span>
            </>
          )}
        </div>

        {usagePct !== null && status === 'connected' && (
          <div
            className="flex items-center gap-1.5 ml-2"
            title={
              `~${Math.round(((usage?.bytesIn ?? 0) + (usage?.bytesOut ?? 0)) / 4).toLocaleString()} / ` +
              `${contextWindow?.toLocaleString()} tokens used. ` +
              `${usagePct >= 80 ? 'Older messages may be dropped soon — snapshot to save.' : 'Plenty of room.'}`
            }
            data-testid="indicator-context-usage"
          >
            <div className="w-12 h-1 bg-white/10 rounded-sm overflow-hidden">
              <div
                className={`h-full ${usageColor} transition-[width] duration-500`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono ${usageTextColor}`}>{usagePct}%</span>
          </div>
        )}

        {cwd && (
          <span className="text-[10px] font-mono text-white/30 truncate ml-2 max-w-[40%]" title={cwd}>
            {cwd.length > 28 ? '…' + cwd.slice(-27) : cwd}
          </span>
        )}

        <div className="flex items-center gap-2">
          {status !== 'idle' && (
            <button
              onPointerDown={(e) => {
                // Must focus inside the gesture, before any state change, so
                // iOS Safari is willing to open the on-screen keyboard.
                e.preventDefault();
                focusKeyboard();
              }}
              className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-black bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 px-2 py-0.5 rounded transition-colors"
              data-testid="button-terminal-keyboard"
              title="Tap to open keyboard and type"
            >
              <Keyboard size={12} />
              type
            </button>
          )}
          {status !== 'idle' && (
            <button
              onClick={pasteFromClipboard}
              className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-black bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 px-2 py-0.5 rounded transition-colors"
              data-testid="button-terminal-paste"
              title="Paste clipboard contents into terminal"
            >
              <ClipboardPaste size={12} />
              paste
            </button>
          )}
          {status === 'connected' && (
            <button
              onClick={requestSnapshot}
              className="flex items-center gap-1 text-[10px] font-mono text-white/40 hover:text-white/80 transition-colors"
              data-testid="button-terminal-snapshot"
              title="Save conversation transcript to your workspace (before the agent compacts it)"
            >
              <Save size={10} />
              snapshot
            </button>
          )}
          {status !== 'idle' && (
            <button
              onClick={() => {
                xtermRef.current?.clear();
                void connect(true);
              }}
              className="flex items-center gap-1 text-[10px] font-mono text-white/30 hover:text-white/70 transition-colors"
              data-testid="button-terminal-restart"
              title="Reconnect this CLI session"
            >
              <RefreshCcw size={10} />
              {status === 'disconnected' ? 'reconnect' : 'restart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
