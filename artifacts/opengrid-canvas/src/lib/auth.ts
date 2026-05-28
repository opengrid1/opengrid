import { useEffect, useState } from "react";

// Cookie-based ephemeral sessions. The server sets an HttpOnly cookie on
// POST /api/auth/session — JS never touches the credential. We just track
// "do we have a session yet?" and "which API keys has the user set?".

export interface SessionInfo {
  id: string;
  createdAt: number;
  apiKeysSet: string[];
}

type Listener = (s: SessionInfo | null) => void;
const listeners = new Set<Listener>();
let current: SessionInfo | null = null;

export function getSession(): SessionInfo | null {
  return current;
}

export function setSession(s: SessionInfo | null): void {
  current = s;
  listeners.forEach((l) => l(s));
}

export function useSession(): SessionInfo | null {
  const [s, setS] = useState<SessionInfo | null>(current);
  useEffect(() => {
    const l: Listener = (next) => setS(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}

export async function ensureSession(): Promise<SessionInfo> {
  // Try to fetch the existing session first (cookie present).
  try {
    const r = await fetch("/api/auth/session", { credentials: "include" });
    if (r.ok) {
      const data = (await r.json()) as SessionInfo;
      setSession(data);
      return data;
    }
  } catch {
    /* fall through to create */
  }
  const r = await fetch("/api/auth/session", { method: "POST", credentials: "include" });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `HTTP ${r.status}`);
  }
  const data = (await r.json()) as SessionInfo;
  setSession(data);
  return data;
}

export async function destroySession(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
  } finally {
    setSession(null);
  }
}

export async function refreshSession(): Promise<SessionInfo | null> {
  try {
    const r = await fetch("/api/auth/session", { credentials: "include" });
    if (!r.ok) {
      setSession(null);
      return null;
    }
    const data = (await r.json()) as SessionInfo;
    setSession(data);
    return data;
  } catch {
    setSession(null);
    return null;
  }
}
