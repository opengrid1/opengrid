import { Button } from "@/components/ui/button";
import { Plus, ZoomIn, ZoomOut, Maximize, Columns3, Rows3, Grid3x3, Focus, Hand, Command as CommandIcon, Wifi, LogOut, Key, Keyboard, Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { LayoutMode } from "../lib/layout";
import { destroySession } from "../lib/auth";
import { LayoutSnapshot } from "../lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ToolbarProps {
  onAddPanel: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onLayout: (mode: LayoutMode) => void;
  onOpenPalette: () => void;
  onOpenKeys: () => void;
  onOpenShortcuts: () => void;
  panelCount: number;
  savedLayouts: LayoutSnapshot[];
  onSaveLayout: () => void;
  onApplyLayout: (id: string) => void;
  onDeleteLayout: (id: string) => void;
}

const LAYOUTS: { id: LayoutMode; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "free", label: "Free", Icon: Hand },
  { id: "columns", label: "Columns", Icon: Columns3 },
  { id: "rows", label: "Rows", Icon: Rows3 },
  { id: "grid", label: "Grid", Icon: Grid3x3 },
  { id: "focus", label: "Focus", Icon: Focus },
];

export function Toolbar({
  onAddPanel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onLayout,
  onOpenPalette,
  onOpenKeys,
  onOpenShortcuts,
  panelCount,
  savedLayouts,
  onSaveLayout,
  onApplyLayout,
  onDeleteLayout,
}: ToolbarProps) {
  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 sm:gap-2 p-1 sm:p-2 bg-card border border-border rounded-lg shadow-xl max-w-[calc(100vw-1.5rem)] overflow-x-auto"
      style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))' }}
    >
      <Button
        variant="default"
        size="sm"
        onClick={onAddPanel}
        className="gap-1.5 font-mono text-xs px-2 sm:px-3 shrink-0"
        data-testid="button-toolbar-add"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Add Agent</span>
      </Button>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 font-mono text-xs px-2 sm:px-3 shrink-0 text-muted-foreground hover:text-foreground"
            data-testid="button-toolbar-layout"
          >
            <Grid3x3 className="h-4 w-4" />
            <span className="hidden sm:inline">Layout</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="font-mono text-xs">
          {LAYOUTS.map(({ id, label, Icon }) => (
            <DropdownMenuItem
              key={id}
              onClick={() => onLayout(id)}
              data-testid={`layout-${id}`}
            >
              <Icon className="mr-2 h-3.5 w-3.5" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 font-mono text-xs px-2 sm:px-3 shrink-0 text-muted-foreground hover:text-foreground"
            title="Saved layouts"
            data-testid="button-toolbar-presets"
          >
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Presets</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="font-mono text-xs min-w-[220px]">
          <DropdownMenuItem
            onClick={onSaveLayout}
            disabled={panelCount === 0}
            data-testid="preset-save-current"
          >
            <BookmarkPlus className="mr-2 h-3.5 w-3.5" />
            Save current as…
          </DropdownMenuItem>
          {savedLayouts.length > 0 && <DropdownMenuSeparator />}
          {savedLayouts.length > 0 && (
            <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground/60 font-normal tracking-wider">
              Saved
            </DropdownMenuLabel>
          )}
          {savedLayouts.map((layout) => (
            <DropdownMenuItem
              key={layout.id}
              onClick={() => onApplyLayout(layout.id)}
              data-testid={`preset-apply-${layout.id}`}
              className="flex items-center gap-2 group"
            >
              <Bookmark className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{layout.name}</span>
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                {layout.panels.length}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDeleteLayout(layout.id);
                }}
                className="w-5 h-5 -mr-1 flex items-center justify-center text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete preset"
                data-testid={`preset-delete-${layout.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <div className="flex items-center shrink-0">
        <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom Out" className="h-8 w-8 text-muted-foreground hover:text-foreground" data-testid="button-zoom-out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onZoomReset} title="Reset Zoom" className="h-8 w-8 text-muted-foreground hover:text-foreground" data-testid="button-zoom-reset">
          <Maximize className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom In" className="h-8 w-8 text-muted-foreground hover:text-foreground" data-testid="button-zoom-in">
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="icon"
        onClick={() => window.dispatchEvent(new CustomEvent("opengrid:reconnect-all"))}
        title="Reconnect all disconnected panes"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        data-testid="button-toolbar-reconnect-all"
      >
        <Wifi className="h-4 w-4" />
      </Button>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenPalette}
        className="h-8 w-8 shrink-0 sm:hidden text-muted-foreground hover:text-foreground"
        title="Command Palette"
        data-testid="button-toolbar-palette-mobile"
      >
        <CommandIcon className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenPalette}
        className="hidden sm:flex gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        title="Command Palette (⌘K)"
        data-testid="button-toolbar-palette"
      >
        <CommandIcon className="h-3.5 w-3.5" />
        <kbd className="text-[9px] px-1 py-0.5 bg-muted rounded">⌘K</kbd>
      </Button>

      <div className="hidden sm:flex items-center gap-3 px-2">
        <span className="text-xs font-mono text-muted-foreground">
          {panelCount} {panelCount === 1 ? "PANE" : "PANES"}
        </span>
      </div>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenShortcuts}
        title="Keyboard shortcuts (?)"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        data-testid="button-toolbar-shortcuts"
      >
        <Keyboard className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenKeys}
        title="API keys"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        data-testid="button-toolbar-keys"
      >
        <Key className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (window.confirm("End session? This wipes your workspace files and API keys on the server. Your panel layout stays saved locally.")) {
            void destroySession().then(() => window.location.reload());
          }
        }}
        title="Sign out"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        data-testid="button-toolbar-logout"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
