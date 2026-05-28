import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { AgentType, AGENT_PRESETS } from "../lib/store";
import { LayoutMode } from "../lib/layout";
import { useCliStatus } from "../lib/useCliStatus";
import { SiAnthropic, SiOpenai, SiGooglegemini } from "react-icons/si";
import { Terminal as TerminalIcon, MousePointer2, Columns3, Rows3, Grid3x3, Focus, Hand, ZoomIn, ZoomOut, Maximize, Trash2, AlertCircle, FolderTree } from "lucide-react";
import { XaiIcon, VeniceIcon } from "./brand-icons";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAgent: (agent: AgentType) => void;
  onLayout: (mode: LayoutMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearAll: () => void;
}

const AGENT_ICONS: Record<AgentType, React.ComponentType<{ size?: number; className?: string }>> = {
  claude: SiAnthropic,
  codex: SiOpenai,
  gemini: SiGooglegemini,
  cursor: MousePointer2,
  grok: XaiIcon,
  venice: VeniceIcon,
  shell: TerminalIcon,
  files: FolderTree,
};

const LAYOUTS: { id: LayoutMode; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "free", label: "Free (manual)", Icon: Hand },
  { id: "columns", label: "Columns", Icon: Columns3 },
  { id: "rows", label: "Rows", Icon: Rows3 },
  { id: "grid", label: "Grid", Icon: Grid3x3 },
  { id: "focus", label: "Focus", Icon: Focus },
];

export function CommandPalette({
  open,
  onOpenChange,
  onAddAgent,
  onLayout,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClearAll,
}: CommandPaletteProps) {
  const { status } = useCliStatus();
  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="New Agent">
          {(Object.keys(AGENT_PRESETS) as AgentType[]).map((id) => {
            const preset = AGENT_PRESETS[id];
            const Icon = AGENT_ICONS[id];
            const available = status[id];
            return (
              <CommandItem
                key={id}
                value={`new ${preset.name} ${preset.description}${available ? '' : ' not installed'}`}
                onSelect={() => available && run(() => onAddAgent(id))}
                disabled={!available}
                data-testid={`command-add-${id}`}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>Launch {preset.name}</span>
                {!available && (
                  <span className="ml-2 flex items-center gap-1 text-[10px] text-amber-500">
                    <AlertCircle size={10} /> not installed
                  </span>
                )}
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  {preset.command || "$SHELL"}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Layout">
          {LAYOUTS.map(({ id, label, Icon }) => (
            <CommandItem
              key={id}
              value={`layout arrange ${label}`}
              onSelect={() => run(() => onLayout(id))}
              data-testid={`command-layout-${id}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>Arrange as {label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View">
          <CommandItem value="zoom in" onSelect={() => run(onZoomIn)} data-testid="command-zoom-in">
            <ZoomIn className="mr-2 h-4 w-4" />
            <span>Zoom In</span>
          </CommandItem>
          <CommandItem value="zoom out" onSelect={() => run(onZoomOut)} data-testid="command-zoom-out">
            <ZoomOut className="mr-2 h-4 w-4" />
            <span>Zoom Out</span>
          </CommandItem>
          <CommandItem value="reset zoom fit" onSelect={() => run(onZoomReset)} data-testid="command-zoom-reset">
            <Maximize className="mr-2 h-4 w-4" />
            <span>Reset Zoom</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Danger">
          <CommandItem
            value="clear close all panes"
            onSelect={() => run(onClearAll)}
            className="text-red-400"
            data-testid="command-clear-all"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Close All Panes</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
