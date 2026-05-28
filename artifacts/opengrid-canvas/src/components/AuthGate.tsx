import { useEffect, useState } from "react";
import { ensureSession, useSession } from "../lib/auth";
import { Loader2 } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

type Phase = "starting" | "ok" | "failed";

export function AuthGate({ children }: AuthGateProps) {
  useSession(); // re-render on session change
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("starting");
    ensureSession()
      .then(() => {
        if (!cancelled) setPhase("ok");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setPhase("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "ok") return <>{children}</>;

  if (phase === "starting") {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white/50 gap-3 font-mono text-xs">
        <Loader2 className="animate-spin" size={20} />
        Spinning up your workspace…
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black p-6">
      <div
        className="w-full max-w-sm flex flex-col gap-3 p-6 rounded-lg border border-red-500/30 bg-zinc-950 font-mono text-sm"
        data-testid="auth-gate-error"
      >
        <div className="text-red-400 font-semibold">Couldn't start a session.</div>
        <div className="text-white/50 text-xs leading-relaxed">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="h-9 mt-2 rounded bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
