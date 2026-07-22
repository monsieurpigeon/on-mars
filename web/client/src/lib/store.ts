import { useEffect, useSyncExternalStore } from "react";
import type {
  GameStatePayload,
  LobbyRoomSummary,
  RoomStatePayload,
  ServerMessage,
} from "../protocol";
import { gameSocket } from "../lib/socket";

type AppStore = {
  playerId: string | null;
  nickname: string;
  rooms: LobbyRoomSummary[];
  room: RoomStatePayload | null;
  game: GameStatePayload | null;
  error: string | null;
  lastRtc: { from: string; payload: unknown } | null;
};

let store: AppStore = {
  playerId: null,
  nickname: sessionStorage.getItem("on_mars_nickname") ?? "",
  rooms: [],
  room: null,
  game: null,
  error: null,
  lastRtc: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setStore(patch: Partial<AppStore>) {
  store = { ...store, ...patch };
  emit();
}

function handleMessage(msg: ServerMessage) {
  switch (msg.type) {
    case "welcome":
      setStore({ playerId: msg.player_id });
      break;
    case "lobby_list":
      setStore({
        rooms: msg.rooms,
        ...(store.room ? {} : { room: null, game: null }),
      });
      break;
    case "room_state":
      setStore({ room: msg.room, error: null });
      if (msg.room.phase === "waiting") {
        setStore({ game: null });
      }
      break;
    case "game_state":
      setStore({ game: msg.game });
      break;
    case "error":
      setStore({ error: msg.message });
      break;
    case "rtc_signal":
      setStore({ lastRtc: { from: msg.from, payload: msg.payload } });
      break;
  }
}

let started = false;

export function ensureSocket() {
  if (started) return;
  started = true;
  gameSocket.connect();
  gameSocket.subscribe(handleMessage);
}

export function useGameStore<T>(selector: (s: AppStore) => T): T {
  ensureSocket();
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => selector(store),
    () => selector(store),
  );
}

export function setNickname(nickname: string) {
  sessionStorage.setItem("on_mars_nickname", nickname);
  setStore({ nickname });
  gameSocket.send({ type: "set_nickname", nickname });
}

export function createRoom(name: string) {
  gameSocket.send({ type: "create_room", name });
}

export function joinRoom(roomId: string) {
  gameSocket.send({ type: "join_room", room_id: roomId });
}

export function leaveRoom() {
  gameSocket.send({ type: "leave_room" });
  setStore({ room: null, game: null });
}

export function startGame() {
  gameSocket.send({ type: "start_game" });
}

export function placeMark(index: number) {
  gameSocket.send({ type: "place_mark", index });
}

export function rematch() {
  gameSocket.send({ type: "rematch" });
}

export function backToLobby() {
  gameSocket.send({ type: "back_to_lobby" });
  setStore({ room: null, game: null });
}

export function sendRtcSignal(target: string, payload: unknown) {
  gameSocket.send({ type: "rtc_signal", target, payload });
}

export function clearError() {
  setStore({ error: null });
}

export function clearLastRtc() {
  setStore({ lastRtc: null });
}

export function useSocketLifecycle() {
  useEffect(() => {
    ensureSocket();
  }, []);
}
