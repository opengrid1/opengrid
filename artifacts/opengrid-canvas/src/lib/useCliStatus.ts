import { useEffect, useState } from "react";
import { AgentType } from "./store";

export type CliStatus = Record<AgentType, boolean>;

const DEFAULT: CliStatus = {
  claude: false,
  codex: false,
  gemini: false,
  cursor: false,
  grok: false,
  venice: false,
  shell: true,
  files: true,
};

export function useCliStatus(): { status: CliStatus; loading: boolean } {
  const [status, setStatus] = useState<CliStatus>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/../api/cli-status`;
    // simpler: hit /api/cli-status via shared proxy regardless of artifact base
    fetch("/api/cli-status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : DEFAULT))
      .then((data: CliStatus) => {
        if (!cancelled) {
          setStatus({ ...DEFAULT, ...data });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    void url;
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading };
}
