//! Cycle de vie de la session test (init, normalize, persist).
use std::path::PathBuf;

use super::blueprints::{
    blueprint_class, create_initial_blueprint_market, fill_blueprint_row,
    normalize_blueprint_ids, occupied_blueprint_ids, pad_blueprint_row, sync_blueprints_for_lss,
};
use super::buildings::{default_colony_buildings, normalize_colony_buildings};
use super::rovers::{
    default_colony_rovers, normalize_colony_rovers, sync_rover_stocks_with_board,
};
use super::constants::{
    CRYSTAL_DEPOT_CAPACITY, DEFAULT_COLON_STOCK, DEFAULT_SHELTER_COLONISTS, LSS_MIN,
    MISSION_COUNT, PLAYER_COUNT, TEST_SESSION_ID,
};
use super::lss::{create_lss_reward_pool, deal_lss_reward_row, normalize_lss_rewards};
use super::missions::{default_missions, normalize_missions};
use super::orbit::full_orbit_bank;
use super::scientists::{
    create_initial_scientist_market, normalize_scientist_market, normalize_scientist_owned,
};
use super::techs::{
    create_initial_tech_market, normalize_tech_market, normalize_tech_owned,
};
use super::shelters::resolve_shelter_colonists;
use super::types::{
    carry_capacity, clamp_lss_level, clamp_shelters_installed, BoardZone, LssResourceTrack,
    OnMarsUiGameState, PlayerGameState, PlayerResources, TestSession,
};
use crate::state::AppState;

impl Default for TestSession {
    fn default() -> Self {
        Self::initial()
    }
}

impl TestSession {
    pub fn initial() -> Self {
        Self {
            session_id: TEST_SESSION_ID.into(),
            view_player_index: 0,
            game: OnMarsUiGameState {
                lss_level: LSS_MIN,
                missions: default_missions(),
                remaining_missions: MISSION_COUNT,
                orbit_bank: full_orbit_bank(0),
                blueprints: create_initial_blueprint_market(),
                scientists: create_initial_scientist_market(),
                tech_market: create_initial_tech_market(),
                lss_rewards: create_lss_reward_pool(),
                lss_reward_row: deal_lss_reward_row(),
                lss_resource_track: LssResourceTrack::default(),
                lss_player_tokens: Default::default(),
                colony_buildings: default_colony_buildings(),
                colony_rovers: default_colony_rovers(),
                players: (0..PLAYER_COUNT as u8)
                    .map(|player_index| PlayerGameState {
                        player_index,
                        zone: BoardZone::Orbit,
                        score: 0,
                        resources: PlayerResources::default(),
                        crystal_depot: 0,
                        blueprints: Vec::new(),
                        scientists: Vec::new(),
                        shelter_colonists: DEFAULT_SHELTER_COLONISTS,
                        shelter_occupied: Vec::new(),
                        shelters_installed: 0,
                        colon_stock: DEFAULT_COLON_STOCK,
                        rover_stock: 0, // rovers déjà sur le plateau au départ
                        techs: Vec::new(),
                        working_colonists: 0,
                    })
                    .collect(),
            },
        }
    }

