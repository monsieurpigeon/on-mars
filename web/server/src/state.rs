use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::ws::Message;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::game::{GameKind, GameSession};
use crate::protocol::{
    GameStatePayload, LobbyRoomSummary, PlayerPayload, RoomStatePayload, ServerMessage,
};

pub type Tx = mpsc::UnboundedSender<Message>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoomPhase {
    Waiting,
    Playing,
    Finished,
}

#[derive(Debug, Clone)]
pub struct Player {
    pub id: Uuid,
    pub nickname: String,
    pub tx: Option<Tx>,
}

#[derive(Debug)]
pub struct Room {
    pub id: Uuid,
    pub name: String,
    pub host_id: Uuid,
    pub players: Vec<Player>,
    pub phase: RoomPhase,
    pub max_players: usize,
    pub game_kind: GameKind,
    pub game: Option<GameSession>,
}

impl Room {
    pub fn summary(&self) -> LobbyRoomSummary {
        let host_nickname = self
            .players
            .iter()
            .find(|p| p.id == self.host_id)
            .map(|p| p.nickname.clone())
            .unwrap_or_else(|| "Inconnu".into());

        LobbyRoomSummary {
            id: self.id,
            name: self.name.clone(),
            host_nickname,
            player_count: self.players.len(),
            max_players: self.max_players,
            game_kind: self.game_kind,
        }
    }

    pub fn is_public(&self) -> bool {
        self.phase == RoomPhase::Waiting && self.players.len() < self.max_players
    }

    pub fn state_payload(&self) -> RoomStatePayload {
        let colors: HashMap<Uuid, String> = match &self.game {
            Some(GameSession::OnMars(om)) => om
                .players
                .iter()
                .map(|p| (p.id, format!("{:?}", p.color).to_lowercase()))
                .collect(),
            None => HashMap::new(),
        };

        RoomStatePayload {
            id: self.id,
            name: self.name.clone(),
            phase: self.phase,
            host_id: self.host_id,
            max_players: self.max_players,
            game_kind: self.game_kind,
            players: self
                .players
                .iter()
                .map(|p| PlayerPayload {
                    id: p.id,
                    nickname: p.nickname.clone(),
                    is_host: p.id == self.host_id,
                    color: colors.get(&p.id).cloned(),
                })
                .collect(),
        }
    }

    pub fn game_payload(&self) -> Option<GameStatePayload> {
        match &self.game {
            Some(GameSession::OnMars(om)) => Some(GameStatePayload::OnMars {
                state: om.clone(),
            }),
            None => None,
        }
    }

    pub fn broadcast(&self, msg: &ServerMessage) {
        if let Ok(text) = serde_json::to_string(msg) {
            for player in &self.players {
                if let Some(tx) = &player.tx {
                    let _ = tx.send(Message::Text(text.clone().into()));
                }
            }
        }
    }

    pub fn send_to(&self, player_id: Uuid, msg: &ServerMessage) {
        if let Ok(text) = serde_json::to_string(msg) {
            if let Some(player) = self.players.iter().find(|p| p.id == player_id) {
                if let Some(tx) = &player.tx {
                    let _ = tx.send(Message::Text(text.into()));
                }
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct ConnectionMeta {
    pub nickname: String,
    pub room_id: Option<Uuid>,
}

#[derive(Default)]
pub struct AppInner {
    pub rooms: HashMap<Uuid, Room>,
    pub connections: HashMap<Uuid, Tx>,
    pub metas: HashMap<Uuid, ConnectionMeta>,
}

#[derive(Clone)]
pub struct AppState {
    pub inner: Arc<Mutex<AppInner>>,
    pub test_session: Arc<Mutex<crate::on_mars::TestSession>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(AppInner::default())),
            test_session: Arc::new(Mutex::new(crate::on_mars::load_from_disk())),
        }
    }
}

impl AppState {
    pub fn send_raw(tx: &Tx, msg: &ServerMessage) {
        if let Ok(text) = serde_json::to_string(msg) {
            let _ = tx.send(Message::Text(text.into()));
        }
    }

    pub fn lobby_list_locked(inner: &AppInner) -> ServerMessage {
        let mut rooms: Vec<_> = inner
            .rooms
            .values()
            .filter(|r| r.is_public())
            .map(|r| r.summary())
            .collect();
        rooms.sort_by(|a, b| a.name.cmp(&b.name));
        ServerMessage::LobbyList { rooms }
    }

    pub fn broadcast_lobby(&self) {
        let inner = self.inner.lock();
        let msg = Self::lobby_list_locked(&inner);
        let text = match serde_json::to_string(&msg) {
            Ok(t) => t,
            Err(_) => return,
        };

        for (player_id, tx) in &inner.connections {
            let in_room = inner
                .metas
                .get(player_id)
                .and_then(|m| m.room_id)
                .is_some();
            if !in_room {
                let _ = tx.send(Message::Text(text.clone().into()));
            }
        }
    }

    pub fn send_to_player(&self, player_id: Uuid, msg: &ServerMessage) {
        let inner = self.inner.lock();
        if let Some(tx) = inner.connections.get(&player_id) {
            Self::send_raw(tx, msg);
        }
    }
}
