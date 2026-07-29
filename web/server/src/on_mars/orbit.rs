//! Banque orbite.
use super::constants::{CRYSTAL_DEPOT_CAPACITY, ORBIT_BANK_STACK};
use super::types::{carry_capacity, OnMarsUiGameState, OrbitBank, OrbitBankKind};

pub(crate) fn full_orbit_bank(generation: u32) -> OrbitBank {
    OrbitBank {
        cristal: ORBIT_BANK_STACK,
        energie: ORBIT_BANK_STACK,
        eau: ORBIT_BANK_STACK,
        plante: ORBIT_BANK_STACK,
        oxygene: ORBIT_BANK_STACK,
        generation,
    }
}

impl Default for OrbitBank {
    fn default() -> Self {
        full_orbit_bank(0)
    }
}

impl OrbitBank {
    pub fn get(&self, kind: OrbitBankKind) -> u8 {
        match kind {
            OrbitBankKind::Cristal => self.cristal,
            OrbitBankKind::Energie => self.energie,
            OrbitBankKind::Eau => self.eau,
            OrbitBankKind::Plante => self.plante,
            OrbitBankKind::Oxygene => self.oxygene,
        }
    }

    pub fn set(&mut self, kind: OrbitBankKind, amount: u8) {
        let n = amount.min(ORBIT_BANK_STACK);
        match kind {
            OrbitBankKind::Cristal => self.cristal = n,
            OrbitBankKind::Energie => self.energie = n,
            OrbitBankKind::Eau => self.eau = n,
            OrbitBankKind::Plante => self.plante = n,
            OrbitBankKind::Oxygene => self.oxygene = n,
        }
    }

    pub fn clamp_stacks(&mut self) {
        for kind in OrbitBankKind::ALL {
            self.set(kind, self.get(kind));
        }
    }
}

pub fn take_from_orbit_bank(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    kind: OrbitBankKind,
) -> Result<(), &'static str> {
    if game.orbit_bank.get(kind) == 0 {
        return Err("bank empty");
    }

    let player_pos = game
        .players
        .iter()
        .position(|p| p.player_index == player_index)
        .ok_or("unknown player")?;

    match kind {
        OrbitBankKind::Cristal => {
            if game.players[player_pos].crystal_depot >= CRYSTAL_DEPOT_CAPACITY {
                return Err("crystal depot full");
            }
            game.players[player_pos].crystal_depot += 1;
        }
        other => {
            let shelters = game.players[player_pos].shelters_installed;
            let cap = carry_capacity(shelters);
            let res = &mut game.players[player_pos].resources;
            let current = match other {
                OrbitBankKind::Energie => res.energie,
                OrbitBankKind::Eau => res.eau,
                OrbitBankKind::Plante => res.plante,
                OrbitBankKind::Oxygene => res.oxygene,
                OrbitBankKind::Cristal => unreachable!(),
            };
            if current >= cap {
                return Err("storage full");
            }
            match other {
                OrbitBankKind::Energie => res.energie += 1,
                OrbitBankKind::Eau => res.eau += 1,
                OrbitBankKind::Plante => res.plante += 1,
                OrbitBankKind::Oxygene => res.oxygene += 1,
                OrbitBankKind::Cristal => unreachable!(),
            }
        }
    }

    let left = game.orbit_bank.get(kind).saturating_sub(1);
    game.orbit_bank.set(kind, left);
    Ok(())
}

/// Recharge la banque orbite (piles à 3) et bump la génération (anim clients).
pub fn reload_orbit_bank(game: &mut OnMarsUiGameState) {
    let generation = game.orbit_bank.generation.saturating_add(1);
    game.orbit_bank = full_orbit_bank(generation);
}
