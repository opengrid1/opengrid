import type { Request, Response, NextFunction, RequestHandler } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, Bucket>>();

function gc(store: Map<string, Bucket>): void {
  const now = Date.now();
  if (store.size < 1000) return;
  for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
}

function keyFor(req: Request): string {
  // Trust ONLY req.ip — Express applies the `trust proxy` setting from
  // app.ts to derive it. Parsing the raw X-Forwarded-For header here would
  // let attackers spoof identities and rotate around the rate limit.
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export function rateLimit(opts: { name: string; windowMs: number; max: number }): RequestHandler {
  let store = stores.get(opts.name);
  if (!store) {
    store = new Map();
    stores.set(opts.name, store);
  }
  const s = store;
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyFor(req);
    const existing = s.get(key);
    if (!existing || existing.resetAt < now) {
      s.set(key, { count: 1, resetAt: now + opts.windowMs });
      gc(s);
      return next();
    }
    existing.count += 1;
    if (existing.count > opts.max) {
      const retry = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retry));
      res.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
    next();
  };
}
