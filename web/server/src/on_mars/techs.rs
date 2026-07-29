//! Marché des tuiles techno (module Techno orbite).
//!
//! Coûts par ligne (haut → bas) :
//! - ligne 0 : 1 oxygène + 1 ressource parmi énergie / eau / plante / oxygène
//! - ligne 1 : 1 oxygène
//! - ligne 2 : gratuit
//!
//! Placement : une des 2 cases vides les plus à gauche de la carte tech perso.

use super::types::{
    ColonyResourceKind, OnMarsUiGameState, TechKind, TechMarket, TechPlacement,
};
use serde::de::{self, Deserializer, Visitor};
use std::fmt;

const ALL_TECHS: [TechKind; 8] = [
    TechKind::Minerai,
    TechKind::Energie,
    TechKind::Eau,
    TechKind::Plante,
    TechKind::Oxygene,
    TechKind::Rover,
    TechKind::Fusee,
    TechKind::Batiment,
];

const ROW_COUNTS: [usize; 3] = [3, 3, 2];

const TOP_PAY_OPTIONS: [ColonyResourceKind; 4] = [
    ColonyResourceKind::Energie,
    ColonyResourceKind::Eau,
    ColonyResourceKind::Plante,
    ColonyResourceKind::Oxygene,
];

/// Cases de la carte tech perso (même ordre que le client).
const TECH_HEX_COORDS: [(i16, i16); 13] = [
    (0, 0),
    (0, 1),
    (-1, 0),
    (-1, 1),
    (-1, 2),
    (-2, 1),
    (-2, 2),
    (1, 1),
    (1, 0),
    (1, -1),
    (2, -1),
    (2, 0),
    (3, -1),
];

const LEFT_PLACE_COUNT: usize = 2;

/// Cases d’entrée fixes (2 hexes les plus à gauche) — seules places de pose.
fn tech_start_slots() -> [(i16, i16); LEFT_PLACE_COUNT] {
    let mut left: Vec<(i16, i16)> = TECH_HEX_COORDS.to_vec();
    left.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
    [left[0], left[1]]
}

fn shuffle_techs(seed: i32) -> Vec<TechKind> {
    let mut items = ALL_TECHS.to_vec();
    let mut s = seed;
    for i in (1..items.len()).rev() {
        s = s.wrapping_mul(1664525).wrapping_add(1013904223);
        let j = (s as u32 as usize) % (i + 1);
        items.swap(i, j);
    }
    items
}

pub fn deal_tech_market(seed: i32) -> TechMarket {
    TechMarket {
        slots: shuffle_techs(seed).into_iter().map(Some).collect(),
    }
}

pub fn create_initial_tech_market() -> TechMarket {
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as i32)
        .unwrap_or(0x7ec00001_i32);
    deal_tech_market(seed)
}

pub fn default_tech_market() -> TechMarket {
    create_initial_tech_market()
}

pub(crate) fn normalize_tech_market(market: &mut TechMarket) {
    if market.slots.len() != ALL_TECHS.len() {
        *market = create_initial_tech_market();
        return;
    }
    let mut seen = std::collections::HashSet::new();
    let mut valid = true;
    for slot in &market.slots {
        if let Some(kind) = slot {
            if !seen.insert(*kind) {
                valid = false;
                break;
            }
        }
    }
    if !valid {
        *market = create_initial_tech_market();
    }
}

fn is_valid_tech_cell(q: i16, r: i16) -> bool {
    TECH_HEX_COORDS.iter().any(|&(cq, cr)| cq == q && cr == r)
}

/// Migre l’ancien format `["minerai", …]` vers des placements à gauche.
pub fn deserialize_tech_owned<'de, D>(
    deserializer: D,
) -> Result<Vec<TechPlacement>, D::Error>
where
    D: Deserializer<'de>,
{
    struct TechOwnedVisitor;

    impl<'de> Visitor<'de> for TechOwnedVisitor {
        type Value = Vec<TechPlacement>;

        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("tech placements or legacy kind list")
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: de::SeqAccess<'de>,
        {
            let mut kinds = Vec::new();
            let mut placements = Vec::new();
            while let Some(value) = seq.next_element::<serde_json::Value>()? {
                if let Ok(kind) = serde_json::from_value::<TechKind>(value.clone()) {
                    if value.is_string() {
                        kinds.push(kind);
                        continue;
                    }
                }
                if let Ok(p) = serde_json::from_value::<TechPlacement>(value) {
                    placements.push(p);
                }
            }
            if !kinds.is_empty() && placements.is_empty() {
                let starts = tech_start_slots();
                let mut seen = std::collections::HashSet::new();
                for (i, kind) in kinds.into_iter().enumerate() {
                    if !seen.insert(kind) {
                        continue;
                    }
                    if i >= starts.len() {
                        break;
                    }
                    let (q, r) = starts[i];
                    placements.push(TechPlacement { kind, q, r });
                }
            }
            Ok(placements)
        }
    }

    deserializer.deserialize_seq(TechOwnedVisitor)
}

/// Migre / déduplique les placements techno.
pub(crate) fn normalize_tech_owned(owned: &mut Vec<TechPlacement>) {
    // Si désérialisé depuis d’anciens strings, serde échouerait — on gère
    // seulement le format objet ici. Déduplique kinds / cellules.
    let mut next = Vec::new();
    let mut seen_kinds = std::collections::HashSet::new();
    let mut seen_cells = std::collections::HashSet::new();
    for p in owned.drain(..) {
        if !seen_kinds.insert(p.kind) {
            continue;
        }
        if !is_valid_tech_cell(p.q, p.r) {
            continue;
        }
        let cell = (p.q, p.r);
        if !seen_cells.insert(cell) {
            continue;
        }
        next.push(p);
    }
    *owned = next;
}

