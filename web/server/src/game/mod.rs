//! Session de jeu WS — stub On Mars (règles à brancher depuis `crate::on_mars`).

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameKind {
    OnMars,
}

impl GameKind {
    pub fn clamp_max_players(self, n: usize) -> usize {
        match self {
            GameKind::OnMars => n.clamp(2, 4),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayerColor {
    Red,
    Blue,
    Green,
    Yellow,
}

const COLORS: [PlayerColor; 4] = [
    PlayerColor::Red,
    PlayerColor::Blue,
    PlayerColor::Green,
    PlayerColor::Yellow,
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StubPlayer {
    pub id: Uuid,
    pub nickname: String,
    pub color: PlayerColor,
}

/// Partie On Mars côté WS — placeholder jusqu’au branchement de la session de test.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnMarsStub {
    pub players: Vec<StubPlayer>,
    pub stub: bool,
}

impl OnMarsStub {
    pub fn setup(player_ids: &[Uuid], nicknames: &[String]) -> Result<Self, &'static str> {
        if !(2..=4).contains(&player_ids.len()) {
            return Err("On Mars se joue de 2 à 4 joueurs");
        }
        if nicknames.len() != player_ids.len() {
            return Err("nicknames mismatch");
        }
        let players = player_ids
            .iter()
            .zip(nicknames.iter())
            .enumerate()
            .map(|(i, (id, nick))| StubPlayer {
                id: *id,
                nickname: nick.clone(),
                color: COLORS[i % COLORS.len()],
            })
            .collect();
        Ok(Self {
            players,
            stub: true,
        })
    }
}

#[derive(Debug, Clone)]
pub enum GameSession {
    OnMars(OnMarsStub),
}

impl GameSession {
    pub fn start(kind: GameKind, player_ids: &[Uuid], nicknames: &[String]) -> Result<Self, &'static str> {
        match kind {
            GameKind::OnMars => Ok(GameSession::OnMars(OnMarsStub::setup(player_ids, nicknames)?)),
        }
    }
}
