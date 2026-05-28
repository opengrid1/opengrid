import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ShutdownNotice {
  message: string;
  inSec: number;
  receivedAt: number;
}

export function ShutdownBanner() {
  const [notice, setNotice] = useState<ShutdownNotice | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { inSec: number; message: string } | undefined;
      if (!detail) return;
      setNotice({ message: detail.message, inSec: detail.inSec, receivedAt: Date.now() });
      setRemaining(detail.inSec);
    };
    window.addEventListener('opengrid:shutdown', handler);
    return () => window.removeEventListener('opengrid:shutdown', handler);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - notice.receivedAt) / 1000);
      const left = Math.max(0, notice.inSec - elapsed);
      setRemaining(left);
      // Auto-dismiss 60s after the countdown finishes so a re-deploy that
      // succeeds doesn't leave a stale banner up forever.
      if (left === 0 && elapsed > notice.inSec + 60) {
        setNotice(null);
        window.clearInterval(tick);
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [notice]);

  if (!notice) return null;

  return (
    <div
      role="alert"
      data-testid="banner-shutdown"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 bg-orange-500 text-black text-xs font-mono font-semibold shadow-lg"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <AlertTriangle size={14} className="flex-shrink-0" />
      <span className="truncate">
        {remaining > 0
          ? `${notice.message} (${remaining}s)`
          : `Server restarting now. Your sessions will reconnect when it comes back.`}
      </span>
      <button
        type="button"
        onClick={() => setNotice(null)}
        className="flex-shrink-0 p-1 hover:bg-black/10 rounded"
        aria-label="Dismiss"
        data-testid="button-dismiss-shutdown"
      >
        <X size={12} />
      </button>
    </div>
  );
}
