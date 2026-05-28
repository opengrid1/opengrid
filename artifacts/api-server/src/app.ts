import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy hop (deployment platforms put a TLS-terminating proxy
// in front of us). Required for accurate req.ip in rate limiting.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// CSP is only meaningful when this server serves HTML (SERVE_WEB=1). When the
// SPA lives on a separate Vite dev server, the API only ever returns JSON and
// CSP would just produce noise in HMR. The policy is deliberately narrow:
// xterm.js + CodeMirror + Tailwind need 'unsafe-inline' styles (they inject
// inline <style> tags at runtime) but no inline scripts — Vite produces only
// hashed bundles. WebSocket upgrades are same-origin in prod.
const cspDirectives =
  process.env.SERVE_WEB === "1"
    ? {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", "ws:", "wss:"],
        "worker-src": ["'self'", "blob:"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "form-action": ["'self'"],
      }
    : false;

app.use(
  helmet({
    contentSecurityPolicy: cspDirectives ? { useDefaults: true, directives: cspDirectives } : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// CORS — credentials required so the session cookie can ride along. In prod
// we require an explicit allowlist; in dev we reflect the request origin so
// both the API and the SPA on different ports can talk to each other.
const corsOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && corsOrigins.length === 0) {
  throw new Error(
    "ALLOWED_ORIGINS must be set (comma-separated hostnames) when NODE_ENV=production.",
  );
}
app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  }),
);

app.use(cookieParser());

// Body limits aligned with the files API write cap (5MB).
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// Optional: serve the prebuilt SPA from the same process. Enabled in the
// Docker image (SERVE_WEB=1). Off by default in dev because Vite has its own
// dev server. The static dir is resolved from WEB_DIST or a sensible default
// next to this bundle.
if (process.env.SERVE_WEB === "1") {
  const webDist = path.resolve(
    process.env.WEB_DIST ??
      path.join(process.cwd(), "../opengrid-canvas/dist/public"),
  );

  if (!fs.existsSync(webDist)) {
    // Fail loudly at boot rather than silently 404'ing every request.
    throw new Error(
      `SERVE_WEB=1 but WEB_DIST does not exist: ${webDist}. ` +
        `Build the SPA first (pnpm --filter @workspace/opengrid-canvas run build) or set WEB_DIST.`,
    );
  }

  logger.info({ webDist }, "Serving SPA from WEB_DIST");

  // Hashed assets (Vite emits /assets/*.[hash].js) — long cache.
  app.use(
    "/assets",
    express.static(path.join(webDist, "assets"), {
      immutable: true,
      maxAge: "1y",
      index: false,
    }),
  );

  // Everything else from the dist root, but never index.html (so the SPA
  // fallback below can hit cookieParser/logger middleware on first paint).
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));

  // SPA history fallback. Three guards, each closing a real failure mode:
  //   1. Exclude /api and /ws (with or without trailing slash) so an API/WS
  //      404 never leaks index.html and confuses fetch() error handling.
  //   2. Skip paths that look like a file (have an extension) — those should
  //      404 from the static middleware above instead of resolving to HTML,
  //      otherwise a missing /assets/foo.js silently becomes the SPA shell.
  //   3. Only serve HTML to real navigations (Accept must explicitly include
  //      text/html). Bare fetch() / curl / asset probes get a 404 instead.
  app.get(/^\/(?!api(\/|$)|ws(\/|$)).*/, (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    const last = req.path.split("/").pop() ?? "";
    if (last.includes(".")) return next();
    const accept = req.headers.accept ?? "";
    if (!accept.includes("text/html")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}

export default app;
