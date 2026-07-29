//! Scientifiques — marché et inventaire.
use super::types::{OnMarsUiGameState, ScientistMarket, ScientistResource};

pub(crate) fn create_initial_scientist_market() -> ScientistMarket {
    ScientistMarket {
        slots: ScientistResource::ALL.iter().copied().map(Some).collect(),
    }
}

pub(crate) fn default_scientists() -> ScientistMarket {
    create_initial_scientist_market()
}

pub(crate) fn normalize_scientist_market(market: &mut ScientistMarket) {
    let mut next = Vec::with_capacity(6);
    for (index, expected) in ScientistResource::ALL.iter().enumerate() {
        let slot = market.slots.get(index).copied().flatten();
        next.push(if slot == Some(*expected) {
            Some(*expected)
        } else {
            None
        });
    }
    market.slots = next;
}

pub(crate) fn normalize_scientist_owned(owned: &mut Vec<ScientistResource>) {
    let mut next = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for resource in owned.drain(..) {
        if seen.insert(resource) {
            next.push(resource);
        }
    }
    *owned = next;
}

pub fn take_scientist(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    resource: ScientistResource,
) -> Result<(), &'static str> {
    let index = ScientistResource::ALL
        .iter()
        .position(|r| *r == resource)
        .ok_or("invalid scientist")?;
    if game.scientists.slots.get(index).copied().flatten() != Some(resource) {
        return Err("scientist not in market");
    }
    {
        let player = game
            .players
            .iter_mut()
            .find(|p| p.player_index == player_index)
            .ok_or("unknown player")?;
        if player.scientists.contains(&resource) {
            return Err("already owned");
        }
        player.scientists.push(resource);
    }
    game.scientists.slots[index] = None;
    Ok(())
}
