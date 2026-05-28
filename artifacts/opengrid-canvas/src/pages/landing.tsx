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
  Menu,
  X,
  Smartphone,
  Sparkles,
  Scale,
  Star,
  Clock,
  Coins,
} from "lucide-react";

// Format a recent date as "Nh ago" / "Nd ago" / "Mon D". Used by the
// landing "last commit" pill. Returns the empty string for null input so
// the pill can render a stable skeleton while the GitHub API fetch is in
// flight, with no layout shift on resolve.
function timeAgo(iso: string | null): string {
  if (!iso) return "…";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "…";
  const diffMs = Date.now() - then;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface RepoStats {
  stars: number | null;
  lastCommit: string | null;
}

// Self-hosted "live signals" — fetches stars + last commit timestamp directly
// from GitHub once per page load. Replaces img.shields.io badges (which were
// blocked / broken-image-iconing on some corporate / mobile networks). Fails
// silently — pills just render their default text and remain clickable.
function useRepoStats(): RepoStats {
  const [stats, setStats] = useState<RepoStats>({ stars: null, lastCommit: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("https://api.github.com/repos/opengrid1/opengrid", {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as {
          stargazers_count?: number;
          pushed_at?: string;
        };
        setStats({
          stars: typeof j.stargazers_count === "number" ? j.stargazers_count : null,
          lastCommit: typeof j.pushed_at === "string" ? j.pushed_at : null,
        });
      } catch {
        /* offline / rate-limited / blocked — keep skeleton */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

const ORANGE = "#FF4500";
const REPO_URL = "https://github.com/opengrid1/opengrid";
// $OG token contract — launched in the @bankrbot ecosystem on Base. Fees
// route to the project and are used for ongoing improvements (infra, new
// features, mobile polish). Surfacing the CA inline on the landing page
// lets prospective holders verify on BaseScan in one click instead of
// hunting through replies or screenshots.
const OG_TOKEN_ADDRESS = "0x18fb571c84483a9875b37f499d925dce9827dba3";
const OG_TOKEN_URL = `https://basescan.org/token/${OG_TOKEN_ADDRESS}`;

// Three small inline pills: stars / MIT / last commit. All clickable, all
// render immediately (no external image dependency), and resolve to live
// numbers from the GitHub API within ~200ms. Skeleton state uses an em-dash
// so the layout doesn't reflow when data arrives. Styling matches the
// rest of the brutalist monochrome chrome on the landing page.
function RepoBadges() {
  const { stars, lastCommit } = useRepoStats();
  const pill =
    "inline-flex items-center gap-1.5 px-2 py-1 rounded border border-white/10 " +
    "bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 transition-colors " +
    "text-[11px] font-mono text-white/70 hover:text-white";
  return (
    <div className="flex items-center gap-2 flex-wrap pt-1">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        data-testid="badge-stars"
        aria-label="GitHub stars"
        className={pill}
      >
        <Star size={11} className="opacity-70" style={{ color: ORANGE }} fill={ORANGE} />
        <span>{stars === null ? "—" : stars.toLocaleString()}</span>
        <span className="text-white/40">stars</span>
      </a>
      <a
        href={`${REPO_URL}/blob/main/LICENSE`}
        target="_blank"
        rel="noreferrer"
        data-testid="badge-license"
        aria-label="MIT license"
        className={pill}
      >
        <Scale size={11} className="opacity-70" />
        <span>MIT</span>
      </a>
      <a
        href={`${REPO_URL}/commits/main`}
        target="_blank"
        rel="noreferrer"
        data-testid="badge-commit"
        aria-label="Last commit"
        className={pill}
      >
        <Clock size={11} className="opacity-70" />
        <span className="text-white/40">updated</span>
        <span>{timeAgo(lastCommit)}</span>
      </a>
      <a
        href={OG_TOKEN_URL}
        target="_blank"
        rel="noreferrer"
        data-testid="badge-token"
        aria-label={`$OG token contract on Base: ${OG_TOKEN_ADDRESS}`}
        title={OG_TOKEN_ADDRESS}
        className={pill}
      >
        <Coins size={11} className="opacity-70" style={{ color: ORANGE }} />
        <span>$OG</span>
        <span className="text-white/40 break-all">{OG_TOKEN_ADDRESS}</span>
      </a>
    </div>
  );
}

// CLI agents Open Grid actually spawns over PTY (server-side registry in
// lib/terminal.ts). Keep this list in sync with AGENT_REGISTRY.
const AGENTS: { name: string; color: string; install: string }[] = [
  { name: "claude",  color: "#FF9F4A", install: "npm i -g @anthropic-ai/claude-code" },
  { name: "codex",   color: "#A5C9FF", install: "npm i -g @openai/codex" },
  { name: "gemini",  color: "#74E0BB", install: "npm i -g @google/gemini-cli" },
  { name: "cursor",  color: "#C9A6FF", install: "curl https://cursor.com/install -fsS | bash" },
  { name: "grok",    color: "#F472B6", install: "npm i -g @xai/grok-cli" },
  { name: "aider",   color: "#F1FA8C", install: "pip install aider-chat" },
  { name: "bankr",   color: "#FFB347", install: "npm i -g @bankr/cli" },
];

const NAV_LINKS = [
  { href: "#features", label: "Features", testId: "nav-features" },
  { href: "#agents", label: "Agents", testId: "nav-agents" },
  { href: "#selfhost", label: "Self-host", testId: "nav-selfhost" },
  { href: "#security", label: "Security", testId: "nav-security" },
  { href: "#faq", label: "FAQ", testId: "nav-faq" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile nav when the user navigates to a section.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onHash = () => setMobileNavOpen(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [mobileNavOpen]);

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

          <div className="hidden md:flex items-center gap-7 text-[13px] font-mono text-white/55">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-white transition-colors" data-testid={l.testId}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-white/55 hover:text-white transition-colors"
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
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden w-9 h-9 -mr-2 flex items-center justify-center text-white/70 hover:text-white"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel"
              data-testid="nav-mobile-toggle"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav panel */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              id="mobile-nav-panel"
              className="md:hidden border-t border-white/[0.06] bg-black/95 backdrop-blur-md"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
              data-testid="mobile-nav-panel"
            >
              <div className="px-5 py-3 flex flex-col">
                {NAV_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileNavOpen(false)}
                    className="py-3 text-[14px] font-mono text-white/70 hover:text-white border-b border-white/[0.04] last:border-b-0"
                    data-testid={`${l.testId}-mobile`}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 pb-20 px-5 sm:px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[0.85fr_1.35fr] items-center gap-14 lg:gap-10">
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

          <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[11px] font-mono text-white/55 pt-2">
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

          {/* Live project signals — self-hosted pills, GitHub API client fetch.
              Previously used img.shields.io but it got blocked / broken-image
              on enough networks (corp proxies, mobile carriers, ad blockers)
              that "is this project even alive?" became a real first-impression
              risk. These render instantly with a skeleton and resolve to live
              numbers within ~200ms. */}
          <RepoBadges />

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

      {/* ── COMPARISON ── */}
      <ComparisonSection />

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── MOBILE ── */}
      <MobileSection />

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── SELF-HOST / DOWNLOAD ── */}
      <SelfHostSection />

      {/* ── DIVIDER ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── PRICING / LICENSE ── */}
      <PricingCallout />

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
              <p className="text-white/55 text-[12.5px] font-mono leading-relaxed max-w-xs">
                A self-hosted terminal canvas for AI coding agents. No accounts,
                no telemetry, no lock-in. MIT licensed.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="Source on GitHub"
                  data-testid="footer-github"
                >
                  <SiGithub size={15} />
                </a>
                <a
                  href={`${REPO_URL}/discussions`}
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
                    href={`${REPO_URL}/releases`}
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
                    href={`${REPO_URL}/pkgs/container/opengrid`}
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
                    href={REPO_URL}
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
                    href={`${REPO_URL}#readme`}
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
                    href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
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
                    href={`${REPO_URL}/discussions`}
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
                    href={`${REPO_URL}/issues`}
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
                    href="https://github.com/sponsors/opengrid1"
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
                    href={`${REPO_URL}/blob/main/SECURITY.md`}
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
                    href={`${REPO_URL}#privacy`}
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
                    href={`${REPO_URL}/blob/main/LICENSE`}
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

          {/* Roadmap strip */}
          <div className="mt-12 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-start gap-3 sm:gap-6">
            <div className="flex items-center gap-2 shrink-0">
              <Sparkles size={13} style={{ color: ORANGE }} />
              <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-white/40">
                Roadmap
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11.5px] font-mono text-white/55">
              <span>Docker image</span>
              <span className="text-white/15">·</span>
              <span>Saved layouts</span>
              <span className="text-white/15">·</span>
              <span>Shareable canvases</span>
              <span className="text-white/15">·</span>
              <span>Pane snapshots</span>
              <span className="text-white/15">·</span>
              <a
                href={`${REPO_URL}/issues?q=is%3Aissue+label%3Aroadmap`}
                target="_blank"
                rel="noreferrer"
                className="text-white/70 hover:text-white underline decoration-white/15 underline-offset-2"
                data-testid="footer-roadmap"
              >
                Vote on the rest →
              </a>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
   Brand mark — bracket-OG monogram (SVG)
───────────────────────────────────────── */
function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      role="img"
      aria-label="Open Grid"
      className="select-none"
    >
      <rect width="180" height="180" rx={Math.round(180 * 0.2)} fill={ORANGE} />
      <g stroke="#000" strokeWidth="10" strokeLinecap="square" fill="none">
        <path d="M28 46 L28 28 L46 28" />
        <path d="M152 28 L170 28 L170 46" />
        <path d="M28 134 L28 152 L46 152" />
        <path d="M152 152 L170 152 L170 134" />
      </g>
      <text
        x="90"
        y="122"
        fill="#000"
        fontFamily="ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace"
        fontWeight={900}
        fontSize={96}
        letterSpacing={-4}
        textAnchor="middle"
      >
        OG
      </text>
    </svg>
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
   Browser mockup — desktop-style window with a 2x3 grid of terminal panes
   and an animated broadcast bar. Loops the full "type prompt → broadcast →
   panes light up → output streams in" sequence on a 12s cadence so the
   hero feels alive without the user having to click anything. The whole
   animation is driven off a single 20fps tick (state value 0..239); all
   pane content is derived from that tick rather than imperatively
   scheduled, so it's cheap and never desyncs.
───────────────────────────────────────── */
const DEMO_PROMPT = "refactor auth.ts to use jwt";

interface DemoAgent {
  color: string;
  name: string;
  lines: { c: string; t: string }[];
}

// Mirrors the AGENTS list (same colors, same order) so the hero matches
// the real agent registry. Each agent gets a distinct, plausible response
// pattern so the demo reads as 6 actually-different opinions on the same
// prompt — that's the core value prop, so it needs to be visible at a
// glance.
const DEMO_AGENTS: DemoAgent[] = [
  {
    color: "#FF9F4A",
    name: "claude",
    lines: [
      { c: "#88a", t: "$ refactor auth.ts" },
      { c: "#bbb", t: "Reading src/auth/*" },
      { c: "#bbb", t: "3 entry points." },
      { c: "#fff", t: "Plan: extract JWT" },
      { c: "#fff", t: "middleware → shared/" },
    ],
  },
  {
    color: "#A5C9FF",
    name: "codex",
    lines: [
      { c: "#88a", t: "$ same prompt" },
      { c: "#bbb", t: "Refactor in-place." },
      { c: "#bbb", t: "Drafting diff…" },
      { c: "#fff", t: "+ verifyToken()" },
    ],
  },
  {
    color: "#74E0BB",
    name: "gemini",
    lines: [
      { c: "#88a", t: "$ same prompt" },
      { c: "#bbb", t: "Middleware factory" },
      { c: "#bbb", t: "pattern, then…" },
      { c: "#fff", t: "wire into express" },
    ],
  },
  {
    color: "#C9A6FF",
    name: "cursor",
    lines: [
      { c: "#88a", t: "$ same prompt" },
      { c: "#bbb", t: "Editing auth.ts" },
      { c: "#fff", t: "+ jwt import" },
      { c: "#fff", t: "+ sign / verify" },
    ],
  },
  {
    color: "#F472B6",
    name: "grok",
    lines: [
      { c: "#88a", t: "$ same prompt" },
      { c: "#bbb", t: "Building diff…" },
      { c: "#fff", t: "see auth.ts:42" },
    ],
  },
  {
    color: "#F1FA8C",
    name: "aider",
    lines: [
      { c: "#88a", t: "$ same prompt" },
      { c: "#bbb", t: "Applying edits." },
      { c: "#bbb", t: "1 file changed." },
      { c: "#fff", t: "commit: 'jwt auth'" },
    ],
  },
];

// One tick = 50ms; 240 ticks = 12s full cycle. Phase boundaries are picked
// so the typing reads at a natural speed, the broadcast pulse is short,
// and the streaming phase has room for all 6 agents to stagger in.
const TICK_MS = 50;
const TICKS_PER_CYCLE = 240;
const PHASE_IDLE_END = 14;       // 0.7s blank
const PHASE_TYPING_END = 60;     // ~2.3s typing (one char per ~50ms)
const PHASE_SENDING_END = 70;    // 0.5s send pulse
const PHASE_STREAMING_END = 205; // 6.75s streaming (panes fill in stagger)
// remainder = ~1.75s hold + reset

function BrowserMockup() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setTick((t) => (t + 1) % TICKS_PER_CYCLE),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const phase =
    tick < PHASE_IDLE_END
      ? "idle"
      : tick < PHASE_TYPING_END
        ? "typing"
        : tick < PHASE_SENDING_END
          ? "sending"
          : tick < PHASE_STREAMING_END
            ? "streaming"
            : "done";

  // Broadcast-bar prompt is revealed char-by-char during the typing phase.
  const promptChars =
    phase === "idle"
      ? 0
      : phase === "typing"
        ? Math.min(DEMO_PROMPT.length, tick - PHASE_IDLE_END)
        : DEMO_PROMPT.length;
  const promptText = DEMO_PROMPT.slice(0, promptChars);
  const showCaret = phase === "typing" && tick % 12 < 6;

  // Per-pane line count: 0 until streaming starts, then one line every
  // ~300ms (6 ticks) with a 5-tick stagger between agents so the eye can
  // follow the cascade instead of being hit by 24 lines at once.
  const linesFor = (idx: number, totalLines: number): number => {
    if (phase === "done") return totalLines;
    if (phase !== "streaming") return 0;
    const streamTick = tick - PHASE_STREAMING_END + (PHASE_STREAMING_END - PHASE_SENDING_END) - idx * 5;
    if (streamTick < 0) return 0;
    return Math.min(totalLines, Math.floor(streamTick / 6) + 1);
  };

  // Attention glow ripples across all panes during sending + early
  // streaming so the user sees "the prompt fanned out to all 6."
  const attentionFor = (idx: number): boolean => {
    if (phase === "sending") return true;
    if (phase === "streaming" && tick - PHASE_SENDING_END < idx * 5 + 16) return true;
    return false;
  };

  const sendPulse = phase === "sending";

  return (
    <div
      className="relative w-full aspect-[3/4] sm:aspect-[5/4] lg:aspect-[16/10]"
      style={{
        maxWidth: 820,
        borderRadius: 14,
        background: "linear-gradient(180deg,#141414,#0a0a0a)",
        boxShadow:
          "0 40px 100px rgba(255,69,0,0.14), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
      data-testid="hero-demo"
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

      {/* Canvas area — 2 cols × 3 rows on mobile (taller, easier to read);
          flips to 3 cols × 2 rows on desktop. */}
      <div
        className="absolute inset-x-0 grid grid-cols-2 grid-rows-3 sm:grid-cols-3 sm:grid-rows-2 gap-1.5 p-3"
        style={{
          top: 32,
          bottom: 56,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      >
        {DEMO_AGENTS.map((a, i) => (
          <MockPane
            key={a.name}
            color={a.color}
            name={a.name}
            lines={a.lines.slice(0, linesFor(i, a.lines.length))}
            attention={attentionFor(i)}
          />
        ))}
      </div>

      {/* Broadcast bar */}
      <div
        className="absolute inset-x-3 bottom-3 rounded-lg p-2.5 flex items-center gap-2 transition-shadow duration-300"
        style={{
          background: "rgba(20,20,20,0.95)",
          border: `1px solid ${sendPulse ? ORANGE : `${ORANGE}55`}`,
          boxShadow: sendPulse ? `0 0 28px ${ORANGE}66` : "none",
          backdropFilter: "blur(8px)",
        }}
      >
        <Radio size={12} style={{ color: ORANGE }} className="shrink-0" />
        <div className="flex-1 text-[11px] font-mono text-white/85 truncate min-h-[1.1em]">
          {promptText}
          {showCaret && <span style={{ color: ORANGE }}>▍</span>}
        </div>
        <span
          className="px-1.5 py-0.5 text-[9.5px] font-mono transition-opacity duration-200"
          style={{
            color: ORANGE,
            border: `1px solid ${ORANGE}${sendPulse ? "" : "50"}`,
            background: sendPulse ? `${ORANGE}22` : "transparent",
            opacity: phase === "idle" ? 0.4 : 1,
          }}
        >
          send 6
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
}: {
  color: string;
  name: string;
  lines: { c: string; t: string }[];
  attention?: boolean;
}) {
  return (
    <div
      className="relative flex flex-col min-w-0 transition-all duration-200"
      style={{
        background: "#0a0a0a",
        border: `1px solid ${attention ? `${color}66` : "rgba(255,255,255,0.07)"}`,
        borderLeft: `2px solid ${color}`,
        boxShadow: attention ? `0 0 18px ${color}44` : "none",
      }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "#0f0f0f" }}
      >
        <span className="font-mono text-[10px] font-bold truncate" style={{ color }}>
          {name}
        </span>
        {attention && (
          <span
            className="ml-auto text-[8px] font-mono px-1 animate-pulse"
            style={{ color, background: `${color}1a` }}
          >
            ●
          </span>
        )}
      </div>
      <div className="px-2 py-1.5 font-mono text-[9.5px] leading-[1.45] overflow-hidden flex-1">
        {lines.map((l, i) => (
          <div
            key={i}
            style={{ color: l.c, animation: "ogFadeIn 250ms ease-out" }}
            className="truncate"
          >
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
            code={`curl -fsSL https://raw.githubusercontent.com/opengrid1/opengrid/main/scripts/install.sh | bash`}
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
            Four steps. Two terminals. Then open the canvas at <span className="text-white/70 font-mono">localhost:&lt;PORT&gt;</span> — any free port works.
          </p>
          <CopyBlock
            testId="copy-install-manual"
            code={`# 1. Clone
git clone https://github.com/opengrid1/opengrid.git
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
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-white/70 hover:text-white underline underline-offset-2 decoration-white/20 hover:decoration-white">
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
  {
    q: "Is it free? What's the catch?",
    a: "Free, forever, MIT licensed. There's no paid tier, no usage caps, and no hosted SaaS to upsell you onto. You pay for the box you run it on (a $5 VPS is plenty for one person) and the API credits you'd already be paying your model providers. We don't see your prompts, your code, or your keys.",
  },
  {
    q: "Why not just use tmux or multiple terminal tabs?",
    a: "tmux is great if you live on one machine and don't need a UI. Open Grid adds three things tmux can't: a broadcast bar that fans one prompt out to every pane at once, an attention spotlight that flags which agents are waiting on you, and a browser-based canvas that follows you from laptop to phone — same session, same workspace, same in-flight PTYs.",
  },
  {
    q: "Does it work on a phone?",
    a: "Yes. The canvas is responsive and there's a floating key-bar that surfaces ESC, Tab, Ctrl, arrows, and Enter — the keys touch keyboards usually hide. Long-running agents keep working when you switch apps, and reconnect-with-replay means closing Safari to take a call doesn't lose context.",
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
        aria-expanded={open}
        aria-controls={`faq-panel-${index}`}
        id={`faq-trigger-${index}`}
      >
        <span className="font-mono text-[14px] sm:text-[15px] font-semibold text-white/80 group-hover:text-white transition-colors pr-6">
          {q}
        </span>
        <span className="text-white/25 shrink-0" aria-hidden>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`faq-panel-${index}`}
            role="region"
            aria-labelledby={`faq-trigger-${index}`}
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

/* ─────────────────────────────────────────
   Why not tmux? — comparison
───────────────────────────────────────── */
function ComparisonSection() {
  type Row = { label: string; tmux: string | boolean; tabs: string | boolean; og: string | boolean };
  const ROWS: Row[] = [
    { label: "Runs every CLI in its own pane",     tmux: true,  tabs: true,           og: true },
    { label: "Broadcast one prompt to N agents",   tmux: false, tabs: false,          og: true },
    { label: "Spotlights panes waiting on you",    tmux: false, tabs: false,          og: true },
    { label: "Shared workspace dir across panes",  tmux: true,  tabs: "per-tab cwd",  og: true },
    { label: "Survives disconnects (PTY on server)", tmux: true, tabs: false,         og: true },
    { label: "Works from a phone browser",         tmux: false, tabs: false,          og: true },
    { label: "Drag-to-arrange + layout presets",   tmux: "manual splits", tabs: false, og: true },
    { label: "BYO-key manager (in-RAM, per-session)", tmux: false, tabs: false,       og: true },
  ];
  const renderCell = (v: string | boolean) => {
    if (v === true) {
      return <Check size={14} style={{ color: ORANGE }} />;
    }
    if (v === false) {
      return <span className="text-white/20 font-mono text-[13px]">—</span>;
    }
    return <span className="font-mono text-[11px] text-white/55">{v}</span>;
  };
  return (
    <section className="py-24 px-5 sm:px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-12"
      >
        <p className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-3">vs. the alternatives</p>
        <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-black font-mono tracking-tighter leading-tight">
          Why not just <span className="text-white/40">open tmux?</span>
        </h2>
        <p className="text-[15px] text-white/50 mt-4 max-w-xl font-sans">
          tmux is great. Six browser tabs work in a pinch. Open Grid is the layer on top
          when you want one prompt, many agents, from any device.
        </p>
      </motion.div>

      <div className="border border-white/[0.06] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.015]">
              <th className="text-[11px] font-mono uppercase tracking-widest text-white/30 px-5 py-4 font-normal">
                Capability
              </th>
              <th className="text-[12px] font-mono font-bold text-white/55 px-4 py-4 text-center w-[20%]">
                tmux / screen
              </th>
              <th className="text-[12px] font-mono font-bold text-white/55 px-4 py-4 text-center w-[20%]">
                6 browser tabs
              </th>
              <th
                className="text-[12px] font-mono font-bold px-4 py-4 text-center w-[22%]"
                style={{ color: ORANGE, background: `${ORANGE}08` }}
              >
                Open Grid
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr
                key={r.label}
                className="border-b border-white/[0.04] last:border-b-0"
                data-testid={`compare-row-${i}`}
              >
                <td className="px-5 py-3.5 text-[13px] font-sans text-white/75">{r.label}</td>
                <td className="px-4 py-3.5 text-center">{renderCell(r.tmux)}</td>
                <td className="px-4 py-3.5 text-center">{renderCell(r.tabs)}</td>
                <td className="px-4 py-3.5 text-center" style={{ background: `${ORANGE}05` }}>
                  {renderCell(r.og)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   From your phone
───────────────────────────────────────── */
function MobileSection() {
  return (
    <section className="py-24 px-5 sm:px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] items-center gap-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-5"
      >
        <div
          className="inline-flex items-center gap-2 self-start px-3 py-1 text-[11px] font-mono uppercase tracking-widest"
          style={{ border: `1px solid ${ORANGE}33`, color: ORANGE }}
        >
          <Smartphone size={11} />
          From your phone
        </div>
        <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-black font-mono tracking-tighter leading-tight">
          Code from the<br />
          <span style={{ color: ORANGE }}>back of an Uber.</span>
        </h2>
        <p className="text-[15px] text-white/55 leading-relaxed max-w-md font-sans">
          The canvas is responsive, gestures work, and a floating key-bar surfaces the
          keys touch keyboards hide — ESC, Tab, Ctrl, arrows, Enter. Switch apps to
          take a call: PTYs keep running, reconnect replays the last 256KB.
        </p>
        <ul className="font-mono text-[12.5px] text-white/55 space-y-2 pt-1">
          <li className="flex items-start gap-2.5">
            <Check size={13} style={{ color: ORANGE }} className="mt-0.5 shrink-0" />
            Same cookie session as your laptop — same workspace, same in-flight agents
          </li>
          <li className="flex items-start gap-2.5">
            <Check size={13} style={{ color: ORANGE }} className="mt-0.5 shrink-0" />
            Long-press &amp; native paste for multi-line prompts (bracketed paste, no auto-send)
          </li>
          <li className="flex items-start gap-2.5">
            <Check size={13} style={{ color: ORANGE }} className="mt-0.5 shrink-0" />
            iOS &amp; Android Safari / Chrome — no app store, no install, no permissions
          </li>
        </ul>
      </motion.div>

      {/* Phone mockup */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="flex justify-center"
      >
        <div
          className="relative w-[260px] h-[520px] rounded-[42px] p-3"
          style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 30px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          {/* Notch */}
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl"
            style={{ background: "#000", zIndex: 2 }}
          />
          {/* Screen */}
          <div
            className="relative w-full h-full rounded-[32px] overflow-hidden flex flex-col"
            style={{ background: "#000" }}
          >
            {/* Status bar */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[10px] font-mono text-white/70">
              <span>9:41</span>
              <span className="text-white/40">●●●●● 5G</span>
            </div>
            {/* Mini canvas */}
            <div className="flex-1 px-3 pt-1 pb-2 flex flex-col gap-2">
              <div className="text-[8.5px] font-mono text-white/30 px-1 flex items-center gap-1">
                <span style={{ color: ORANGE }}>◐</span>
                <span>opengrid.example.com</span>
              </div>
              {/* 2x2 mini panes */}
              <div className="grid grid-cols-2 gap-1.5 flex-1">
                {AGENTS.slice(0, 4).map((a, i) => (
                  <div
                    key={a.name}
                    className="border bg-[#0a0a0a] p-1.5 flex flex-col gap-0.5 overflow-hidden"
                    style={{
                      borderColor: i === 1 ? `${ORANGE}66` : "rgba(255,255,255,0.06)",
                      boxShadow: i === 1 ? `0 0 10px ${ORANGE}22` : "none",
                    }}
                  >
                    <span className="font-mono text-[8px] font-bold truncate" style={{ color: a.color }}>
                      {a.name}
                    </span>
                    <span className="font-mono text-[7.5px] text-white/40 truncate">
                      {i === 1 ? "(y/N)?" : "thinking…"}
                    </span>
                  </div>
                ))}
              </div>
              {/* Broadcast bar */}
              <div
                className="border px-2 py-1.5 flex items-center gap-1.5"
                style={{ borderColor: `${ORANGE}33`, background: `${ORANGE}08` }}
              >
                <span style={{ color: ORANGE }} className="font-mono text-[8.5px]">›</span>
                <span className="font-mono text-[8.5px] text-white/60 truncate flex-1">refactor auth</span>
                <span className="font-mono text-[7.5px] text-white/30">→ all</span>
              </div>
              {/* Floating key-bar */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {["ESC", "TAB", "^C", "↑", "↓", "↵"].map((k) => (
                  <span
                    key={k}
                    className="flex-1 text-center font-mono text-[8px] text-white/55 border border-white/10 bg-white/[0.03] py-1"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
            {/* Home indicator */}
            <div className="flex justify-center pb-1.5">
              <div className="w-24 h-1 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Pricing / license callout
───────────────────────────────────────── */
function PricingCallout() {
  return (
    <section id="pricing" className="py-24 px-5 sm:px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="border border-white/[0.08] p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-8"
        style={{ background: `linear-gradient(135deg, ${ORANGE}06 0%, transparent 60%)` }}
      >
        <div className="flex flex-col gap-5 min-w-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ border: `1px solid ${ORANGE}33`, color: ORANGE }}
            >
              <Scale size={15} />
            </div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-white/40">Pricing</p>
          </div>
          <h2 className="text-[clamp(2rem,5vw,3.75rem)] font-black font-mono tracking-tighter leading-[1.04]">
            Free. Forever.<br />
            <span style={{ color: ORANGE }}>MIT licensed.</span>
          </h2>
          <p className="text-[15px] text-white/55 leading-relaxed max-w-xl font-sans">
            No paid tier, no usage caps, no hosted SaaS upsell. You pay for the box you run
            it on — a $5 VPS handles one person comfortably — and the API credits you'd
            already be paying your model providers. We never see your prompts, code, or keys.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-mono text-white/50 pt-1">
            <span className="flex items-center gap-1.5">
              <Check size={12} style={{ color: ORANGE }} /> No account
            </span>
            <span className="text-white/15">·</span>
            <span className="flex items-center gap-1.5">
              <Check size={12} style={{ color: ORANGE }} /> No credit card
            </span>
            <span className="text-white/15">·</span>
            <span className="flex items-center gap-1.5">
              <Check size={12} style={{ color: ORANGE }} /> No telemetry
            </span>
            <span className="text-white/15">·</span>
            <span className="flex items-center gap-1.5">
              <Check size={12} style={{ color: ORANGE }} /> No upsell
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 shrink-0 lg:items-end">
          <a
            href={`${REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noreferrer"
            className="h-11 px-5 text-[13px] font-mono font-semibold text-white border border-white/15 hover:border-white/30 flex items-center gap-2 transition-colors"
            data-testid="pricing-license"
          >
            <Scale size={14} />
            Read the license
          </a>
          <a
            href="https://github.com/sponsors/opengrid1"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-mono text-white/40 hover:text-white/70 transition-colors lg:text-right"
            data-testid="pricing-sponsor"
          >
            Like it? Sponsor the project →
          </a>
        </div>
      </motion.div>
    </section>
  );
}
