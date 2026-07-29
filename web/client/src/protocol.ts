export type RoomPhase = "waiting" | "playing" | "finished";
export type GameKind = "on_mars";

export type LobbyRoomSummary = {
  id: string;
  name: string;
  host_nickname: string;
  player_count: number;
  max_players: number;
  game_kind: GameKind;
};

export type PlayerPayload = {
  id: string;
  nickname: string;
  is_host: boolean;
  color: string | null;
};

export type RoomStatePayload = {
  id: string;
  name: string;
  phase: RoomPhase;
  host_id: string;
  players: PlayerPayload[];
  max_players: number;
  game_kind: GameKind;
};

export type OnMarsStubPlayer = {
  id: string;
  nickname: string;
  color: string;
};

/** Stub WS jusqu’au branchement de la session de test. */
export type OnMarsGameState = {
  kind: "on_mars";
  state: {
    players: OnMarsStubPlayer[];
    stub: boolean;
  };
};

export type GameStatePayload = OnMarsGameState;

export type ClientMessage =
  | { type: "set_nickname"; nickname: string }
  | { type: "create_room"; name: string; game_kind: GameKind; max_players: number }
  | { type: "join_room"; room_id: string }
  | { type: "leave_room" }
  | { type: "start_game" }
  | { type: "rematch" }
  | { type: "back_to_lobby" }
  | { type: "reconnect"; player_id: string }
  | { type: "rtc_signal"; target: string; payload: unknown };

export type ServerMessage =
  | { type: "welcome"; player_id: string }
  | { type: "lobby_list"; rooms: LobbyRoomSummary[] }
  | { type: "room_state"; room: RoomStatePayload }
  | { type: "game_state"; game: GameStatePayload }
  | { type: "error"; code: string; message: string }
  | { type: "rtc_signal"; from: string; payload: unknown };
