import { useEffect, useSyncExternalStore } from "react";
import type {
  GameKind,
  GameStatePayload,
  LobbyRoomSummary,
  OnMarsAction,
  RoomStatePayload,
  ServerMessage,
} from "../protocol";
import { gameSocket } from "./socket";

type AppStore = {
  playerId: string | null;
  nickname: string;
  rooms: LobbyRoomSummary[];
  room: RoomStatePayload | null;
  game: GameStatePayload | null;
  error: string | null;
  lastRtc: { from: string; payload: unknown } | null;
  /** When true, actions stay local (no WebSocket). */
  devMode: boolean;
};

let store: AppStore = {
  playerId: null,
  nickname: sessionStorage.getItem("on_mars_nickname") ?? "",
  rooms: [],
  room: null,
  game: null,
  error: null,
  lastRtc: null,
  devMode: false,
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
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => selector(store),
    () => selector(store),
  );
}

/** Inject fixture state for /test screen development (no lobby / WS). */
export function hydrateDevState(patch: {
  playerId: string;
  nickname?: string;
  room: RoomStatePayload | null;
  game: GameStatePayload | null;
}) {
  setStore({
    playerId: patch.playerId,
    nickname: patch.nickname ?? (store.nickname || "Dev"),
    room: patch.room,
    game: patch.game,
    error: null,
    rooms: [],
    lastRtc: null,
    devMode: true,
  });
}

export function setNickname(nickname: string) {
  sessionStorage.setItem("on_mars_nickname", nickname);
  setStore({ nickname });
  if (!store.devMode) {
    gameSocket.send({ type: "set_nickname", nickname });
  }
}

export function createRoom(name: string, gameKind: GameKind = "on_mars", maxPlayers = 2) {
  if (store.devMode) return;
  gameSocket.send({
    type: "create_room",
    name,
    game_kind: gameKind,
    max_players: maxPlayers,
  });
}

export function joinRoom(roomId: string) {
  if (store.devMode) return;
  gameSocket.send({ type: "join_room", room_id: roomId });
}

export function leaveRoom() {
  if (store.devMode) {
    setStore({ room: null, game: null, error: null });
    return;
  }
  gameSocket.send({ type: "leave_room" });
  setStore({ room: null, game: null });
}

export function startGame() {
  if (store.devMode) return;
  gameSocket.send({ type: "start_game" });
}

export function placeMark(index: number) {
  if (store.devMode) {
    const game = store.game;
    if (!game || game.kind !== "tic_tac_toe" || game.winner) return;
    if (game.board[index] !== "empty") return;
    const board = [...game.board];
    board[index] = game.turn;
    const nextTurn = game.turn === "x" ? "o" : "x";
    setStore({
      game: { ...game, board: board as typeof game.board, turn: nextTurn },
    });
    return;
  }
  gameSocket.send({ type: "place_mark", index });
}

export function sendOnMarsAction(action: OnMarsAction) {
  if (store.devMode) {
    const game = store.game;
    if (!game || game.kind !== "on_mars") return;
    const log = [...game.state.log, `[dev] ${action.type}`].slice(-12);
    setStore({
      game: {
        kind: "on_mars",
        state: { ...game.state, log },
      },
      error: null,
    });
    return;
  }
  gameSocket.send({ type: "on_mars_action", action });
}

export function rematch() {
  if (store.devMode) return;
  gameSocket.send({ type: "rematch" });
}

export function backToLobby() {
  if (store.devMode) {
    setStore({ room: null, game: null, error: null });
    return;
  }
  gameSocket.send({ type: "back_to_lobby" });
  setStore({ room: null, game: null });
}

export function sendRtcSignal(target: string, payload: unknown) {
  if (store.devMode) return;
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
