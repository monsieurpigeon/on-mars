//! Rovers sur la grille — au plus un par joueur sur le plateau.
use serde::{Deserialize, Serialize};

use super::constants::PLAYER_COUNT;
use super::types::PlayerGameState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColonyRover {
    pub q: i16,
    pub r: i16,
    pub player_index: u8,
}

const START_COORDS: [(i16, i16); 4] = [(0, 0), (1, 0), (0, 1), (-1, 1)];

/// Départ : tous les rovers déjà sur le plateau.
pub fn default_colony_rovers() -> Vec<ColonyRover> {
    (0..PLAYER_COUNT as u8)
        .map(|player_index| {
            let (q, r) = START_COORDS[player_index as usize];
            ColonyRover {
                q,
                r,
                player_index,
            }
        })
        .collect()
}

/// Au plus un rover par joueur ; n’ajoute pas les absents (restent en stock).
pub(crate) fn normalize_colony_rovers(rovers: &mut Vec<ColonyRover>) {
    let mut by_player = std::collections::HashMap::new();
    for r in rovers.drain(..) {
        let idx = r.player_index.min((PLAYER_COUNT as u8) - 1);
        by_player.insert(
            idx,
            ColonyRover {
                q: r.q,
                r: r.r,
                player_index: idx,
            },
        );
    }
    let mut next: Vec<_> = by_player.into_values().collect();
    next.sort_by_key(|r| r.player_index);
    *rovers = next;
}

/// Rover sur le plateau → stock perso 0 ; sinon 1.
pub(crate) fn sync_rover_stocks_with_board(
    players: &mut [PlayerGameState],
    rovers: &[ColonyRover],
) {
    let on_board: std::collections::HashSet<u8> =
        rovers.iter().map(|r| r.player_index).collect();
    for player in players.iter_mut() {
        player.rover_stock = if on_board.contains(&player.player_index) {
            0
        } else {
            1
        };
    }
}

/// Place le rover depuis le stock perso sur le plateau. Err si déjà sorti / stock vide.
#[allow(dead_code)] // réservé au déploiement depuis le stock (pas encore branché API)
pub fn deploy_rover_from_stock(
    players: &mut [PlayerGameState],
    rovers: &mut Vec<ColonyRover>,
    player_index: u8,
    q: i16,
    r: i16,
) -> Result<(), &'static str> {
    let idx = player_index.min((PLAYER_COUNT as u8) - 1);
    if rovers.iter().any(|rv| rv.player_index == idx) {
        return Err("rover already on board");
    }
    let Some(player) = players.iter_mut().find(|p| p.player_index == idx) else {
        return Err("player not found");
    };
    if player.rover_stock == 0 {
        return Err("rover stock empty");
    }
    player.rover_stock = 0;
    rovers.push(ColonyRover {
        q,
        r,
        player_index: idx,
    });
    normalize_colony_rovers(rovers);
    Ok(())
}

fn hex_distance(aq: i16, ar: i16, bq: i16, br: i16) -> i16 {
    let as_ = -aq - ar;
    let bs = -bq - br;
    (aq - bq)
        .abs()
        .max((ar - br).abs())
        .max((as_ - bs).abs())
}

/// Déplace le rover d’un joueur d’une case (hex adjacent).
pub fn move_rover(
    rovers: &mut Vec<ColonyRover>,
    player_index: u8,
    q: i16,
    r: i16,
) -> Result<(), &'static str> {
    let idx = player_index.min((PLAYER_COUNT as u8) - 1);
    let Some(pos) = rovers.iter().position(|rv| rv.player_index == idx) else {
        return Err("rover not on board");
    };
    let current = &rovers[pos];
    if hex_distance(current.q, current.r, q, r) != 1 {
        return Err("target not adjacent");
    }
    rovers[pos].q = q;
    rovers[pos].r = r;
    Ok(())
}
