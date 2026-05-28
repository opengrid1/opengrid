import { Panel } from "./store";

export type LayoutMode = "free" | "columns" | "rows" | "grid" | "focus";

export interface LayoutResult {
  positions: Array<{ id: string; x: number; y: number; width: number; height: number; isMinimized: boolean }>;
  scale: number;
  offset: { x: number; y: number };
}

const GAP = 12;
const TOOLBAR_PAD = 80;
// Match AgentPanel Rnd minWidth/minHeight
const MIN_W = 320;
const MIN_H = 280;
const FOCUS_SIDEBAR_W = 280;

// Mobile: target ~one column with usable size at scale 1
const MOBILE_BREAKPOINT = 700;

export function computeLayout(
  mode: LayoutMode,
  panels: Panel[],
  viewport: { width: number; height: number },
): LayoutResult | null {
  if (mode === "free" || panels.length === 0) return null;

  const isMobile = viewport.width < MOBILE_BREAKPOINT;
  // On mobile, lay out panels at a fixed comfortable width instead of compressing
  // to the screen — we then auto-zoom to fit. This avoids unreadably-tiny tiles.
  const layoutWidth = isMobile ? 720 : Math.max(viewport.width - GAP * 2, MIN_W);
  const layoutHeight = isMobile
    ? Math.max(viewport.height - TOOLBAR_PAD - GAP, MIN_H) * 1.2
    : Math.max(viewport.height - TOOLBAR_PAD - GAP, MIN_H);

  const W = layoutWidth;
  const H = layoutHeight;
  const startX = GAP;
  const startY = TOOLBAR_PAD;
  const n = panels.length;

  const out: LayoutResult["positions"] = [];

  if (mode === "columns") {
    // Compute how many columns fit while respecting MIN_W
    const maxCols = Math.max(1, Math.floor((W + GAP) / (MIN_W + GAP)));
    const cols = Math.min(n, maxCols);
    const w = Math.max(MIN_W, Math.floor((W - GAP * (cols - 1)) / cols));
    panels.forEach((p, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      out.push({
        id: p.id,
        x: startX + c * (w + GAP),
        y: startY + r * (H + GAP),
        width: w,
        height: H,
        isMinimized: false,
      });
    });
  } else if (mode === "rows") {
    const maxRows = Math.max(1, Math.floor((H + GAP) / (MIN_H + GAP)));
    const rows = Math.min(n, maxRows);
    const h = Math.max(MIN_H, Math.floor((H - GAP * (rows - 1)) / rows));
    panels.forEach((p, i) => {
      const r = i % rows;
      const c = Math.floor(i / rows);
      out.push({
        id: p.id,
        x: startX + c * (W + GAP),
        y: startY + r * (h + GAP),
        width: W,
        height: h,
        isMinimized: false,
      });
    });
  } else if (mode === "grid") {
    let cols = Math.ceil(Math.sqrt(n));
    const maxCols = Math.max(1, Math.floor((W + GAP) / (MIN_W + GAP)));
    cols = Math.min(cols, maxCols);
    const rows = Math.ceil(n / cols);
    const maxRows = Math.max(1, Math.floor((H + GAP) / (MIN_H + GAP)));
    const visibleRows = Math.min(rows, maxRows);
    const w = Math.max(MIN_W, Math.floor((W - GAP * (cols - 1)) / cols));
    const h = Math.max(MIN_H, Math.floor((H - GAP * (visibleRows - 1)) / visibleRows));
    panels.forEach((p, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      out.push({
        id: p.id,
        x: startX + c * (w + GAP),
        y: startY + r * (h + GAP),
        width: w,
        height: h,
        isMinimized: false,
      });
    });
  } else if (mode === "focus") {
    if (n === 1) {
      out.push({
        id: panels[0].id,
        x: startX,
        y: startY,
        width: Math.max(MIN_W, W),
        height: Math.max(MIN_H, H),
        isMinimized: false,
      });
    } else {
      // Only use sidebar layout if viewport is wide enough for both main + sidebar
      const canSidebar = W >= MIN_W + GAP + FOCUS_SIDEBAR_W;
      if (canSidebar) {
        const mainW = W - FOCUS_SIDEBAR_W - GAP;
        const sidebarStartX = startX + mainW + GAP;
        out.push({
          id: panels[0].id,
          x: startX,
          y: startY,
          width: mainW,
          height: H,
          isMinimized: false,
        });
        // Side panels minimized to header height to fit many
        panels.slice(1).forEach((p, i) => {
          out.push({
            id: p.id,
            x: sidebarStartX,
            y: startY + i * (42 + GAP),
            width: FOCUS_SIDEBAR_W,
            height: 42,
            isMinimized: true,
          });
        });
      } else {
        // Narrow viewport: minimize others below the main pane
        out.push({
          id: panels[0].id,
          x: startX,
          y: startY,
          width: W,
          height: Math.max(MIN_H, H - (n - 1) * (42 + GAP)),
          isMinimized: false,
        });
        panels.slice(1).forEach((p, i) => {
          out.push({
            id: p.id,
            x: startX,
            y: startY + Math.max(MIN_H, H - (n - 1) * (42 + GAP)) + GAP + i * (42 + GAP),
            width: W,
            height: 42,
            isMinimized: true,
          });
        });
      }
    }
  }

  // Compute bounding box of laid-out panels and a fit-to-viewport scale.
  const minX = Math.min(...out.map((p) => p.x));
  const minY = Math.min(...out.map((p) => p.y));
  const maxX = Math.max(...out.map((p) => p.x + p.width));
  const maxY = Math.max(...out.map((p) => p.y + p.height));
  const contentW = maxX - minX;
  const contentH = maxY - minY;

  const availW = Math.max(viewport.width - GAP * 2, 200);
  const availH = Math.max(viewport.height - TOOLBAR_PAD - GAP, 200);

  // Fit scale: zoom out until the laid-out content fits, but never zoom IN past 1.
  // Clamp lower bound so tiles never become unreadable.
  const rawScale = Math.min(availW / contentW, availH / contentH, 1);
  const scale = Math.max(rawScale, 0.4);

  // Always pin top to TOOLBAR_PAD (no vertical centering — it wastes screen
  // real estate on mobile). Horizontally center when content fits, otherwise pin left.
  const idealOffsetX = (viewport.width - contentW * scale) / 2 - minX * scale;
  const minOffsetX = GAP - minX * scale;
  const offsetX = Math.max(idealOffsetX, minOffsetX);
  const offsetY = TOOLBAR_PAD - minY * scale;

  return {
    positions: out,
    scale,
    offset: { x: offsetX, y: offsetY },
  };
}

