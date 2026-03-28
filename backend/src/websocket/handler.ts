import type { ServerWebSocket } from "bun";
import type { ClientMessage, ServerMessage } from "@git-blame-bet/shared";
import { INITIAL_HANDSHAKE_MS } from "@git-blame-bet/shared";
import { createEngine } from "../game/engine";
import { getGame } from "../game/state";
import { generateQRDataUrl } from "../utils/qr";

const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:5173";

export type WSData = {
  gameId: string;
  nickname: string;
  handshakeTimer: Timer | null;
};

const playerSockets = new Map<string, ServerWebSocket<WSData>>();

function socketKey(gameId: string, nickname: string): string {
  return `${gameId}:${nickname}`;
}

function send(ws: ServerWebSocket<WSData>, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function broadcastToGame(gameId: string, msg: ServerMessage): void {
  const game = getGame(gameId);
  if (!game) return;

  const data = JSON.stringify(msg);
  for (const nickname of game.players.keys()) {
    const ws = playerSockets.get(socketKey(gameId, nickname));
    if (ws?.readyState === 1) {
      ws.send(data);
    }
  }
}

function sendToPlayerSocket(
  gameId: string,
  nickname: string,
  msg: ServerMessage,
): void {
  const ws = playerSockets.get(socketKey(gameId, nickname));
  if (ws?.readyState === 1) {
    send(ws, msg);
  }
}

const engine = createEngine({
  broadcast: broadcastToGame,
  sendToPlayer: sendToPlayerSocket,
});

export function handleOpen(ws: ServerWebSocket<WSData>): void {
  const timer = setTimeout(() => {
    if (!ws.data.gameId) ws.close(4000, "No identity within 10s");
  }, INITIAL_HANDSHAKE_MS);
  ws.data.handshakeTimer = timer;
}

export function handleClose(ws: ServerWebSocket<WSData>): void {
  if (ws.data.handshakeTimer) clearTimeout(ws.data.handshakeTimer);
  const { gameId, nickname } = ws.data;
  if (gameId && nickname) {
    playerSockets.delete(socketKey(gameId, nickname));
    engine.handleLeaveGame(gameId, nickname);
  }
}

export async function handleMessage(
  ws: ServerWebSocket<WSData>,
  raw: string | Buffer,
): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    send(ws, {
      type: "error",
      payload: { code: "INVALID_MESSAGE", message: "Invalid JSON" },
    });
    return;
  }

  switch (msg.type) {
    case "lobby:create": {
      const { repoUrl, nickname } = msg.payload;
      try {
        const gameId = engine.handleCreateGame(repoUrl, nickname);
        ws.data.gameId = gameId;
        ws.data.nickname = nickname;
        if (ws.data.handshakeTimer) clearTimeout(ws.data.handshakeTimer);
        playerSockets.set(socketKey(gameId, nickname), ws);

        const gameUrl = `${PUBLIC_URL}/play/${gameId}`;
        const qrDataUrl = await generateQRDataUrl(gameUrl);

        send(ws, {
          type: "lobby:created",
          payload: { gameId, gameUrl, qrDataUrl },
        });

        const game = getGame(gameId)!;
        send(ws, {
          type: "lobby:state",
          payload: {
            players: [...game.players.values()],
            repoUrl,
          },
        });
      } catch (err) {
        send(ws, {
          type: "error",
          payload: {
            code: "CREATE_FAILED",
            message:
              err instanceof Error ? err.message : "Failed to create game",
          },
        });
      }
      break;
    }

    case "lobby:join": {
      const { gameId, nickname } = msg.payload;
      ws.data.gameId = gameId;
      ws.data.nickname = nickname;
      if (ws.data.handshakeTimer) clearTimeout(ws.data.handshakeTimer);
      playerSockets.set(socketKey(gameId, nickname), ws);

      const result = engine.handleJoinGame(gameId, nickname);
      if (!result.ok) {
        playerSockets.delete(socketKey(gameId, nickname));
        send(ws, {
          type: "error",
          payload: { code: "JOIN_FAILED", message: result.error },
        });
      }
      break;
    }

    case "game:start": {
      const { gameId } = ws.data;
      if (!gameId) return;

      const game = getGame(gameId);
      if (!game) return;

      const player = game.players.get(ws.data.nickname);
      if (!player?.isAdmin) {
        send(ws, {
          type: "error",
          payload: { code: "UNAUTHORIZED", message: "Only admin can start" },
        });
        return;
      }

      if (game.phase === "lobby") {
        await engine.handleStartLoading(gameId);
      } else if (game.phase === "ready") {
        engine.handleStartGame(gameId);
      }
      break;
    }

    case "round:answer": {
      const { gameId, nickname } = ws.data;
      if (!gameId || !nickname) return;
      engine.handleSubmitAnswer(gameId, nickname, msg.payload.contributorLogin);
      break;
    }
  }
}
