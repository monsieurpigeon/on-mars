export type Mark = "x" | "o";
export type Cell = "empty" | "x" | "o";
export type Winner = "x" | "o" | "draw";
export type RoomPhase = "waiting" | "playing" | "finished";

export type LobbyRoomSummary = {
  id: string;
  name: string;
  host_nickname: string;
  player_count: number;
  max_players: number;
};

export type PlayerPayload = {
  id: string;
  nickname: string;
  mark: Mark | null;
  is_host: boolean;
};

export type RoomStatePayload = {
  id: string;
  name: string;
  phase: RoomPhase;
  host_id: string;
  players: PlayerPayload[];
  max_players: number;
};

export type GameStatePayload = {
  board: Cell[];
  turn: Mark;
  winner: Winner | null;
  x_player_id: string;
  o_player_id: string;
};

export type ClientMessage =
  | { type: "set_nickname"; nickname: string }
  | { type: "create_room"; name: string }
  | { type: "join_room"; room_id: string }
  | { type: "leave_room" }
  | { type: "start_game" }
  | { type: "place_mark"; index: number }
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
