//! Marché des plans.
use super::constants::{BLUEPRINT_CLASS1_MAX, BLUEPRINT_CLASS2_MAX, BLUEPRINT_DEAL_COUNT};
use super::types::{BlueprintMarket, OnMarsUiGameState};

pub(crate) fn default_blueprints() -> BlueprintMarket {
    create_initial_blueprint_market()
}

pub(crate) fn blueprint_class(id: u8) -> u8 {
    if id >= 13 { 2 } else { 1 }
}

pub(crate) fn is_valid_blueprint_id(id: u8) -> bool {
    (1..=BLUEPRINT_CLASS2_MAX).contains(&id)
}

pub(crate) fn shuffle_u8(items: &mut [u8]) {
    // Fisher–Yates, graine temps (pas de crate rand).
    let mut seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0xC0FFEE)
        ^ (items.len() as u64).wrapping_mul(0x9E37_79B9);
    for i in (1..items.len()).rev() {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1);
        let j = (seed >> 33) as usize % (i + 1);
        items.swap(i, j);
    }
}

pub(crate) fn take_random_of_class(deck: &mut Vec<u8>, class: u8, count: usize) -> Vec<u8> {
    let mut indices: Vec<usize> = deck
        .iter()
        .enumerate()
        .filter(|(_, id)| blueprint_class(**id) == class)
        .map(|(i, _)| i)
        .collect();
    shuffle_u8_indices(&mut indices);
    let take_n = count.min(indices.len());
    let mut picked_idx = indices[..take_n].to_vec();
    picked_idx.sort_by(|a, b| b.cmp(a));
    let mut result = Vec::with_capacity(take_n);
    for idx in picked_idx {
        result.push(deck.remove(idx));
    }
    shuffle_u8(&mut result);
    result
}

pub(crate) fn shuffle_u8_indices(items: &mut [usize]) {
    let mut seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0xBADC0DE)
        ^ (items.len() as u64).wrapping_mul(0x85EB_CA6B);
    for i in (1..items.len()).rev() {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1);
        let j = (seed >> 33) as usize % (i + 1);
        items.swap(i, j);
    }
}

pub(crate) fn empty_blueprint_row() -> Vec<Option<u8>> {
    vec![None; BLUEPRINT_DEAL_COUNT]
}

pub(crate) fn fill_blueprint_row(cards: Vec<u8>) -> Vec<Option<u8>> {
    let mut row = empty_blueprint_row();
    for (i, id) in cards.into_iter().take(BLUEPRINT_DEAL_COUNT).enumerate() {
        row[i] = Some(id);
    }
    row
}

pub(crate) fn occupied_blueprint_ids(row: &[Option<u8>]) -> Vec<u8> {
    row.iter().filter_map(|slot| *slot).collect()
}

pub(crate) fn pad_blueprint_row(row: &mut Vec<Option<u8>>) {
    row.truncate(BLUEPRINT_DEAL_COUNT);
    while row.len() < BLUEPRINT_DEAL_COUNT {
        row.push(None);
    }
    for slot in row.iter_mut() {
        if let Some(id) = *slot {
            if !is_valid_blueprint_id(id) {
                *slot = None;
            }
        }
    }
}

pub(crate) fn create_initial_blueprint_market() -> BlueprintMarket {
    let mut class1: Vec<u8> = (1..=BLUEPRINT_CLASS1_MAX).collect();
    let mut class2: Vec<u8> = ((BLUEPRINT_CLASS1_MAX + 1)..=BLUEPRINT_CLASS2_MAX).collect();
    shuffle_u8(&mut class1);
    shuffle_u8(&mut class2);
    let dealt: Vec<u8> = class1.drain(0..BLUEPRINT_DEAL_COUNT.min(class1.len())).collect();
    let mut deck = class1;
    deck.append(&mut class2);
    BlueprintMarket {
        row_blue: fill_blueprint_row(dealt),
        row_red: empty_blueprint_row(),
        market: Vec::new(),
        deck,
        discarded: Vec::new(),
        deal_phase: 1,
    }
}

pub(crate) fn discard_market_rows(bp: &mut BlueprintMarket) {
    bp.discarded.extend(occupied_blueprint_ids(&bp.row_blue));
    bp.discarded.extend(occupied_blueprint_ids(&bp.row_red));
    bp.row_blue = empty_blueprint_row();
    bp.row_red = empty_blueprint_row();
}

pub(crate) fn advance_blueprints_to_phase2(bp: &mut BlueprintMarket) {
    if bp.deal_phase >= 2 {
        return;
    }
    // Retire les cartes restantes du marché (les prises restent aux joueurs).
    discard_market_rows(bp);
    // Bleues restantes → 1ʳᵉ ligne ; 6 rouges → 2ᵉ ligne.
    bp.row_blue = fill_blueprint_row(take_random_of_class(&mut bp.deck, 1, BLUEPRINT_DEAL_COUNT));
    bp.row_red = fill_blueprint_row(take_random_of_class(&mut bp.deck, 2, BLUEPRINT_DEAL_COUNT));
    bp.deal_phase = 2;
}

pub(crate) fn advance_blueprints_to_phase3(bp: &mut BlueprintMarket) {
    if bp.deal_phase >= 3 {
        return;
    }
    if bp.deal_phase < 2 {
        advance_blueprints_to_phase2(bp);
    }
    // Sortir les bleues ; remplir les 6 premières places avec les rouges de la pioche.
    // La 2ᵉ ligne conserve ses emplacements (trous inclus).
    bp.discarded.extend(occupied_blueprint_ids(&bp.row_blue));
    bp.row_blue = fill_blueprint_row(take_random_of_class(
        &mut bp.deck,
        2,
        BLUEPRINT_DEAL_COUNT,
    ));
    bp.deal_phase = 3;
}

pub(crate) fn sync_blueprints_for_lss(bp: &mut BlueprintMarket, lss_level: u8) {
    let target = if lss_level >= 3 {
        3
    } else if lss_level >= 2 {
        2
    } else {
        1
    };
    if target >= 2 && bp.deal_phase < 2 {
        advance_blueprints_to_phase2(bp);
    }
    if target >= 3 && bp.deal_phase < 3 {
        advance_blueprints_to_phase3(bp);
    }
}

pub(crate) fn normalize_blueprint_ids(ids: &mut Vec<u8>) {
    ids.retain(|id| is_valid_blueprint_id(*id));
}

pub fn take_blueprint(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    card_id: u8,
) -> Result<(), &'static str> {
    if !is_valid_blueprint_id(card_id) {
        return Err("invalid card");
    }
    let from_blue = game
        .blueprints
        .row_blue
        .iter()
        .position(|slot| *slot == Some(card_id));
    let from_red = game
        .blueprints
        .row_red
        .iter()
        .position(|slot| *slot == Some(card_id));
    if from_blue.is_none() && from_red.is_none() {
        return Err("card not in market");
    }
    {
        let player = game
            .players
            .iter_mut()
            .find(|p| p.player_index == player_index)
            .ok_or("unknown player")?;
        if player.blueprints.contains(&card_id) {
            return Err("already owned");
        }
        player.blueprints.push(card_id);
    }
    if let Some(idx) = from_blue {
        game.blueprints.row_blue[idx] = None;
    } else if let Some(idx) = from_red {
        game.blueprints.row_red[idx] = None;
    }
    Ok(())
}

