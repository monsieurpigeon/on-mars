use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::game::on_mars::{OnMarsAction, OnMarsState};
use crate::game::{Cell, GameKind, Mark, Winner};
use crate::state::RoomPhase;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    SetNickname { nickname: String },
    CreateRoom {
        name: String,
        #[serde(default = "default_ttt")]
        game_kind: GameKind,
        #[serde(default = "default_max")]
        max_players: usize,
    },
    JoinRoom { room_id: Uuid },
    LeaveRoom,
    StartGame,
    PlaceMark { index: u8 },
    OnMarsAction { action: OnMarsAction },
    Rematch,
    BackToLobby,
    Reconnect { player_id: Uuid },
    RtcSignal { target: Uuid, payload: serde_json::Value },
}

fn default_ttt() -> GameKind {
    GameKind::TicTacToe
}
fn default_max() -> usize {
    2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Welcome {
        player_id: Uuid,
    },
    LobbyList {
        rooms: Vec<LobbyRoomSummary>,
    },
    RoomState {
        room: RoomStatePayload,
    },
    GameState {
        game: GameStatePayload,
    },
    Error {
        code: String,
        message: String,
    },
    RtcSignal {
        from: Uuid,
        payload: serde_json::Value,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LobbyRoomSummary {
    pub id: Uuid,
    pub name: String,
    pub host_nickname: String,
    pub player_count: usize,
    pub max_players: usize,
    pub game_kind: GameKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerPayload {
    pub id: Uuid,
    pub nickname: String,
    pub mark: Option<Mark>,
    pub is_host: bool,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStatePayload {
    pub id: Uuid,
    pub name: String,
    pub phase: RoomPhase,
    pub host_id: Uuid,
    pub players: Vec<PlayerPayload>,
    pub max_players: usize,
    pub game_kind: GameKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GameStatePayload {
    TicTacToe {
        board: [Cell; 9],
        turn: Mark,
        winner: Option<Winner>,
        x_player_id: Uuid,
        o_player_id: Uuid,
    },
    OnMars {
        state: OnMarsState,
    },
}