fn leftmost_available(owned: &[TechPlacement]) -> Vec<(i16, i16)> {
    let occupied: std::collections::HashSet<(i16, i16)> =
        owned.iter().map(|p| (p.q, p.r)).collect();
    tech_start_slots()
        .into_iter()
        .filter(|c| !occupied.contains(c))
        .collect()
}

fn is_valid_placement(owned: &[TechPlacement], q: i16, r: i16) -> bool {
    leftmost_available(owned)
        .iter()
        .any(|&(aq, ar)| aq == q && ar == r)
}

fn tech_row_for_slot(slot_index: usize) -> usize {
    let mut remaining = slot_index;
    for (row, count) in ROW_COUNTS.iter().enumerate() {
        if remaining < *count {
            return row;
        }
        remaining -= count;
    }
    ROW_COUNTS.len() - 1
}

fn is_top_pay(kind: ColonyResourceKind) -> bool {
    TOP_PAY_OPTIONS.contains(&kind)
}

fn can_afford_row(
    resources: &super::types::PlayerResources,
    row: usize,
    pay_extra: Option<ColonyResourceKind>,
) -> bool {
    let oxy = resources.oxygene;
    match row {
        2 => true,
        1 => oxy >= 1,
        0 => match pay_extra {
            Some(ColonyResourceKind::Oxygene) => oxy >= 2,
            Some(extra) if is_top_pay(extra) => {
                oxy >= 1 && resources.get(extra) >= 1
            }
            _ => false,
        },
        _ => false,
    }
}

fn pay_row_cost(
    resources: &mut super::types::PlayerResources,
    row: usize,
    pay_extra: Option<ColonyResourceKind>,
) -> Result<(), &'static str> {
    if !can_afford_row(resources, row, pay_extra) {
        return Err("cannot afford tech row");
    }
    match row {
        2 => Ok(()),
        1 => {
            resources.oxygene -= 1;
            Ok(())
        }
        0 => {
            let extra = pay_extra.ok_or("pay_resource required for top row")?;
            resources.oxygene -= 1;
            let n = resources.get(extra);
            resources.set(extra, n - 1);
            Ok(())
        }
        _ => Err("invalid tech row"),
    }
}

pub fn take_tech(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    kind: TechKind,
    pay_resource: Option<ColonyResourceKind>,
    q: i16,
    r: i16,
) -> Result<(), &'static str> {
    let index = game
        .tech_market
        .slots
        .iter()
        .position(|s| *s == Some(kind))
        .ok_or("tech not in market")?;
    let row = tech_row_for_slot(index);
    if row == 0 {
        let extra = pay_resource.ok_or("pay_resource required for top row")?;
        if !is_top_pay(extra) {
            return Err("invalid pay_resource");
        }
    }

    {
        let player = game
            .players
            .iter_mut()
            .find(|p| p.player_index == player_index)
            .ok_or("unknown player")?;
        if player.techs.iter().any(|p| p.kind == kind) {
            return Err("already owned");
        }
        if !is_valid_placement(&player.techs, q, r) {
            return Err("invalid placement");
        }
        pay_row_cost(&mut player.resources, row, pay_resource)?;
        player.techs.push(TechPlacement { kind, q, r });
    }
    game.tech_market.slots[index] = None;
    Ok(())
}

fn hex_neighbors(q: i16, r: i16) -> [(i16, i16); 6] {
    [
        (q + 1, r),
        (q + 1, r - 1),
        (q, r - 1),
        (q - 1, r),
        (q - 1, r + 1),
        (q, r + 1),
    ]
}

fn flat_pixel_x(q: i16) -> f64 {
    1.5 * f64::from(q)
}

fn flat_pixel_y(q: i16, r: i16) -> f64 {
    (3f64.sqrt() / 2.0) * f64::from(q) + 3f64.sqrt() * f64::from(r)
}

fn advance_right_targets(owned: &[TechPlacement], kind: TechKind) -> Vec<(i16, i16)> {
    let Some(tech) = owned.iter().find(|p| p.kind == kind) else {
        return Vec::new();
    };
    let occupied: std::collections::HashSet<(i16, i16)> = owned
        .iter()
        .filter(|p| p.kind != kind)
        .map(|p| (p.q, p.r))
        .collect();
    let from_x = flat_pixel_x(tech.q);
    let mut targets = Vec::new();
    for (nq, nr) in hex_neighbors(tech.q, tech.r) {
        if !is_valid_tech_cell(nq, nr) {
            continue;
        }
        if occupied.contains(&(nq, nr)) {
            continue;
        }
        if flat_pixel_x(nq) <= from_x + 1e-6 {
            continue;
        }
        targets.push((nq, nr));
    }
    targets.sort_by(|a, b| {
        let ay = flat_pixel_y(a.0, a.1);
        let by = flat_pixel_y(b.0, b.1);
        ay.partial_cmp(&by)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.0.cmp(&b.0))
            .then(a.1.cmp(&b.1))
    });
    targets
}

/// Fait évoluer une techno vers une case voisine à droite (haut ou bas).
pub fn advance_tech(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    kind: TechKind,
    q: i16,
    r: i16,
) -> Result<(), &'static str> {
    let player = game
        .players
        .iter_mut()
        .find(|p| p.player_index == player_index)
        .ok_or("unknown player")?;
    let ok = advance_right_targets(&player.techs, kind)
        .iter()
        .any(|&(tq, tr)| tq == q && tr == r);
    if !ok {
        return Err("invalid advance target");
    }
    let tech = player
        .techs
        .iter_mut()
        .find(|p| p.kind == kind)
        .ok_or("tech not owned")?;
    tech.q = q;
    tech.r = r;
    Ok(())
}
