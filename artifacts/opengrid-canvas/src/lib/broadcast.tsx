import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Sender = (text: string) => void;

interface BroadcastApi {
  register: (panelId: string, send: Sender) => () => void;
  selected: Set<string>;
  toggleSelected: (panelId: string) => void;
  clearSelected: () => void;
  broadcast: (text: string) => number; // returns number of recipients
  focusedPanelId: string | null;
  setFocused: (panelId: string | null) => void;
  clearFocusIf: (panelId: string) => void;
  sendToFocused: (text: string) => boolean; // returns true if delivered
}

const Ctx = createContext<BroadcastApi | null>(null);

export function BroadcastProvider({ children }: { children: ReactNode }) {
  const sendersRef = useRef<Map<string, Sender>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedPanelId, setFocusedState] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);

  const setFocused = useCallback((panelId: string | null) => {
    focusedRef.current = panelId;
    setFocusedState(panelId);
  }, []);

  const clearFocusIf = useCallback((panelId: string) => {
    if (focusedRef.current === panelId) {
      focusedRef.current = null;
      setFocusedState(null);
    }
  }, []);

  const register = useCallback((panelId: string, send: Sender) => {
    sendersRef.current.set(panelId, send);
    return () => {
      sendersRef.current.delete(panelId);
      setSelected((prev) => {
        if (!prev.has(panelId)) return prev;
        const next = new Set(prev);
        next.delete(panelId);
        return next;
      });
    };
  }, []);

  const toggleSelected = useCallback((panelId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  }, []);

  const clearSelected = useCallback(() => setSelected(new Set()), []);

  const broadcast = useCallback(
    (text: string): number => {
      let n = 0;
      for (const id of selected) {
        const send = sendersRef.current.get(id);
        if (send) {
          send(text);
          n++;
        }
      }
      return n;
    },
    [selected],
  );

  const sendToFocused = useCallback(
    (text: string): boolean => {
      if (!focusedPanelId) return false;
      const send = sendersRef.current.get(focusedPanelId);
      if (!send) return false;
      send(text);
      return true;
    },
    [focusedPanelId],
  );

  const value = useMemo<BroadcastApi>(
    () => ({
      register,
      selected,
      toggleSelected,
      clearSelected,
      broadcast,
      focusedPanelId,
      setFocused,
      clearFocusIf,
      sendToFocused,
    }),
    [register, selected, toggleSelected, clearSelected, broadcast, focusedPanelId, setFocused, clearFocusIf, sendToFocused],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBroadcast(): BroadcastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBroadcast must be used inside BroadcastProvider");
  return ctx;
}
