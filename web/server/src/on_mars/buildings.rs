//! Bâtiments sur la grille hexagonale colonie.
use serde::{Deserialize, Serialize};

use super::constants::PLAYER_COUNT;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColonyBuildingKind {
    Mine,
    Generator,
    WaterExtractor,
    Greenhouse,
    OxygenCondenser,
    Shelter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColonyBuilding {
    pub q: i16,
    pub r: i16,
    pub kind: ColonyBuildingKind,
    /// Requis pour `shelter` — index joueur (0–3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub player_index: Option<u8>,
}

/// Carte de départ : aucun bâtiment.
pub fn default_colony_buildings() -> Vec<ColonyBuilding> {
    Vec::new()
}

pub(crate) fn normalize_colony_buildings(buildings: &mut Vec<ColonyBuilding>) {
    let mut next = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for mut b in buildings.drain(..) {
        let key = (b.q, b.r);
        if !seen.insert(key) {
            continue;
        }
        if b.kind == ColonyBuildingKind::Shelter {
            let idx = b.player_index.unwrap_or(0).min((PLAYER_COUNT as u8) - 1);
            b.player_index = Some(idx);
        } else {
            b.player_index = None;
        }
        next.push(b);
    }
    *buildings = next;
    // Migre l’ancienne carte démo dense → vide.
    if buildings.len() >= 20 {
        buildings.clear();
    }
}
