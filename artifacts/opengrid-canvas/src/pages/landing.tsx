import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { SiGithub } from "react-icons/si";
import {
  Terminal,
  Globe,
  Radio,
  Shield,
  Cpu,
  RotateCcw,
  Server,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Eye,
  Command as CommandIcon,
  Key,
  FolderTree,
  Download,
  Copy,
  Check,
} from "lucide-react";

const ORANGE = "#FF4500";

// CLI agents Open Grid actually spawns over PTY (server-side registry in
// lib/terminal.ts). Keep this list in sync with AGENT_REGISTRY.
const AGENTS: { name: string; color: string; install: string }[] = [
  { name: "claude",  color: "#FF9F4A", install: "npm i -g @anthropic-ai/claude-code" },
  { name: "codex",   color: "#A5C9FF", install: "npm i -g @openai/codex" },
  { name: "gemini",  color: "#74E0BB", install: "npm i -g @google/gemini-cli" },
  { name: "cursor",  color: "#C9A6FF", install: "curl https://cursor.com/install -fsS | bash" },
  { name: "grok",    color: "#F472B6", install: "npm i -g @xai/grok-cli" },
  { name: "aider",   color: "#F1FA8C", install: "pip install aider-chat" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#000] text-white overflow-x-hidden">
      {/* ── NAV ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
          background: scrolled ? "rgba(0,0,0,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5"
            data-testid="nav-brand"
          >
            <BrandMark size={28} />
            <span className="font-mono font-bold text-sm tracking-tight">Open Grid</span>
          </button>

          <div className="hidden md:flex items-center gap-7 text-[13px] font-mono text-white/40">
            <a href="#features" className="hover:text-white transition-colors" data-testid="nav-features">Features</a>
            <a href="#agents" className="hover:text-white transition-colors" data-testid="nav-agents">Agents</a>
            <a href="#selfhost" className="hover:text-white transition-colors" data-testid="nav-selfhost">Self-host</a>
            <a href="#security" className="hover:text-white transition-colors" data-testid="nav-security">Security</a>
            <a href="#faq" className="hover:text-white transition-colors" data-testid="nav-faq">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-white/40 hover:text-white transition-colors"
              data-testid="nav-github"
              aria-label="GitHub"
            >
              <SiGithub size={18} />
            </a>
            <button
              onClick={() => setLocation("/canvas")}
              className="h-8 px-3 sm:px-4 text-[13px] font-mono font-semibold text-black transition-opacity hover:opacity-80"
              style={{ background: ORANGE }}
              data-testid="nav-launch"
            >
              Open canvas
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 pb-20 px-5 sm:px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1.1fr] items-center gap-14 lg:gap-12">
        {/* Left: headline */}
        <motion.div
          className="flex flex-col gap-6 w-full min-w-0"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="inline-flex items-center gap-2 self-start px-3 py-1 text-[11px] font-mono uppercase tracking-widest"
            style={{ border: `1px solid ${ORANGE}33`, color: ORANGE }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ORANGE }} />
            Self-hosted · Open source
          </div>

          <h1 className="text-[clamp(2.4rem,5.2vw,4.25rem)] font-black leading-[1.02] tracking-tighter font-mono">
            Every coding agent.<br />
            <span style={{ color: ORANGE }}>One canvas.</span>
          </h1>

          <p className="text-[16px] sm:text-[17px] text-white/55 leading-relaxed max-w-md font-sans">
            A grid of real terminals for <span className="text-white/80">claude, codex, gemini, cursor, grok, aider</span>.
            Runs on your box. Opens in any browser. Type a prompt once and fan it out to every agent at once.
          </p>

          {/* Agent chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {AGENTS.map((a) => (
              <span
                key={a.name}
                className="px-2 py-0.5 text-[11px] font-mono border"
                style={{ borderColor: `${a.color}30`, color: a.color, background: `${a.color}08` }}
              >
                {a.name}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setLocation("/canvas")}
              className="h-12 px-6 text-[14px] font-mono font-semibold text-black flex items-center gap-2 transition-opacity hover:opacity-85 active:opacity-70"
              style={{ background: ORANGE }}
              data-testid="hero-launch"
            >
              <Terminal size={15} />
              Open canvas
            </button>
            <a
              href="#selfhost"
              className="h-12 px-6 text-[14px] font-mono font-semibold text-white/70 flex items-center gap-2 border border-white/10 hover:border-white/25 hover:text-white transition-colors"
              data-testid="hero-selfhost"
            >
              <Download size={14} />
              Run it locally
            </a>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-white/30 pt-2">
            <span className="flex items-center gap-1.5">
              <Globe size={12} /> Works in any browser
            </span>
            <span className="text-white/10">·</span>
            <span>No login</span>
            <span className="text-white/10">·</span>
            <span>BYO keys</span>
            <span className="text-white/10">·</span>
            <span>No telemetry</span>
          </div>
        </motion.div>

        {/* Right: Browser mockup */}
        <motion.div
          className="w-full flex justify-center min-w-0"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <BrowserMockup />
        </motion.div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── FEATURES BENTO ── */}
      <section id="features" className="py-24 px-5 sm:px-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-3">What you get</p>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-black font-mono tracking-tighter leading-tight">
            Many agents.<br />One workflow.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06]">
          {/* Broadcast — wide */}
          <FeatureCell
            wide
            icon={<Radio size={15} />}
            title="Broadcast bar"
            body="Type the prompt once, fan it out to every pane. Watch claude, codex, and gemini answer the same question side-by-side, then keep the one you like."
          >
            <div className="mt-6 font-mono text-[11px] space-y-2">
              <div className="text-white/60">
                <span style={{ color: ORANGE }}>›</span> refactor auth.ts to use jwt
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AGENTS.slice(0, 4).map((a) => (
                  <span
                    key={a.name}
                    className="px-1.5 py-0.5 text-[10px]"
                    style={{ color: a.color, background: `${a.color}12`, border: `1px solid ${a.color}30` }}
                  >
                    → {a.name}
                  </span>
                ))}
              </div>
            </div>
          </FeatureCell>

          {/* Lazy start */}
          <FeatureCell
            icon={<Cpu size={15} />}
            title="Lazy spawn"
            body="Panes sit idle until you tap them. Opening the canvas doesn't fire up six CLIs you weren't going to use anyway."
          />

          {/* PTY persistence — wide */}
          <FeatureCell
            wide
            icon={<RotateCcw size={15} />}
            title="Survives disconnects"
            body="Each pane is a real PTY on the server, not in the tab. Close the lid, switch networks, hop between devices — the agent keeps thinking. Reconnect inside 5 minutes and the last 256KB of output replays so you pick up where you left off."
          >
            <div className="mt-6 grid grid-cols-3 gap-1.5 text-[10px] font-mono">
              <div className="border border-white/10 px-2 py-1.5">
                <div className="text-white/40">tab</div>
                <div className="text-white/80">closes 🗙</div>
              </div>
              <div className="border border-white/10 px-2 py-1.5">
                <div className="text-white/40">pty</div>
                <div className="text-green-400">keeps running ●</div>
              </div>
              <div className="border border-white/10 px-2 py-1.5">
                <div className="text-white/40">reattach</div>
                <div style={{ color: ORANGE }}>replay 256KB</div>
              </div>
            </div>
          </FeatureCell>

          {/* Layout presets */}
          <FeatureCell
            icon={<LayoutGrid size={15} />}
            title="Layout presets"
            body="Free-form drag is the default. One tap snaps every pane into Columns, Rows, Grid, or Focus — and the canvas auto-zooms to fit. Reshuffle as the work changes."
          >
            <div className="mt-6 grid grid-cols-4 gap-1.5 text-[10px] font-mono">
              {[
                { name: "free", cells: 4, layout: "grid-cols-2" },
                { name: "cols", cells: 3, layout: "grid-cols-3" },
                { name: "rows", cells: 3, layout: "grid-rows-3 grid-cols-1" },
                { name: "grid", cells: 4, layout: "grid-cols-2" },
              ].map((p) => (
                <div key={p.name} className="border border-white/10 p-1.5 flex flex-col gap-1">
                  <div className={`grid ${p.layout} gap-0.5 flex-1 min-h-[28px]`}>
                    {Array.from({ length: p.cells }).map((_, i) => (
                      <div key={i} className="bg-white/10" />
                    ))}
                  </div>
                  <div className="text-white/40 text-center text-[9px]">{p.name}</div>
                </div>
              ))}
            </div>
          </FeatureCell>

          {/* Attention detection */}
          <FeatureCell
            icon={<Eye size={15} />}
            title="Attention spotlight"
            body="Every pane is scanned for Y/N prompts, confirmations, and 'continue?' questions. The ones waiting for you light up at the edge so you don't lose an agent to a forgotten approval."
          >
            <div className="mt-6 flex items-center gap-2 font-mono text-[10px]">
              <div
                className="flex-1 border px-2 py-1.5 flex items-center justify-between"
                style={{ borderColor: `${ORANGE}55`, boxShadow: `0 0 12px ${ORANGE}22` }}
              >
                <span style={{ color: ORANGE }}>● gemini</span>
                <span className="text-white/40">(y/N)?</span>
              </div>
              <div className="flex-1 border border-white/10 px-2 py-1.5 flex items-center justify-between">
                <span className="text-white/40">○ codex</span>
                <span className="text-white/20">idle</span>
              </div>
            </div>
          </FeatureCell>

          {/* Command palette */}
          <FeatureCell
            icon={<CommandIcon size={15} />}
            title="Command palette"
            body="⌘K from anywhere. Spawn an agent, switch layouts, zoom, clear the canvas — without lifting your hands off the keyboard."
          >
            <div className="mt-6 font-mono text-[10.5px] border border-white/10 bg-white/[0.02]">
              <div className="px-2.5 py-1.5 border-b border-white/[0.06] text-white/50">
                <span style={{ color: ORANGE }}>›</span> spawn claude
              </div>
              <div className="px-2.5 py-1 text-white/30">layout: grid</div>
              <div className="px-2.5 py-1 text-white/30">zoom to fit</div>
              <div className="px-2.5 py-1 text-white/30">clear all panes</div>
            </div>
          </FeatureCell>

          {/* BYO Keys */}
          <FeatureCell
            icon={<Key size={15} />}
            title="BYO keys, in RAM"
            body="Paste your Anthropic / OpenAI / Gemini / xAI / Cursor keys into the in-app Keys panel. They live in the server's memory only — never on disk, never in logs — and get injected straight into the agent's PTY env."
          >
            <div className="mt-6 font-mono text-[10.5px] space-y-1">
              {[
                { k: "ANTHROPIC_API_KEY", v: "sk-ant-•••••" },
                { k: "OPENAI_API_KEY",    v: "sk-•••••" },
                { k: "GEMINI_API_KEY",    v: "•••••" },
              ].map((k) => (
                <div key={k.k} className="flex items-center justify-between border border-white/[0.06] px-2 py-1">
                  <span className="text-white/50">{k.k}</span>
                  <span style={{ color: ORANGE }}>{k.v}</span>
                </div>
              ))}
            </div>
          </FeatureCell>

          {/* Files tab */}
          <FeatureCell
            icon={<FolderTree size={15} />}
            title="Workspace files, in the panel"
            body="Each pane has a Files tab pinned to your session's workspace dir — read, edit, drop files in without leaving the canvas. Realpath-jailed; you can only ever see your own files."
          >
            <pre className="mt-6 font-mono text-[10.5px] text-white/40 leading-relaxed bg-white/[0.02] border border-white/[0.06] p-3 overflow-x-auto">
{`./
├── src/
│   ├── main.ts
│   └── routes/
├── package.json
└── README.md`}
            </pre>
          </FeatureCell>

          {/* Any device */}
          <FeatureCell
            icon={<Globe size={15} />}
            title="Any device, same canvas"
            body="Laptop, desktop, tablet, phone — it's the same browser app. A floating key-bar surfaces ESC/Tab/Ctrl/arrows when there's no physical keyboard around."
          >
            <div className="mt-6 flex items-center gap-2 flex-wrap text-[11px] font-mono">
              {["ESC", "TAB", "CTRL", "↑", "↓", "←", "→", "↵"].map((k) => (
                <span
                  key={k}
                  className="px-2 py-1 border border-white/15 bg-white/[0.03] text-white/60"
                >
                  {k}
                </span>
              ))}
            </div>
          </FeatureCell>

          {/* Self-hosted */}
          <FeatureCell
            icon={<Server size={15} />}
            title="Your box. Your rules."
            body="Drop it on a VPS, a homelab, a spare desktop. No accounts, no telemetry, no usage caps. Each browser silently gets a signed cookie + its own workspace dir; idle ones self-destruct after 2 hours."
          >
            <pre className="mt-6 font-mono text-[10px] text-white/40 leading-relaxed bg-white/[0.02] border border-white/[0.06] p-2.5 overflow-x-auto">
{`$ SESSION_SECRET=$(openssl rand -hex 32) \\
  WORKSPACES_ROOT=/srv/code \\
  ALLOWED_ORIGINS=https://grid.example.com \\
  pnpm --filter @workspace/api-server run dev`}
            </pre>
          </FeatureCell>

          {/* Security — full row */}
          <div
            id="security"
            className="sm:col-span-2 lg:col-span-3 bg-[#000] p-7 sm:p-8 flex flex-col gap-5"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 flex items-center justify-center"
                style={{ border: `1px solid ${ORANGE}33`, color: ORANGE }}
              >
                <Shield size={15} />
              </div>
              <h3 className="text-lg font-mono font-bold">Locked down out of the gate</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[12px] font-mono">
              {[
                ["Per-session jail", "Each browser gets its own workspace dir. File ops and PTY cwd are realpath-checked — symlinks can't escape, and one session can't read another's files."],
                ["Keys stay in RAM", "Provider API keys live in memory only — never on disk, never logged, never echoed back. Injected straight into the agent's PTY env."],
                ["WS tickets", "Your session cookie stays out of WebSocket URLs. Tickets are single-use, 30 seconds, bound to your session."],
                ["Caps + headers", "Payload size, input rate, total sessions all bounded. Helmet headers on by default. Idle sessions reaped after 2h."],
              ].map(([t, b]) => (
                <div key={t} className="border border-white/[0.06] p-4">
                  <div className="text-white/80 mb-1.5">{t}</div>
                  <div className="text-white/40 text-[11.5px] leading-relaxed">{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── AGENTS GRID ── */}
      <section id="agents" className="py-24 px-5 sm:px-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <p className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-3">Bring your own CLI + keys</p>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-black font-mono tracking-tighter leading-tight">
            No models bundled.<br />
            <span className="text-white/40">Just the binaries you have.</span>
          </h2>
          <p className="text-[15px] text-white/50 mt-4 max-w-xl font-sans">
            Open Grid spawns the CLI you already installed. Paste your provider keys into the in-app Keys panel — they stay in server memory only and get injected straight into the agent's PTY. Nothing gets proxied through us.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06]">
          {AGENTS.map((a) => (
            <div key={a.name} className="bg-[#000] p-6 flex flex-col gap-3 min-h-[140px]">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: a.color, boxShadow: `0 0 12px ${a.color}80` }}
                />
                <span className="font-mono font-bold text-[15px]" style={{ color: a.color }}>
                  {a.name}
                </span>
              </div>
              <code className="font-mono text-[11px] text-white/40 bg-white/[0.02] border border-white/[0.05] px-2 py-1.5 overflow-x-auto whitespace-nowrap">
                {a.install}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── SELF-HOST / DOWNLOAD ── */}
      <SelfHostSection />

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-5 sm:px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <p className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-3">FAQ</p>
          <h2 className="text-[clamp(1.8rem,3.5vw,3rem)] font-black font-mono tracking-tighter">Common questions.</h2>
        </motion.div>

        <div className="flex flex-col divide-y divide-white/[0.06]">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={i}
              index={i}
              q={item.q}
              a={item.a}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── BOTTOM CTA ── */}
      <section className="py-24 px-5 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-7"
        >
          <h2 className="text-[clamp(2.2rem,6vw,4.5rem)] font-black font-mono tracking-tighter leading-[1.02] max-w-3xl">
            Stop picking favorites.<br />
            <span style={{ color: ORANGE }}>Run them all.</span>
          </h2>
          <p className="text-white/40 text-[15px] font-sans max-w-md">
            Open the canvas. Spawn the agents you already pay for. Let them race.
          </p>
          <button
            onClick={() => setLocation("/canvas")}
            className="h-12 px-7 text-[15px] font-mono font-bold text-black flex items-center gap-2 transition-opacity hover:opacity-85"
            style={{ background: ORANGE }}
            data-testid="cta-launch"
          >
            Open canvas
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="border-t border-white/[0.06] pt-16 pb-10 px-5 sm:px-6"
        style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Top: brand + tagline + columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-10 sm:gap-8">
            {/* Brand column — spans 2 on mobile, full row on lg */}
            <div className="col-span-2 lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <BrandMark size={22} />
                <span className="font-mono text-base font-bold">Open Grid</span>
              </div>
              <p className="text-white/40 text-[12.5px] font-mono leading-relaxed max-w-xs">
                A self-hosted terminal canvas for AI coding agents. No accounts,
                no telemetry, no lock-in. MIT licensed.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href="https://github.com/fleet-watcher/opengrid"
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="Source on GitHub"
                  data-testid="footer-github"
                >
                  <SiGithub size={15} />
                </a>
                <a
                  href="https://github.com/fleet-watcher/opengrid/discussions"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11.5px] font-mono text-white/40 hover:text-white transition-colors"
                  data-testid="footer-discussions"
                >
                  Discussions →
                </a>
              </div>
            </div>

            {/* PRODUCT */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/35">
                Product
              </h4>
              <ul className="flex flex-col gap-2.5 text-[12.5px] font-mono text-white/55">
                <li>
                  <a href="#features" className="hover:text-white transition-colors" data-testid="footer-features">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#agents" className="hover:text-white transition-colors" data-testid="footer-agents">
                    Agents
                  </a>
                </li>
                <li>
                  <a href="#selfhost" className="hover:text-white transition-colors" data-testid="footer-selfhost">
                    Self-host
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-changelog"
                  >
                    Changelog
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid/pkgs/container/opengrid"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-docker"
                  >
                    Docker image
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-source"
                  >
                    Source on GitHub
                  </a>
                </li>
              </ul>
            </div>

            {/* COMMUNITY */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/35">
                Community
              </h4>
              <ul className="flex flex-col gap-2.5 text-[12.5px] font-mono text-white/55">
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid#readme"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-about"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid/blob/main/CONTRIBUTING.md"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-contributing"
                  >
                    Contributing
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid/discussions"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-discussions-2"
                  >
                    Discussions
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid/issues"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-issues"
                  >
                    Issues
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/sponsors/opengrid"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-sponsor"
                  >
                    Sponsor
                  </a>
                </li>
              </ul>
            </div>

            {/* TRUST */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/35">
                Trust
              </h4>
              <ul className="flex flex-col gap-2.5 text-[12.5px] font-mono text-white/55">
                <li>
                  <a href="#security" className="hover:text-white transition-colors" data-testid="footer-security">
                    Security model
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid/blob/main/SECURITY.md"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-disclosure"
                  >
                    Responsible disclosure
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid#privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-privacy"
                  >
                    Privacy (no telemetry)
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors" data-testid="footer-faq">
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fleet-watcher/opengrid/blob/main/LICENSE"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                    data-testid="footer-license"
                  >
                    MIT License
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="mt-12 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-[11px] font-mono text-white/25">
              © {new Date().getFullYear()} Open Grid contributors. Built in the open.
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono text-white/25">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                No accounts. No tracking. Your keys never leave your server.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────
   Brand mark — bracket-G monogram
───────────────────────────────────────── */
function BrandMark({ size = 28 }: { size?: number }) {
  const fs = Math.round(size * 0.5);
  return (
    <div
      className="flex items-center justify-center text-black font-black select-none"
      style={{ width: size, height: size, background: ORANGE, fontSize: fs, fontFamily: "ui-monospace, monospace" }}
      aria-hidden
    >
      AG
    </div>
  );
}

/* ─────────────────────────────────────────
   Feature cell
───────────────────────────────────────── */
function FeatureCell({
  icon,
  title,
  body,
  wide,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      className={`bg-[#000] p-7 sm:p-8 flex flex-col min-h-[220px] ${wide ? "lg:col-span-2" : ""}`}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="w-8 h-8 mb-6 flex items-center justify-center"
        style={{ border: `1px solid ${ORANGE}33`, color: ORANGE }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-mono font-bold mb-2">{title}</h3>
      <p className="text-[14px] text-white/45 leading-relaxed max-w-md">{body}</p>
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   Browser mockup — desktop-style window
   with three terminal panes + broadcast bar.
───────────────────────────────────────── */
function BrowserMockup() {
  return (
    <div
      className="relative w-full"
      style={{
        maxWidth: 560,
        aspectRatio: "16 / 11",
        borderRadius: 12,
        background: "linear-gradient(180deg,#141414,#0a0a0a)",
        boxShadow:
          "0 32px 80px rgba(255,69,0,0.10), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-3 h-8"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <div className="flex-1 flex justify-center">
          <div
            className="px-3 h-5 flex items-center text-[10px] font-mono text-white/40 rounded"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            opengrid.local/canvas
          </div>
        </div>
        <BrandMark size={14} />
      </div>

      {/* Canvas area */}
      <div
        className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-2 p-3"
        style={{
          top: 32,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
          backgroundSize: "16px 16px",
          paddingBottom: 48,
        }}
      >
        <MockPane
          color="#FF9F4A"
          name="claude"
          lines={[
            { c: "#FF9F4A", t: "● claude-code" },
            { c: "#88a", t: "$ analyze auth" },
            { c: "#bbb", t: "Reading src/auth/*" },
            { c: "#bbb", t: "3 entry points." },
            { c: "#fff", t: "Plan: extract JWT" },
            { c: "#fff", t: "middleware → shared/" },
          ]}
          attention
          badge
        />
        <MockPane
          color="#A5C9FF"
          name="codex"
          lines={[
            { c: "#A5C9FF", t: "● codex" },
            { c: "#88a", t: "$ same prompt" },
            { c: "#bbb", t: "Will refactor" },
            { c: "#bbb", t: "in-place." },
            { c: "#bbb", t: "Creating PR..." },
          ]}
        />
        <MockPane
          color="#74E0BB"
          name="gemini"
          lines={[
            { c: "#74E0BB", t: "● gemini" },
            { c: "#88a", t: "$ same prompt" },
            { c: "#bbb", t: "Suggests middleware" },
            { c: "#bbb", t: "factory pattern…" },
          ]}
        />
      </div>

      {/* Broadcast bar */}
      <div
        className="absolute inset-x-3 bottom-3 rounded-lg p-2.5 flex items-center gap-2"
        style={{
          background: "rgba(20,20,20,0.95)",
          border: `1px solid ${ORANGE}55`,
          backdropFilter: "blur(8px)",
        }}
      >
        <Radio size={12} style={{ color: ORANGE }} className="shrink-0" />
        <div className="flex-1 text-[11px] font-mono text-white/70 truncate">
          refactor auth.ts to use jwt
        </div>
        <span
          className="px-1.5 py-0.5 text-[9.5px] font-mono"
          style={{ color: ORANGE, border: `1px solid ${ORANGE}50` }}
        >
          send 3
        </span>
      </div>
    </div>
  );
}

function MockPane({
  color,
  name,
  lines,
  attention,
  badge,
}: {
  color: string;
  name: string;
  lines: { c: string; t: string }[];
  attention?: boolean;
  badge?: boolean;
}) {
  return (
    <div
      className="relative flex flex-col min-w-0"
      style={{
        background: "#0a0a0a",
        border: `1px solid ${attention ? `${color}55` : "rgba(255,255,255,0.07)"}`,
        borderLeft: `2px solid ${color}`,
        boxShadow: attention ? `0 0 24px ${color}33` : "none",
      }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "#0f0f0f" }}
      >
        <span className="font-mono text-[10px] font-bold truncate" style={{ color }}>
          {name}
        </span>
        {badge && (
          <span
            className="ml-auto text-[8px] font-mono px-1 animate-pulse"
            style={{ color, background: `${color}1a` }}
          >
            ●
          </span>
        )}
      </div>
      <div className="px-2 py-1.5 font-mono text-[9.5px] leading-[1.45] overflow-hidden">
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.c }} className="truncate">
            {l.t}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Self-host / Run locally
───────────────────────────────────────── */
function CopyBlock({ code, testId }: { code: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="font-mono text-[11.5px] sm:text-[12px] text-white/70 leading-relaxed bg-white/[0.02] border border-white/[0.08] p-3.5 pr-12 overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute top-2 right-2 p-1.5 text-white/30 hover:text-white border border-white/10 hover:border-white/25 transition-colors"
        aria-label="Copy"
        data-testid={testId}
      >
        {copied ? <Check size={13} style={{ color: ORANGE }} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function SelfHostSection() {
  return (
    <section id="selfhost" className="py-24 px-5 sm:px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-3">Run locally</p>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-black font-mono tracking-tighter leading-tight">
            On your machine.<br />
            <span style={{ color: ORANGE }}>In about a minute.</span>
          </h2>
        </div>
        <p className="text-white/45 text-[14px] font-sans max-w-sm leading-relaxed">
          Open Grid is a Node server + a static web canvas — clone, drop your <span className="text-white/70">SESSION_SECRET</span>, run two commands.
          No installer, no binary, no account. Works on macOS, Linux, WSL2.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06]">
        {/* ── Quick install ── */}
        <div className="bg-black p-7 sm:p-8 flex flex-col gap-5 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center border"
              style={{ borderColor: `${ORANGE}33`, background: `${ORANGE}10`, color: ORANGE }}
            >
              <Download size={15} />
            </div>
            <h3 className="font-mono font-bold text-[15px]">One-line install</h3>
          </div>
          <p className="text-white/45 text-[13.5px] font-sans leading-relaxed max-w-xl">
            Clones the repo into <span className="text-white/70 font-mono">./opengrid</span>, generates a fresh
            <span className="text-white/70 font-mono"> SESSION_SECRET</span>, installs deps with pnpm,
            and prints the two commands that start the API + canvas.
          </p>
          <CopyBlock
            testId="copy-install-script"
            code={`curl -fsSL https://raw.githubusercontent.com/fleet-watcher/opengrid/main/scripts/install.sh | bash`}
          />
          <p className="text-white/30 text-[11.5px] font-mono">
            ⌥ Don't trust pipes-to-bash? <span className="text-white/55">Read the script first</span> — it's 80 lines.
          </p>
        </div>

        {/* ── Prereqs ── */}
        <div className="bg-black p-7 sm:p-8 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center border border-white/15 text-white/70">
              <Cpu size={15} />
            </div>
            <h3 className="font-mono font-bold text-[15px]">Prerequisites</h3>
          </div>
          <ul className="font-mono text-[12.5px] text-white/50 space-y-2.5">
            <li className="flex items-center justify-between">
              <span>node</span><span className="text-white/70">≥ 20</span>
            </li>
            <li className="flex items-center justify-between">
              <span>pnpm</span><span className="text-white/70">≥ 9</span>
            </li>
            <li className="flex items-center justify-between">
              <span>git</span><span className="text-white/70">any</span>
            </li>
            <li className="flex items-center justify-between">
              <span>OS</span><span className="text-white/70">mac · linux · wsl</span>
            </li>
          </ul>
          <p className="text-white/30 text-[11px] font-mono leading-relaxed pt-2 border-t border-white/[0.06]">
            Plus the agent CLIs you want on <span className="text-white/55">$PATH</span> — install only the ones you'll actually use.
          </p>
        </div>

        {/* ── Manual ── */}
        <div className="bg-black p-7 sm:p-8 flex flex-col gap-4 lg:col-span-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center border border-white/15 text-white/70">
              <Terminal size={15} />
            </div>
            <h3 className="font-mono font-bold text-[15px]">Or do it by hand</h3>
          </div>
          <p className="text-white/45 text-[13.5px] font-sans leading-relaxed max-w-2xl">
            Four steps. Two terminals. Then open <span className="text-white/70 font-mono">localhost:5173</span>.
          </p>
          <CopyBlock
            testId="copy-install-manual"
            code={`# 1. Clone
git clone https://github.com/fleet-watcher/opengrid.git
cd opengrid

# 2. Install
pnpm install

# 3. API + WebSocket  (terminal 1)
SESSION_SECRET=$(openssl rand -hex 32) \\
PORT=4000 \\
pnpm --filter @workspace/api-server run dev

# 4. Web canvas  (terminal 2)
PORT=5173 pnpm --filter @workspace/opengrid-canvas run dev`}
          />
        </div>
      </div>

      {/* What about a .dmg / .exe? */}
      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 border border-white/[0.06] bg-white/[0.015]">
        <div className="text-white/30 font-mono text-[10px] uppercase tracking-widest shrink-0">Note</div>
        <p className="text-white/50 text-[13px] font-sans leading-relaxed">
          We don't ship a <span className="text-white/70 font-mono">.dmg</span> or <span className="text-white/70 font-mono">.exe</span>.
          Open Grid is meant to live on a box you can <span className="text-white/70">reach from anywhere</span> —
          your laptop is fine, but a homelab or VPS lets your phone, tablet, and other machines hit the same canvas.
          {" "}
          <a href="https://github.com" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white underline underline-offset-2 decoration-white/20 hover:decoration-white">
            View source on GitHub
          </a>.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   FAQ
───────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "What does Open Grid actually do?",
    a: "It spawns each coding-agent CLI you already use (claude, codex, gemini, cursor, grok, aider) in its own terminal pane, all on one canvas. A broadcast bar lets you send the same prompt to multiple panes at once so you can compare answers.",
  },
  {
    q: "Do I need to sign up or log in?",
    a: "No. The first time you open the canvas, the server quietly issues a signed HttpOnly cookie and creates a private workspace dir for you. No email, no password, no account.",
  },
  {
    q: "Where do my API keys live?",
    a: "You paste them once into the in-app Keys panel (top-right toolbar). They stay in the server's memory only — never written to disk, never logged, never echoed back — and get injected straight into the agent CLI's environment when you spawn it. End the session and they're gone.",
  },
  {
    q: "Can another user see my files or my agents?",
    a: "No. Each browser gets its own workspace dir keyed off its cookie. The Files API realpath-checks every path against that dir, and PTYs are namespaced per-session so you can't attach to someone else's terminal even by guessing the panel id.",
  },
  {
    q: "What happens if I walk away?",
    a: "If you don't touch the canvas for 2 hours, the server kills your PTYs, deletes your workspace dir, and drops your API keys. Come back later and you get a fresh slate. Within an active session, a closed tab keeps the PTY alive for 5 minutes and the last 256KB of output replays on reconnect.",
  },
  {
    q: "Which agents work?",
    a: "claude, codex, gemini, cursor, grok, aider (with the Venice preset). Anything that runs as an interactive shell process can be added to the registry on the server.",
  },
  {
    q: "Can the browser run anything it wants on my box?",
    a: "No. The client sends an agent name; the server resolves the command from an allowlist. cwd is jailed to your session's workspace, the session cookie never appears in WebSocket URLs (one-shot tickets are used instead), and there are rate limits, payload caps, and a session cap.",
  },
  {
    q: "Is it really self-hosted?",
    a: "That's the only way to run it. MIT licensed, no SaaS, no telemetry. Set SESSION_SECRET, WORKSPACES_ROOT, ALLOWED_ORIGINS and stick it behind your reverse proxy.",
  },
];

function FaqItem({
  index,
  q,
  a,
  open,
  onToggle,
}: {
  index: number;
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid={`faq-${index}`}
      >
        <span className="font-mono text-[14px] sm:text-[15px] font-semibold text-white/80 group-hover:text-white transition-colors pr-6">
          {q}
        </span>
        <span className="text-white/25 shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <p className="text-[13.5px] sm:text-[14px] font-sans text-white/45 leading-relaxed pb-5 max-w-2xl">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
