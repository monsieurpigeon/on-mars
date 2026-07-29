//! Abris et colons.
use super::constants::{SHELTER_MAX_INSTALLS, SHELTER_ROW_COUNT, SHELTER_SLOTS_PER_ROW};
use super::types::{clamp_shelters_installed, OnMarsUiGameState, PlayerGameState};

pub(crate) fn covered_top_rows(shelters_installed: u8) -> u8 {
    SHELTER_MAX_INSTALLS.saturating_sub(clamp_shelters_installed(shelters_installed))
}

pub(crate) fn visible_shelter_capacity(shelters_installed: u8) -> u8 {
    let top = covered_top_rows(shelters_installed);
    SHELTER_ROW_COUNT
        .saturating_sub(top)
        .saturating_mul(SHELTER_SLOTS_PER_ROW)
}

pub(crate) fn clamp_shelter_colonists(count: u8, shelters_installed: u8) -> u8 {
    count.min(visible_shelter_capacity(shelters_installed))
}

/// Migre l’ancien `shelter_occupied` (positions) vers un simple compteur.
pub(crate) fn resolve_shelter_colonists(player: &PlayerGameState) -> u8 {
    let installed = clamp_shelters_installed(player.shelters_installed);
    let raw = if !player.shelter_occupied.is_empty() {
        player.shelter_occupied.len() as u8
    } else {
        player.shelter_colonists
    };
    clamp_shelter_colonists(raw, installed)
}

pub fn install_next_shelter(
    game: &mut OnMarsUiGameState,
    player_index: u8,
) -> Result<(), &'static str> {
    let player = game
        .players
        .iter_mut()
        .find(|p| p.player_index == player_index)
        .ok_or("unknown player")?;
    let installed = clamp_shelters_installed(player.shelters_installed);
    if installed >= SHELTER_MAX_INSTALLS {
        return Err("shelters max");
    }
    player.shelters_installed = installed + 1;
    player.shelter_occupied.clear();
    player.shelter_colonists =
        clamp_shelter_colonists(player.shelter_colonists, player.shelters_installed);
    Ok(())
}

/// Place un colon du stock perso dans les abris (compteur, affichage empilé vers le bas).
pub fn place_colon_from_stock(
    game: &mut OnMarsUiGameState,
    player_index: u8,
) -> Result<(), &'static str> {
    let player = game
        .players
        .iter_mut()
        .find(|p| p.player_index == player_index)
        .ok_or("unknown player")?;
    if player.colon_stock == 0 {
        return Err("colon stock empty");
    }
    let cap = visible_shelter_capacity(player.shelters_installed);
    if player.shelter_colonists >= cap {
        return Err("no shelter slot");
    }
    player.shelter_colonists += 1;
    player.colon_stock -= 1;
    player.shelter_occupied.clear();
    Ok(())
}

/// Envoie un colon des abris vers la zone de travail (retire depuis le bas).
pub fn send_shelter_colon_to_work(
    game: &mut OnMarsUiGameState,
    player_index: u8,
) -> Result<(), &'static str> {
    let player = game
        .players
        .iter_mut()
        .find(|p| p.player_index == player_index)
        .ok_or("unknown player")?;
    if player.shelter_colonists == 0 {
        return Err("no colon in shelter");
    }
    player.shelter_colonists -= 1;
    player.working_colonists = player.working_colonists.saturating_add(1);
    player.shelter_occupied.clear();
    Ok(())
}

/// Rapatrie les colons au travail : remplit les abris au max, surplus → stock.
pub fn recall_working_colonists(
    game: &mut OnMarsUiGameState,
    player_index: u8,
) -> Result<(), &'static str> {
    let player = game
        .players
        .iter_mut()
        .find(|p| p.player_index == player_index)
        .ok_or("unknown player")?;
    if player.working_colonists == 0 {
        return Err("no working colonists");
    }
    let cap = visible_shelter_capacity(player.shelters_installed);
    let total = player
        .shelter_colonists
        .saturating_add(player.working_colonists);
    let in_shelter = total.min(cap);
    let overflow = total.saturating_sub(in_shelter);
    player.shelter_colonists = in_shelter;
    player.colon_stock = player.colon_stock.saturating_add(overflow);
    player.working_colonists = 0;
    player.shelter_occupied.clear();
    Ok(())
}

