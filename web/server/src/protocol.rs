use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::game::{Cell, Mark, Winner};
use crate::state::RoomPhase;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    SetNickname { nickname: String },
    CreateRoom { name: String },
    JoinRoom { room_id: Uuid },
    LeaveRoom,
    StartGame,
    PlaceMark { index: u8 },
    Rematch,
    BackToLobby,
    Reconnect { player_id: Uuid },
    RtcSignal { target: Uuid, payload: serde_json::Value },
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerPayload {
    pub id: Uuid,
    pub nickname: String,
    pub mark: Option<Mark>,
    pub is_host: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStatePayload {
    pub id: Uuid,
    pub name: String,
    pub phase: RoomPhase,
    pub host_id: Uuid,
    pub players: Vec<PlayerPayload>,
    pub max_players: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameStatePayload {
    pub board: [Cell; 9],
    pub turn: Mark,
    pub winner: Option<Winner>,
    pub x_player_id: Uuid,
    pub o_player_id: Uuid,
}
