import { handleOpen, handleClose, handleMessage, type WSData } from "./websocket/handler";
import { getGame } from "./game/state";
import { generateQRDataUrl } from "./utils/qr";
import { join } from "node:path";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:5173";
const STATIC_DIR = join(import.meta.dir, "../../frontend/dist");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getContentType(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

Bun.serve<WSData>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { gameId: "", nickname: "", handshakeTimer: null },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    if (url.pathname.startsWith("/api/game/") && req.method === "GET") {
      const gameId = url.pathname.split("/").pop()!;
      const game = getGame(gameId);
      if (!game) {
        return Response.json({ error: "Game not found" }, { status: 404 });
      }
      return Response.json({
        id: game.id,
        phase: game.phase,
        repoUrl: game.config.repoUrl,
        playerCount: game.players.size,
        players: [...game.players.values()].map((p) => ({
          nickname: p.nickname,
          isAdmin: p.isAdmin,
        })),
      });
    }

    if (url.pathname.startsWith("/api/qr/") && req.method === "GET") {
      const gameId = url.pathname.split("/").pop()!;
      const gameUrl = `${PUBLIC_URL}/play/${gameId}`;
      return generateQRDataUrl(gameUrl).then((dataUrl) =>
        Response.json({ qr: dataUrl, url: gameUrl }),
      );
    }

    const filePath = join(STATIC_DIR, url.pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, {
        headers: { "Content-Type": getContentType(filePath) },
      });
    }

    const indexFile = Bun.file(join(STATIC_DIR, "index.html"));
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open: handleOpen,
    close: handleClose,
    message: handleMessage,
  },
});

console.log(`Git Blame Bet server running on http://localhost:${PORT}`);