// Compute a fit-to-content scale/offset for the *current* panel positions
// (used by the "fit / reset zoom" button so it doesn't reset to a blank canvas).
export function fitToPanels(
  panels: Panel[],
  viewport: { width: number; height: number },
): { scale: number; offset: { x: number; y: number } } | null {
  if (panels.length === 0) return null;

  const minX = Math.min(...panels.map((p) => p.x));
  const minY = Math.min(...panels.map((p) => p.y));
  const maxX = Math.max(...panels.map((p) => p.x + p.width));
  const maxY = Math.max(...panels.map((p) => p.y + (p.isMinimized ? 48 : p.height)));
  const contentW = maxX - minX;
  const contentH = maxY - minY;

  const pad = 24;
  const availW = Math.max(viewport.width - pad * 2, 200);
  const availH = Math.max(viewport.height - TOOLBAR_PAD - pad, 200);

  const rawScale = Math.min(availW / contentW, availH / contentH, 1);
  const scale = Math.max(rawScale, 0.4);

  const idealOffsetX = (viewport.width - contentW * scale) / 2 - minX * scale;
  const minOffsetX = pad - minX * scale;
  const offsetX = Math.max(idealOffsetX, minOffsetX);
  const offsetY = TOOLBAR_PAD - minY * scale;

  return { scale, offset: { x: offsetX, y: offsetY } };
}
