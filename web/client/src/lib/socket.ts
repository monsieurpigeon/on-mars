import type { ClientMessage, ServerMessage } from "../protocol";

const PLAYER_KEY = "on_mars_player_id";

export function getStoredPlayerId(): string | null {
  return sessionStorage.getItem(PLAYER_KEY);
}

export function storePlayerId(id: string) {
  sessionStorage.setItem(PLAYER_KEY, id);
}

function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

type Listener = (msg: ServerMessage) => void;

export class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private queue: ClientMessage[] = [];
  private intentionalClose = false;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.intentionalClose = false;
    const ws = new WebSocket(wsUrl());
    this.ws = ws;

    ws.onopen = () => {
      for (const msg of this.queue) {
        ws.send(JSON.stringify(msg));
      }
      this.queue = [];
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMessage;
        if (msg.type === "welcome") {
          storePlayerId(msg.player_id);
        }
        for (const listener of this.listeners) {
          listener(msg);
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.intentionalClose) {
        window.setTimeout(() => this.connect(), 1200);
      }
    };
  }

  disconnect() {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
      this.connect();
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const gameSocket = new GameSocket();
