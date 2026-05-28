import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasState, useSavedLayouts, AgentType, AGENT_PRESETS } from "../lib/store";
import { AgentPanel } from "../components/AgentPanel";
import { Toolbar } from "../components/Toolbar";
import { AddPanelDialog } from "../components/AddPanelDialog";
import { CommandPalette } from "../components/CommandPalette";
import { BroadcastBar } from "../components/BroadcastBar";
import { MobileKeyBar } from "../components/MobileKeyBar";
import { EmptyState } from "../components/EmptyState";
import { AuthGate } from "../components/AuthGate";
import { KeysPanel } from "../components/KeysPanel";
import { ShortcutsOverlay } from "../components/ShortcutsOverlay";
import { BroadcastProvider } from "../lib/broadcast";
import { computeLayout, fitToPanels, LayoutMode } from "../lib/layout";
import { useHealthCheck } from "@workspace/api-client-react";

function HomeInner() {
  const { panels, addPanel, updatePanel, removePanel, clearPanels, replacePanels, applyLayout } = useCanvasState();
  const { layouts: savedLayouts, saveLayout, deleteLayout } = useSavedLayouts();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Live refs mirror scale/offset so touch handlers always read fresh values
  // (avoids stale-snapshot jumps when pinch starts mid-pan).
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useHealthCheck();

  const MIN_SCALE = 0.4;
  const MAX_SCALE = 3;
  const handleZoomIn = useCallback(() => setScale(s => Math.min(s * 1.2, MAX_SCALE)), []);
  const handleZoomOut = useCallback(() => setScale(s => Math.max(s / 1.2, MIN_SCALE)), []);
  const handleZoomReset = useCallback(() => {
    const fit = fitToPanels(panels, { width: window.innerWidth, height: window.innerHeight });
    if (fit) {
      setScale(fit.scale);
      setOffset(fit.offset);
    } else {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [panels]);

  const handleAddNewPanel = useCallback((agent: AgentType, cwd?: string) => {
    // Mobile-aware default size: never wider than the viewport (minus a small
    // margin) so a freshly created pane fits on iPhone without immediate
    // pan/zoom friction.
    const defaultWidth = Math.min(520, Math.max(280, window.innerWidth - 32));
    const defaultHeight = Math.min(420, Math.max(260, window.innerHeight - 120));
    const viewportCenterX = (-offset.x + window.innerWidth / 2) / scale;
    const viewportCenterY = (-offset.y + window.innerHeight / 2) / scale;
    const offsetX = (panels.length % 5) * 40;
    const offsetY = (panels.length % 5) * 40;
    addPanel({
      agent,
      title: AGENT_PRESETS[agent].name,
      x: viewportCenterX - defaultWidth / 2 + offsetX,
      y: viewportCenterY - defaultHeight / 2 + offsetY,
      width: defaultWidth,
      height: defaultHeight,
      isMinimized: false,
      cwd,
    });
  }, [offset, scale, panels.length, addPanel]);

  useEffect(() => {
    document.documentElement.classList.add("dark");

    // One-time cleanup: discard any previously saved invalid cwd (e.g. "Absolute"
    // placeholder text that got accidentally typed in). Only keep absolute paths.
    try {
      const last = localStorage.getItem("opengrid-last-cwd");
      if (last && !/^\/[^\0]*$/.test(last)) {
        localStorage.removeItem("opengrid-last-cwd");
      }
    } catch {
      // ignore
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );

      // Cmd+K / Ctrl+K — palette (always)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }

      // Cmd+N / Ctrl+N — new panel (don't override when typing)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !inField) {
        e.preventDefault();
        setShowAddPanel(true);
        return;
      }

      // Esc — close dialogs
      if (e.key === "Escape") {
        if (showPalette) setShowPalette(false);
        if (showAddPanel) setShowAddPanel(false);
        if (showShortcuts) setShowShortcuts(false);
        return;
      }

      // "?" — shortcuts overlay (don't fire when typing into a field)
      if (e.key === "?" && !inField && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // Space — pan mode (only when not in field)
      if (e.code === "Space" && !inField && target === document.body) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsDragging(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [showPalette, showAddPanel, showShortcuts]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(scale * (1 + delta), MIN_SCALE), MAX_SCALE);
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const targetX = (mouseX - offset.x) / scale;
      const targetY = (mouseY - offset.y) / scale;
      setOffset({
        x: mouseX - targetX * newScale,
        y: mouseY - targetY * newScale,
      });
      setScale(newScale);
    } else {
      setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  // Touch interaction state machine: idle | pan(pointerId) | pinch(idA, idB).
  // Single source of truth keyed by pointerId; transitions on down/up/cancel.
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  type TouchMode =
    | { kind: 'idle' }
    | { kind: 'pan'; pointerId: number; startClientX: number; startClientY: number; startOffsetX: number; startOffsetY: number }
    | { kind: 'pinch'; idA: number; idB: number; startDist: number; startScale: number; startMidX: number; startMidY: number; startOffsetX: number; startOffsetY: number };
  const touchModeRef = useRef<TouchMode>({ kind: 'idle' });
  const EPSILON_DIST = 8; // px — ignore pinch when fingers are essentially co-located

  const startPanFor = (pointerId: number) => {
    const pt = activePointersRef.current.get(pointerId);
    if (!pt) return;
    touchModeRef.current = {
      kind: 'pan',
      pointerId,
      startClientX: pt.x,
      startClientY: pt.y,
      startOffsetX: offsetRef.current.x,
      startOffsetY: offsetRef.current.y,
    };
  };

  const startPinchFor = (idA: number, idB: number) => {
    const a = activePointersRef.current.get(idA);
    const b = activePointersRef.current.get(idB);
    if (!a || !b) return;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist < EPSILON_DIST) return; // bail out of degenerate pinch
    touchModeRef.current = {
      kind: 'pinch',
      idA, idB,
      startDist: dist,
      startScale: scaleRef.current,
      startMidX: (a.x + b.x) / 2,
      startMidY: (a.y + b.y) / 2,
      startOffsetX: offsetRef.current.x,
      startOffsetY: offsetRef.current.y,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const isOnPanel = (e.target as Element).closest('[data-panel]') !== null;
    const isTouch = e.pointerType === 'touch';

    if (isTouch) {
      // Touches that land on a panel belong to Rnd (drag/resize) or the
      // terminal — do NOT capture them into our canvas pointer map, otherwise
      // we steal the gesture and Rnd can never drag the panel.
      if (isOnPanel) return;

      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const count = activePointersRef.current.size;

      if (count >= 2) {
        const ids = Array.from(activePointersRef.current.keys()).slice(0, 2);
        startPinchFor(ids[0], ids[1]);
        setIsDragging(false);
        e.preventDefault();
        return;
      }

      if (count === 1) {
        startPanFor(e.pointerId);
        setIsDragging(true);
        e.preventDefault();
        return;
      }
      return;
    }

    // Mouse / pen
    if (e.button === 1 || isSpacePressed) {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const mode = touchModeRef.current;

    if (mode.kind === 'pinch') {
      e.preventDefault();
      const a = activePointersRef.current.get(mode.idA);
      const b = activePointersRef.current.get(mode.idB);
      if (!a || !b) return;
      const newDist = Math.hypot(b.x - a.x, b.y - a.y);
      if (newDist < EPSILON_DIST) return;
      const ratio = newDist / mode.startDist;
      const newScale = Math.min(Math.max(mode.startScale * ratio, MIN_SCALE), MAX_SCALE);
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const midX = mode.startMidX - rect.left;
      const midY = mode.startMidY - rect.top;
      const targetX = (midX - mode.startOffsetX) / mode.startScale;
      const targetY = (midY - mode.startOffsetY) / mode.startScale;
      setOffset({ x: midX - targetX * newScale, y: midY - targetY * newScale });
      setScale(newScale);
      return;
    }

    if (mode.kind === 'pan') {
      e.preventDefault();
      const pt = activePointersRef.current.get(mode.pointerId);
      if (!pt) return;
      setOffset({
        x: mode.startOffsetX + (pt.x - mode.startClientX),
        y: mode.startOffsetY + (pt.y - mode.startClientY),
      });
      return;
    }

    // Mouse drag (space-held or middle-button)
    if (isDragging && e.pointerType !== 'touch') {
      setOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const releasePointer = (pointerId: number, pointerType: string) => {
    if (pointerType !== 'touch') {
      setIsDragging(false);
      return;
    }
    activePointersRef.current.delete(pointerId);
    const remaining = Array.from(activePointersRef.current.keys());
    const mode = touchModeRef.current;

    if (mode.kind === 'pinch') {
      if (remaining.length >= 1) {
        // Transition pinch → pan anchored on the surviving finger so motion
        // is continuous (no dead finger after lifting one).
        startPanFor(remaining[0]);
        setIsDragging(true);
      } else {
        touchModeRef.current = { kind: 'idle' };
        setIsDragging(false);
      }
      return;
    }

    if (mode.kind === 'pan' && mode.pointerId === pointerId) {
      if (remaining.length >= 1) {
        startPanFor(remaining[0]);
      } else {
        touchModeRef.current = { kind: 'idle' };
        setIsDragging(false);
      }
      return;
    }

    if (remaining.length === 0) {
      touchModeRef.current = { kind: 'idle' };
      setIsDragging(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => releasePointer(e.pointerId, e.pointerType);
  const handlePointerCancel = (e: React.PointerEvent) => releasePointer(e.pointerId, e.pointerType);

  const handleSaveLayout = useCallback(() => {
    if (panels.length === 0) return;
    const name = window.prompt(
      `Save current layout (${panels.length} ${panels.length === 1 ? "pane" : "panes"}) as:`,
      `Layout ${savedLayouts.length + 1}`,
    );
    if (name && name.trim()) saveLayout(name, panels);
  }, [panels, saveLayout, savedLayouts.length]);

  const handleApplyLayout = useCallback(
    (id: string) => {
      const snapshot = savedLayouts.find((l) => l.id === id);
      if (!snapshot) return;
      if (
        panels.length > 0 &&
        !window.confirm(
          `Load "${snapshot.name}"? This replaces your current ${panels.length} ${panels.length === 1 ? "pane" : "panes"} with ${snapshot.panels.length} fresh one${snapshot.panels.length === 1 ? "" : "s"}.`,
        )
      ) {
        return;
      }
      replacePanels(snapshot.panels);
    },
    [panels.length, replacePanels, savedLayouts],
  );

  const handleLayout = (mode: LayoutMode) => {
    if (mode === "free") return;
    const result = computeLayout(mode, panels, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (!result) return;
    applyLayout(result.positions);
    setScale(result.scale);
    setOffset(result.offset);
  };

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-background select-none"
      style={{
        cursor: isDragging ? "grabbing" : isSpacePressed ? "grab" : "default",
      }}
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      data-testid="canvas-container"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: `${40 * scale}px ${40 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      />

      <Toolbar
        onAddPanel={() => setShowAddPanel(true)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onLayout={handleLayout}
        onOpenPalette={() => setShowPalette(true)}
        onOpenKeys={() => setShowKeys(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        panelCount={panels.length}
        savedLayouts={savedLayouts}
        onSaveLayout={handleSaveLayout}
        onApplyLayout={handleApplyLayout}
        onDeleteLayout={deleteLayout}
      />

      {showKeys && <KeysPanel onClose={() => setShowKeys(false)} />}

      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      >
        {panels.map(panel => (
          <AgentPanel
            key={panel.id}
            panel={panel}
            onUpdate={updatePanel}
            onRemove={removePanel}
            canvasScale={scale}
          />
        ))}
      </div>

      {panels.length === 0 && (
        <EmptyState
          onAddPanel={() => setShowAddPanel(true)}
          onOpenPalette={() => setShowPalette(true)}
        />
      )}

      <BroadcastBar />
      <MobileKeyBar />

      <AddPanelDialog
        open={showAddPanel}
        onOpenChange={setShowAddPanel}
        onAdd={handleAddNewPanel}
      />

      <CommandPalette
        open={showPalette}
        onOpenChange={setShowPalette}
        onAddAgent={(agent) => handleAddNewPanel(agent)}
        onLayout={handleLayout}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onClearAll={clearPanels}
      />

      <ShortcutsOverlay open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}

export default function Home() {
  return (
    <AuthGate>
      <BroadcastProvider>
        <HomeInner />
      </BroadcastProvider>
    </AuthGate>
  );
}
