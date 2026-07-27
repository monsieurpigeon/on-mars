mod tictactoe;
pub mod on_mars;

pub use tictactoe::{Cell, Mark, TicTacToe, Winner};
pub use on_mars::OnMarsState;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameKind {
    TicTacToe,
    OnMars,
}

impl GameKind {
    pub fn clamp_max_players(self, n: usize) -> usize {
        match self {
            GameKind::TicTacToe => 2,
            GameKind::OnMars => n.clamp(2, 4),
        }
    }
}

#[derive(Debug)]
pub enum GameSession {
    TicTacToe(TicTacToe),
    OnMars(OnMarsState),
}

impl GameSession {
    pub fn start(kind: GameKind, player_ids: &[Uuid], nicknames: &[String]) -> Result<Self, &'static str> {
        match kind {
            GameKind::TicTacToe => {
                if player_ids.len() < 2 {
                    return Err("Il faut 2 joueurs");
                }
                Ok(GameSession::TicTacToe(TicTacToe::new(
                    player_ids[0],
                    player_ids[1],
                )))
            }
            GameKind::OnMars => {
                if !(2..=4).contains(&player_ids.len()) {
                    return Err("On Mars se joue de 2 à 4 joueurs");
                }
                Ok(GameSession::OnMars(OnMarsState::setup(
                    player_ids,
                    nicknames,
                )))
            }
        }
    }
}
