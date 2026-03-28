import { useRef, useState, useCallback, useEffect } from "react";
import type { ClientMessage, ServerMessage } from "@git-blame-bet/shared";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export function useWebSocket(onMessage?: (msg: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const reconnectAttempt = useRef(0);
  const onMessageRef = useRef(onMessage);
  const lastAuthMessage = useRef<ClientMessage | null>(null);

  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      const wasReconnect = reconnectAttempt.current > 0;
      reconnectAttempt.current = 0;

      if (wasReconnect && lastAuthMessage.current) {
        ws.send(JSON.stringify(lastAuthMessage.current));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current?.(msg);
      } catch {}
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;

      if (reconnectAttempt.current < 5) {
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 10000);
        reconnectAttempt.current++;
        setTimeout(() => connect(), delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (msg.type === "lobby:create" || msg.type === "lobby:join") {
      lastAuthMessage.current = msg;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    reconnectAttempt.current = 999;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    return () => {
      reconnectAttempt.current = 999;
      wsRef.current?.close();
    };
  }, []);

  return { status, sendMessage, connect, disconnect };
}