    pub fn normalized(mut self) -> Self {
        self.session_id = TEST_SESSION_ID.into();
        if (self.view_player_index as usize) >= PLAYER_COUNT {
            self.view_player_index = 0;
        }

        self.game.lss_level = clamp_lss_level(self.game.lss_level);
        normalize_missions(&mut self.game);
        self.game.orbit_bank.clamp_stacks();
        pad_blueprint_row(&mut self.game.blueprints.row_blue);
        pad_blueprint_row(&mut self.game.blueprints.row_red);
        normalize_blueprint_ids(&mut self.game.blueprints.deck);
        normalize_blueprint_ids(&mut self.game.blueprints.discarded);
        // Migration ancien champ `market` plat.
        if occupied_blueprint_ids(&self.game.blueprints.row_blue).is_empty()
            && occupied_blueprint_ids(&self.game.blueprints.row_red).is_empty()
            && !self.game.blueprints.market.is_empty()
        {
            let mut blues = Vec::new();
            let mut reds = Vec::new();
            for id in self.game.blueprints.market.drain(..) {
                if blueprint_class(id) == 1 {
                    blues.push(id);
                } else {
                    reds.push(id);
                }
            }
            self.game.blueprints.row_blue = fill_blueprint_row(blues);
            self.game.blueprints.row_red = fill_blueprint_row(reds);
        }
        if occupied_blueprint_ids(&self.game.blueprints.row_blue).is_empty()
            && occupied_blueprint_ids(&self.game.blueprints.row_red).is_empty()
            && self.game.blueprints.deck.is_empty()
            && self.game.blueprints.discarded.is_empty()
        {
            self.game.blueprints = create_initial_blueprint_market();
        }
        if self.game.blueprints.deal_phase < 1 {
            self.game.blueprints.deal_phase = 1;
        }
        if self.game.blueprints.deal_phase > 3 {
            self.game.blueprints.deal_phase = 3;
        }
        sync_blueprints_for_lss(&mut self.game.blueprints, self.game.lss_level);
        normalize_scientist_market(&mut self.game.scientists);
        normalize_tech_market(&mut self.game.tech_market);
        normalize_lss_rewards(&mut self.game);
        normalize_colony_buildings(&mut self.game.colony_buildings);
        normalize_colony_rovers(&mut self.game.colony_rovers);

        let mut by_index = vec![None; PLAYER_COUNT];
        for mut p in self.game.players.drain(..) {
            let idx = p.player_index as usize;
            if idx < PLAYER_COUNT {
                let shelters_installed = clamp_shelters_installed(p.shelters_installed);
                let shelter_colonists = resolve_shelter_colonists(&p);
                let cap = carry_capacity(shelters_installed);
                p.resources.clamp_to_capacity(cap);
                normalize_blueprint_ids(&mut p.blueprints);
                normalize_scientist_owned(&mut p.scientists);
                normalize_tech_owned(&mut p.techs);
                by_index[idx] = Some(PlayerGameState {
                    player_index: p.player_index,
                    zone: p.zone,
                    score: p.score,
                    resources: p.resources,
                    crystal_depot: p.crystal_depot.min(CRYSTAL_DEPOT_CAPACITY),
                    blueprints: p.blueprints,
                    scientists: p.scientists,
                    shelter_colonists,
                    shelter_occupied: Vec::new(),
                    shelters_installed,
                    colon_stock: p.colon_stock,
                    rover_stock: p.rover_stock,
                    techs: p.techs,
                    working_colonists: p.working_colonists,
                });
            }
        }

        self.game.players = (0..PLAYER_COUNT as u8)
            .map(|i| {
                by_index[i as usize]
                    .take()
                    .unwrap_or(PlayerGameState {
                        player_index: i,
                        zone: BoardZone::Orbit,
                        score: 0,
                        resources: PlayerResources::default(),
                        crystal_depot: 0,
                        blueprints: Vec::new(),
                        scientists: Vec::new(),
                        shelter_colonists: DEFAULT_SHELTER_COLONISTS,
                        shelter_occupied: Vec::new(),
                        shelters_installed: 0,
                        colon_stock: DEFAULT_COLON_STOCK,
                        rover_stock: 1,
                        techs: Vec::new(),
                        working_colonists: 0,
                    })
            })
            .collect();
        sync_rover_stocks_with_board(&mut self.game.players, &self.game.colony_rovers);
        self
    }
}

pub(crate) fn session_path() -> PathBuf {
    PathBuf::from(
        std::env::var("TEST_SESSION_PATH")
            .unwrap_or_else(|_| "data/test_session.json".into()),
    )
}

pub(crate) fn persist(state: &AppState, session: &TestSession) {
    {
        let mut guard = state.test_session.lock();
        *guard = session.clone();
    }
    save_to_disk(session);
}

pub fn load_from_disk() -> TestSession {
    let path = session_path();
    match std::fs::read_to_string(&path) {
        Ok(raw) => match serde_json::from_str::<TestSession>(&raw) {
            Ok(session) => {
                tracing::info!("Loaded test session from {}", path.display());
                session.normalized()
            }
            Err(err) => {
                tracing::warn!("Invalid test session file: {err}");
                TestSession::initial()
            }
        },
        Err(_) => TestSession::initial(),
    }
}

pub fn save_to_disk(session: &TestSession) {
    let path = session_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    match serde_json::to_string_pretty(session) {
        Ok(raw) => {
            if let Err(err) = std::fs::write(&path, raw) {
                tracing::warn!("Failed to persist test session to {}: {err}", path.display());
            }
        }
        Err(err) => tracing::warn!("Failed to serialize test session: {err}"),
    }
}
