//! LSS — tokens ressources, récompenses, level-up.
use super::blueprints::{shuffle_u8, sync_blueprints_for_lss};
use super::constants::{LSS_MAX, LSS_REWARD_COUNT, LSS_REWARD_TRACK_SIZE};
use super::orbit::reload_orbit_bank;
use super::types::{
    carry_capacity, clamp_lss_level, ColonyResourceKind, LssPlayerTokens, LssResourceTrack,
    OnMarsUiGameState,
};

pub(crate) fn create_lss_reward_pool() -> Vec<u8> {
    (1..=LSS_REWARD_COUNT).collect()
}

pub(crate) fn default_lss_rewards() -> Vec<u8> {
    create_lss_reward_pool()
}

pub(crate) fn deal_lss_reward_row() -> Vec<u8> {
    let mut pool = create_lss_reward_pool();
    shuffle_u8(&mut pool);
    pool.into_iter().take(LSS_REWARD_TRACK_SIZE).collect()
}

pub(crate) fn default_lss_reward_row() -> Vec<u8> {
    deal_lss_reward_row()
}

pub(crate) fn default_lss_resource_track() -> LssResourceTrack {
    LssResourceTrack::default()
}

pub(crate) fn default_lss_player_tokens() -> LssPlayerTokens {
    LssPlayerTokens::default()
}

pub(crate) fn is_valid_lss_reward_id(id: u8) -> bool {
    (1..=LSS_REWARD_COUNT).contains(&id)
}

/// Conserve la piste si valide (4 ids uniques 1–8) — les tokens ne bougent plus.
pub(crate) fn normalize_lss_rewards(game: &mut OnMarsUiGameState) {
    let mut seen = std::collections::HashSet::new();
    let pool_ok = game.lss_rewards.len() == LSS_REWARD_COUNT as usize
        && game.lss_rewards.iter().all(|&id| {
            is_valid_lss_reward_id(id) && seen.insert(id)
        });
    if !pool_ok {
        game.lss_rewards = create_lss_reward_pool();
    }

    seen.clear();
    let mut row_ok = game.lss_reward_row.len() == LSS_REWARD_TRACK_SIZE;
    if row_ok {
        for &id in &game.lss_reward_row {
            if !is_valid_lss_reward_id(id) || !seen.insert(id) {
                row_ok = false;
                break;
            }
        }
    }
    if !row_ok {
        game.lss_reward_row = deal_lss_reward_row();
    }
    game.lss_resource_track.clamp_all();
    game.lss_player_tokens.normalize();
}


pub fn set_lss_level(game: &mut OnMarsUiGameState, level: u8) {
    game.lss_level = clamp_lss_level(level);
    for player in &mut game.players {
        let cap = carry_capacity(player.shelters_installed);
        player.resources.clamp_to_capacity(cap);
    }
    sync_blueprints_for_lss(&mut game.blueprints, game.lss_level);
}

/// Augmente le LSS d’un cran et recharge la banque orbite.
pub fn level_up_lss(game: &mut OnMarsUiGameState) -> Result<(), &'static str> {
    if game.lss_level >= LSS_MAX {
        return Err("lss max");
    }
    set_lss_level(game, game.lss_level.saturating_add(1));
    reload_orbit_bank(game);
    Ok(())
}

/// Monte le LSS tant que tous les tokens ressources ont atteint le palier suivant.
fn sync_lss_level_from_resource_track(game: &mut OnMarsUiGameState) {
    while game.lss_level < LSS_MAX
        && game.lss_resource_track.min_level() > game.lss_level
    {
        let _ = level_up_lss(game);
    }
}

/// Monte le token d’une ressource d’un niveau ; level-up LSS si tous au palier suivant.
pub fn advance_lss_resource_token(
    game: &mut OnMarsUiGameState,
    resource: ColonyResourceKind,
) -> Result<(), &'static str> {
    let current = game
        .lss_resource_track
        .get(resource)
        .ok_or("not a track resource")?;
    if current >= LSS_MAX {
        return Err("resource max");
    }
    game.lss_resource_track.set(resource, current + 1)?;
    sync_lss_level_from_resource_track(game);
    Ok(())
}

/// Place le jeton d’un joueur sous une ressource LSS (point sur le carré couleur).
pub fn place_lss_player_token(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    resource: ColonyResourceKind,
) -> Result<(), &'static str> {
    if (player_index as usize) >= super::constants::PLAYER_COUNT {
        return Err("bad player");
    }
    let slot = game.lss_player_tokens.get_mut(resource);
    if !slot.contains(&player_index) {
        slot.push(player_index);
        slot.sort_unstable();
    }
    Ok(())
}
