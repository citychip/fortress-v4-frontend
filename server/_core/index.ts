import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setHydratedAsset, getAllHydratedAssets } from "../assetCache";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ─── Asset hydration endpoints (called by Python scripts post-execution) ─────

  /**
   * POST /api/manage/hydrate-asset
   * Accepts a JSON payload from Python scripts (max_pain.py, whale_flow.py)
   * and writes the GEX/DP/drift values into the in-memory asset cache.
   * The cache is read by the frontend as a fallback when live QuantData fields are blank.
   */
  app.post('/api/manage/hydrate-asset', (req, res) => {
    const { ticker, gex_call_wall, gex_put_wall, dp_floor, net_drift, gamma_flip, timestamp } = req.body ?? {};
    if (!ticker || typeof ticker !== 'string') {
      res.status(400).json({ error: 'Missing required field: ticker' });
      return;
    }
    setHydratedAsset({
      ticker,
      gex_call_wall: gex_call_wall != null ? parseFloat(String(gex_call_wall)) || null : null,
      gex_put_wall:  gex_put_wall  != null ? parseFloat(String(gex_put_wall))  || null : null,
      dp_floor:      dp_floor      != null ? parseFloat(String(dp_floor))      || null : null,
      net_drift:     net_drift     != null ? parseFloat(String(net_drift))     || null : null,
      gamma_flip:    gamma_flip    != null ? parseFloat(String(gamma_flip))    || null : null,
      timestamp:     typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
      received_at:   new Date().toISOString(),
    });
    console.log(`[hydrate-asset] Cache updated for ${ticker.toUpperCase()}`);
    res.json({ success: true, message: `Cache hydrated for ${ticker.toUpperCase()}` });
  });

  /**
   * GET /api/manage/hydrated-assets
   * Returns all currently cached hydrated asset entries.
   * Frontend polls this to overlay cached values when QuantData fields are blank.
   */
  app.get('/api/manage/hydrated-assets', (_req, res) => {
    res.json({ assets: getAllHydratedAssets() });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
