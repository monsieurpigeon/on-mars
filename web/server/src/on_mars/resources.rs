//! Ressources portées du joueur.
use super::types::{carry_capacity, ColonyResourceKind, OnMarsUiGameState};

pub fn set_player_resource(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    kind: ColonyResourceKind,
    amount: u8,
) -> Result<(), &'static str> {
    let player = game
        .players
        .iter_mut()
        .find(|p| p.player_index == player_index)
        .ok_or("unknown player")?;
    let cap = carry_capacity(player.shelters_installed);
    player.resources.set(kind, amount.min(cap));
    Ok(())
}

