import { useState } from "react";
import { Panel, AGENT_PRESETS, AgentType } from "../lib/store";
import { Rnd } from "react-rnd";
import { SiAnthropic, SiOpenai, SiGooglegemini } from "react-icons/si";
import { X, Minus, GripHorizontal, Terminal as TerminalIcon, MousePointer2, Bell, Radio, FolderTree } from "lucide-react";
import { XaiIcon, VeniceIcon } from "./brand-icons";
import { TerminalTab } from "./TerminalTab";
import { FilesTab } from "./FilesTab";
import { Input } from "@/components/ui/input";
import { useBroadcast } from "../lib/broadcast";

interface AgentPanelProps {
  panel: Panel;
  onUpdate: (id: string, updater: (prev: Panel) => Panel) => void;
  onRemove: (id: string) => void;
  canvasScale?: number;
}

const AGENT_VISUALS: Record<AgentType, { color: string; border: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  claude: { color: '#FF6B35', border: 'rgba(255,107,53,0.6)', Icon: SiAnthropic },
  codex: { color: '#74AA9C', border: 'rgba(116,170,156,0.6)', Icon: SiOpenai },
  gemini: { color: '#4F9EF8', border: 'rgba(79,158,248,0.6)', Icon: SiGooglegemini },
  cursor: { color: '#FFFFFF', border: 'rgba(255,255,255,0.6)', Icon: MousePointer2 },
  grok: { color: '#FFFFFF', border: 'rgba(255,255,255,0.6)', Icon: XaiIcon },
  venice: { color: '#E64545', border: 'rgba(230,69,69,0.6)', Icon: VeniceIcon },
  shell: { color: '#888888', border: 'rgba(255,255,255,0.25)', Icon: TerminalIcon },
  files: { color: '#A78BFA', border: 'rgba(167,139,250,0.6)', Icon: FolderTree },
};

export function AgentPanel({ panel, onUpdate, onRemove, canvasScale = 1 }: AgentPanelProps) {
  const visual = AGENT_VISUALS[panel.agent] ?? AGENT_VISUALS.shell;
  const preset = AGENT_PRESETS[panel.agent] ?? AGENT_PRESETS.shell;
  const [waiting, setWaiting] = useState(false);
  const { selected, toggleSelected } = useBroadcast();
  const isBroadcastSelected = selected.has(panel.id);

  const handleUpdate = (updater: (prev: Panel) => Panel) => onUpdate(panel.id, updater);

  const attentionColor = '#FFB020';
  const broadcastColor = '#FF4500';
  const borderColor = isBroadcastSelected
    ? broadcastColor
    : waiting
    ? attentionColor
    : visual.border;
  const accentColor = waiting ? attentionColor : visual.color;

  return (
    <Rnd
      size={{ width: panel.width, height: panel.isMinimized ? 48 : panel.height }}
      position={{ x: panel.x, y: panel.y }}
      onDragStop={(_, d) => handleUpdate(p => ({ ...p, x: d.x, y: d.y }))}
      onResizeStop={(_, __, ref, ___, position) => {
        handleUpdate(p => ({
          ...p,
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
          ...position,
        }));
      }}
      minWidth={320}
      minHeight={panel.isMinimized ? 48 : 280}
      scale={canvasScale}
      dragHandleClassName="panel-drag-handle"
      cancel="button, input, textarea, select, [role='combobox'], [data-radix-collection-item], [data-no-drag]"
      style={{ zIndex: 10 }}
    >
      <div
        data-panel="true"
        className="flex flex-col h-full overflow-hidden"
        style={{
          background: '#0D0D0D',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: `2px solid ${borderColor}`,
          boxShadow: isBroadcastSelected
            ? `0 0 0 2px ${broadcastColor}, 0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${broadcastColor}55`
            : waiting
            ? `0 0 0 1px ${attentionColor}, 0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${attentionColor}33`
            : '0 8px 32px rgba(0,0,0,0.5)',
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div
          className="panel-drag-handle flex-none flex items-center justify-between pl-1.5 pr-1.5 select-none cursor-move h-12 sm:h-11"
          style={{
            background: '#111',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            touchAction: 'none',
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <GripHorizontal size={18} className="text-white/30 shrink-0 sm:hidden" />
            <GripHorizontal size={12} className="text-white/15 shrink-0 hidden sm:block" />

            <span style={{ color: accentColor, flexShrink: 0, lineHeight: 0 }}>
              <visual.Icon size={14} />
            </span>

            <div
              onPointerDown={e => e.stopPropagation()}
              className="min-w-0 max-w-[120px] sm:max-w-none sm:flex-1"
            >
              <Input
                className="h-7 sm:h-6 px-1 bg-transparent border-transparent text-[13px] font-mono font-semibold text-white/80 hover:border-white/10 focus-visible:ring-0 focus-visible:border-white/20"
                value={panel.title}
                onChange={e => handleUpdate(p => ({ ...p, title: e.target.value }))}
                data-testid={`input-panel-title-${panel.id}`}
              />
            </div>

            {/* Mobile-only spacer that acts as extra drag handle area */}
            <div className="flex-1 h-full sm:hidden" aria-hidden="true" />

            {waiting && (
              <span
                className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider shrink-0 animate-pulse"
                style={{ color: attentionColor }}
                data-testid={`attention-indicator-${panel.id}`}
              >
                <Bell size={10} />
                waiting
              </span>
            )}

            {!waiting && (
              <span
                className="text-[10px] font-mono uppercase tracking-wider shrink-0 hidden sm:inline"
                style={{ color: visual.color, opacity: 0.7 }}
              >
                {preset.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 ml-2" onPointerDown={e => e.stopPropagation()}>
            <button
              onClick={() => toggleSelected(panel.id)}
              className="w-6 h-6 flex items-center justify-center transition-colors"
              style={{
                color: isBroadcastSelected ? broadcastColor : 'rgba(255,255,255,0.25)',
              }}
              title={isBroadcastSelected ? 'Remove from broadcast' : 'Add to broadcast'}
              data-testid={`button-broadcast-toggle-${panel.id}`}
            >
              <Radio size={12} />
            </button>
            <button
              onClick={() => handleUpdate(p => ({ ...p, isMinimized: !p.isMinimized }))}
              className="w-6 h-6 flex items-center justify-center text-white/25 hover:text-white/70 transition-colors"
              data-testid={`button-minimize-panel-${panel.id}`}
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => onRemove(panel.id)}
              className="w-6 h-6 flex items-center justify-center text-white/25 hover:text-red-400 transition-colors"
              data-testid={`button-close-panel-${panel.id}`}
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {!panel.isMinimized && (
          <div className="flex-1 min-h-0">
            {panel.agent === 'files' ? (
              <FilesTab panelId={panel.id} initialPath={panel.cwd} />
            ) : (
              <TerminalTab
                panelId={panel.id}
                agent={panel.agent}
                sessionId={panel.sessionId ?? panel.id}
                cwd={panel.cwd}
                onAttentionChange={setWaiting}
              />
            )}
          </div>
        )}
      </div>
    </Rnd>
  );
}
