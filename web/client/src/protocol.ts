export type Mark = "x" | "o";
export type Cell = "empty" | "x" | "o";
export type Winner = "x" | "o" | "draw";
export type RoomPhase = "waiting" | "playing" | "finished";
export type GameKind = "tic_tac_toe" | "on_mars";

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
  mark: Mark | null;
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

export type TicTacToeState = {
  kind: "tic_tac_toe";
  board: Cell[];
  turn: Mark;
  winner: Winner | null;
  x_player_id: string;
  o_player_id: string;
};

export type OnMarsAction = {
  type: string;
  [key: string]: unknown;
};

export type OnMarsState = {
  player_count: number;
  phase: string;
  turn_step: string;
  round: number;
  colony_level: number;
  remaining_missions: number;
  shuttle_side: string;
  shuttle_steps_to_travel: number;
  active_player: string | null;
  warehouse: { crystals: number; resources: number[] };
  tech_grid: Array<{
    tech: { id: string; tech_type: string; level: number } | null;
    row: number;
    cost_battery: number;
    cost_any: number;
  }>;
  blueprint_display: Array<{
    id: string;
    level: number;
    building_type: string;
    op: number;
  }>;
  hexes: Array<{
    id: number;
    q: number;
    r: number;
    building: {
      building_type: string;
      owner: string | null;
      upgraded: boolean;
    } | null;
    bot: string | null;
    rover: string | null;
  }>;
  missions: Array<{
    id: string;
    title: string;
    tracker: number;
    goal: number;
    crystals_per_contrib: number;
  }>;
  scientists: Array<{
    id: string;
    name: string;
    hired_by: string | null;
    cost_crystals: number;
  }>;
  players: Array<{
    id: string;
    nickname: string;
    color: string;
    side: string;
    op: number;
    storage: number[];
    crystals_depot: number;
    crystals_pending: number;
    depot_capacity: number;
    ships_in_depot: number;
    ships_in_hangar: number;
    colonists_living: number;
    colonists_living_cap: number;
    colonists_working: number;
    shelter_count: number;
    lab: Array<{ id: string; tech_type: string; level: number }>;
    blueprints: Array<{ id: string; building_type: string; level: number; marker_owner: string | null }>;
    private_goals: Array<{ id: string; title: string; op: number; completed: boolean }>;
    contracts: Array<{ id: string; label: string; complete_op: number; incomplete_op: number }>;
    scientist_ids: string[];
    main_used: boolean;
    executive_used: boolean;
    bots_available: number;
    progress_cubes: number[];
  }>;
  winner_ids: string[];
  legal_actions: OnMarsAction[];
  log: string[];
};

export type OnMarsGameState = {
  kind: "on_mars";
  state: OnMarsState;
};

export type GameStatePayload = TicTacToeState | OnMarsGameState;

export type ClientMessage =
  | { type: "set_nickname"; nickname: string }
  | { type: "create_room"; name: string; game_kind: GameKind; max_players: number }
  | { type: "join_room"; room_id: string }
  | { type: "leave_room" }
  | { type: "start_game" }
  | { type: "place_mark"; index: number }
  | { type: "on_mars_action"; action: OnMarsAction }
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
