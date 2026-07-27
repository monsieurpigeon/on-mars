use std::path::{Path, PathBuf};

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::state::AppState;

pub const TEST_SESSION_ID: &str = "test-solo";
const PLAYER_COUNT: usize = 4;
const LSS_MIN: u8 = 1;
const LSS_MAX: u8 = 5;
const MISSION_COUNT: u8 = 3;
const DEFAULT_MISSION_TRACKER: u8 = 10;
const DEFAULT_MISSION_GOAL: u8 = 14;
const ORBIT_BANK_STACK: u8 = 3;
const CRYSTAL_DEPOT_CAPACITY: u8 = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BoardZone {
    Orbit,
    Colony,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColonyResourceKind {
    Minerai,
    Energie,
    Eau,
    Plante,
    Oxygene,
}

impl ColonyResourceKind {
    pub const ALL: [ColonyResourceKind; 5] = [
        ColonyResourceKind::Minerai,
        ColonyResourceKind::Energie,
        ColonyResourceKind::Eau,
        ColonyResourceKind::Plante,
        ColonyResourceKind::Oxygene,
    ];
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerResources {
    pub minerai: u8,
    pub energie: u8,
    pub eau: u8,
    pub plante: u8,
    pub oxygene: u8,
}

impl Default for PlayerResources {
    fn default() -> Self {
        Self {
            minerai: 0,
            energie: 0,
            eau: 0,
            plante: 0,
            oxygene: 0,
        }
    }
}

impl PlayerResources {
    pub fn get(&self, kind: ColonyResourceKind) -> u8 {
        match kind {
            ColonyResourceKind::Minerai => self.minerai,
            ColonyResourceKind::Energie => self.energie,
            ColonyResourceKind::Eau => self.eau,
            ColonyResourceKind::Plante => self.plante,
            ColonyResourceKind::Oxygene => self.oxygene,
        }
    }

    pub fn set(&mut self, kind: ColonyResourceKind, amount: u8) {
        match kind {
            ColonyResourceKind::Minerai => self.minerai = amount,
            ColonyResourceKind::Energie => self.energie = amount,
            ColonyResourceKind::Eau => self.eau = amount,
            ColonyResourceKind::Plante => self.plante = amount,
            ColonyResourceKind::Oxygene => self.oxygene = amount,
        }
    }

    pub fn clamp_to_capacity(&mut self, capacity: u8) {
        for kind in ColonyResourceKind::ALL {
            let n = self.get(kind).min(capacity);
            self.set(kind, n);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerGameState {
    pub player_index: u8,
    pub zone: BoardZone,
    pub score: i32,
    #[serde(default)]
    pub resources: PlayerResources,
    /// Dépôt de cristaux violet (plateau perso).
    #[serde(default)]
    pub crystal_depot: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrbitBankKind {
    Cristal,
    Energie,
    Eau,
    Plante,
    Oxygene,
}

impl OrbitBankKind {
    pub const ALL: [OrbitBankKind; 5] = [
        OrbitBankKind::Cristal,
        OrbitBankKind::Energie,
        OrbitBankKind::Eau,
        OrbitBankKind::Plante,
        OrbitBankKind::Oxygene,
    ];
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrbitBank {
    pub cristal: u8,
    pub energie: u8,
    pub eau: u8,
    pub plante: u8,
    pub oxygene: u8,
    /// Incrémenté à chaque rechargement (clients : animation).
    #[serde(default)]
    pub generation: u32,
}

impl Default for OrbitBank {
    fn default() -> Self {
        full_orbit_bank(0)
    }
}

fn full_orbit_bank(generation: u32) -> OrbitBank {
    OrbitBank {
        cristal: ORBIT_BANK_STACK,
        energie: ORBIT_BANK_STACK,
        eau: ORBIT_BANK_STACK,
        plante: ORBIT_BANK_STACK,
        oxygene: ORBIT_BANK_STACK,
        generation,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionTracker {
    pub id: String,
    pub label: String,
    /// Progression restante (descend vers 0).
    pub tracker: u8,
    pub goal: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnMarsUiGameState {
    pub players: Vec<PlayerGameState>,
    /// Niveau LSS / systèmes de survie (1–5). Capacité portée = niveau + 1.
    #[serde(default = "default_lss_level")]
    pub lss_level: u8,
    /// Compteurs des 3 missions (A/B/C).
    #[serde(default = "default_missions")]
    pub missions: Vec<MissionTracker>,
    /// Missions encore ouvertes — affiché en Fin comme remaining/3.
    #[serde(default = "default_remaining_missions")]
    pub remaining_missions: u8,
    /// Banque / stock orbite (colonnes de 3).
    #[serde(default)]
    pub orbit_bank: OrbitBank,
}

fn default_lss_level() -> u8 {
    LSS_MIN
}

fn default_remaining_missions() -> u8 {
    MISSION_COUNT
}

fn default_missions() -> Vec<MissionTracker> {
    vec![
        MissionTracker {
            id: "a".into(),
            label: "Mission A".into(),
            tracker: DEFAULT_MISSION_TRACKER,
            goal: DEFAULT_MISSION_GOAL,
        },
        MissionTracker {
            id: "b".into(),
            label: "Mission B".into(),
            tracker: DEFAULT_MISSION_TRACKER,
            goal: DEFAULT_MISSION_GOAL,
        },
        MissionTracker {
            id: "c".into(),
            label: "Mission C".into(),
            tracker: DEFAULT_MISSION_TRACKER,
            goal: DEFAULT_MISSION_GOAL,
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestSession {
    pub session_id: String,
    pub view_player_index: u8,
    pub game: OnMarsUiGameState,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLssBody {
    pub lss_level: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlayerResourceBody {
    pub player_index: u8,
    pub kind: ColonyResourceKind,
    pub amount: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMissionTrackerBody {
    pub mission_id: String,
    pub tracker: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeOrbitBankBody {
    pub player_index: u8,
    pub kind: OrbitBankKind,
}

impl Default for TestSession {
    fn default() -> Self {
        Self::initial()
    }
}

/// Capacité de portage par type de ressource = niveau LSS + 1.
pub fn carry_capacity(lss_level: u8) -> u8 {
    clamp_lss_level(lss_level).saturating_add(1)
}

pub fn clamp_lss_level(level: u8) -> u8 {
    level.clamp(LSS_MIN, LSS_MAX)
}

/// Met à jour le niveau LSS et borne les ressources portées de tous les joueurs.
pub fn set_lss_level(game: &mut OnMarsUiGameState, level: u8) {
    game.lss_level = clamp_lss_level(level);
    let cap = carry_capacity(game.lss_level);
    for player in &mut game.players {
        player.resources.clamp_to_capacity(cap);
    }
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

/// Met à jour la quantité d’une ressource portée par un joueur (bornée à la capacité).
pub fn set_player_resource(
    game: &mut OnMarsUiGameState,
    player_index: u8,
    kind: ColonyResourceKind,
    amount: u8,
) -> Result<(), &'static str> {
    let cap = carry_capacity(game.lss_level);
    let player = game
        .players
        .iter_mut()
        .find(|p| p.player_index == player_index)
        .ok_or("unknown player")?;
    player.resources.set(kind, amount.min(cap));
    Ok(())
}

/// Recalcule Fin (remaining/3) selon les missions à 0.
pub fn sync_remaining_missions(game: &mut OnMarsUiGameState) {
    let completed = game
        .missions
        .iter()
        .filter(|m| m.tracker == 0)
        .count()
        .min(MISSION_COUNT as usize) as u8;
    game.remaining_missions = MISSION_COUNT.saturating_sub(completed);
}

/// Met à jour le compteur d’une mission (0..=goal) et synchronise Fin.
pub fn set_mission_tracker(
    game: &mut OnMarsUiGameState,
    mission_id: &str,
    tracker: u8,
) -> Result<(), &'static str> {
    let mission = game
        .missions
        .iter_mut()
        .find(|m| m.id == mission_id)
        .ok_or("unknown mission")?;
    mission.tracker = tracker.min(mission.goal);
    sync_remaining_missions(game);
    Ok(())
}

/// Retire 1 jeton de la banque orbite vers le stock perso / dépôt cristal.
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
            let cap = carry_capacity(game.lss_level);
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

fn normalize_missions(game: &mut OnMarsUiGameState) {
    let defaults = default_missions();
    let mut by_id: std::collections::HashMap<String, MissionTracker> = game
        .missions
        .drain(..)
        .map(|m| (m.id.clone(), m))
        .collect();

    game.missions = defaults
        .into_iter()
        .map(|def| {
            if let Some(mut found) = by_id.remove(&def.id) {
                found.label = def.label;
                found.goal = if found.goal == 0 {
                    def.goal
                } else {
                    found.goal
                };
                found.tracker = found.tracker.min(found.goal);
                found
            } else {
                def
            }
        })
        .collect();
    sync_remaining_missions(game);
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
                players: (0..PLAYER_COUNT as u8)
                    .map(|player_index| PlayerGameState {
                        player_index,
                        zone: BoardZone::Orbit,
                        score: 0,
                        resources: PlayerResources::default(),
                        crystal_depot: 0,
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
        let cap = carry_capacity(self.game.lss_level);

        let mut by_index = vec![None; PLAYER_COUNT];
        for mut p in self.game.players.drain(..) {
            let idx = p.player_index as usize;
            if idx < PLAYER_COUNT {
                p.resources.clamp_to_capacity(cap);
                by_index[idx] = Some(PlayerGameState {
                    player_index: p.player_index,
                    zone: p.zone,
                    score: p.score,
                    resources: p.resources,
                    crystal_depot: p.crystal_depot.min(CRYSTAL_DEPOT_CAPACITY),
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
                    })
            })
            .collect();
        self
    }
}

fn session_path() -> PathBuf {
    PathBuf::from(
        std::env::var("TEST_SESSION_PATH")
            .unwrap_or_else(|_| "data/test_session.json".into()),
    )
}

fn persist(state: &AppState, session: &TestSession) {
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

pub async fn get_test_session(State(state): State<AppState>) -> Json<TestSession> {
    let session = state.test_session.lock().clone();
    Json(session)
}

pub async fn put_test_session(
    State(state): State<AppState>,
    Json(body): Json<TestSession>,
) -> Json<TestSession> {
    let session = body.normalized();
    persist(&state, &session);
    Json(session)
}

pub async fn reset_test_session(State(state): State<AppState>) -> Json<TestSession> {
    let session = TestSession::initial();
    let path = session_path();
    if Path::new(&path).exists() {
        let _ = std::fs::remove_file(&path);
    }
    persist(&state, &session);
    Json(session)
}

/// POST /api/test-session/lss — met à jour le niveau LSS (1–5).
pub async fn update_lss_level(
    State(state): State<AppState>,
    Json(body): Json<UpdateLssBody>,
) -> Json<TestSession> {
    let mut session = state.test_session.lock().clone();
    set_lss_level(&mut session.game, body.lss_level);
    let session = session.normalized();
    persist(&state, &session);
    Json(session)
}

/// POST /api/test-session/lss/level-up — +1 LSS + recharge banque orbite.
pub async fn level_up_lss_endpoint(
    State(state): State<AppState>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    level_up_lss(&mut session.game).map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/resources — met à jour une ressource portée par un joueur.
pub async fn update_player_resource(
    State(state): State<AppState>,
    Json(body): Json<UpdatePlayerResourceBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    set_player_resource(
        &mut session.game,
        body.player_index,
        body.kind,
        body.amount,
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/missions — met à jour le compteur d’une mission.
pub async fn update_mission_tracker(
    State(state): State<AppState>,
    Json(body): Json<UpdateMissionTrackerBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    set_mission_tracker(&mut session.game, &body.mission_id, body.tracker)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/orbit-bank/take — prend 1 ressource dans la banque orbite.
pub async fn take_orbit_bank_item(
    State(state): State<AppState>,
    Json(body): Json<TakeOrbitBankBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    take_from_orbit_bank(&mut session.game, body.player_index, body.kind)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/orbit-bank/reload — recharge la banque (anim côté clients).
pub async fn reload_orbit_bank_endpoint(
    State(state): State<AppState>,
) -> Json<TestSession> {
    let mut session = state.test_session.lock().clone();
    reload_orbit_bank(&mut session.game);
    let session = session.normalized();
    persist(&state, &session);
    Json(session)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capacity_is_lss_plus_one() {
        assert_eq!(carry_capacity(1), 2);
        assert_eq!(carry_capacity(5), 6);
        assert_eq!(carry_capacity(0), 2); // clampe à 1
        assert_eq!(carry_capacity(9), 6); // clampe à 5
    }

    #[test]
    fn set_lss_clamps_carried_resources() {
        let mut game = TestSession::initial().game;
        set_player_resource(&mut game, 0, ColonyResourceKind::Eau, 6).unwrap();
        assert_eq!(game.players[0].resources.eau, 2); // cap 2 at LSS 1
        set_lss_level(&mut game, 3);
        set_player_resource(&mut game, 0, ColonyResourceKind::Eau, 4).unwrap();
        assert_eq!(game.players[0].resources.eau, 4);
        set_lss_level(&mut game, 1);
        assert_eq!(game.players[0].resources.eau, 2);
    }

    #[test]
    fn mission_at_zero_decrements_fin() {
        let mut game = TestSession::initial().game;
        assert_eq!(game.remaining_missions, 3);
        set_mission_tracker(&mut game, "a", 0).unwrap();
        assert_eq!(game.missions[0].tracker, 0);
        assert_eq!(game.remaining_missions, 2);
        set_mission_tracker(&mut game, "b", 0).unwrap();
        assert_eq!(game.remaining_missions, 1);
        set_mission_tracker(&mut game, "a", 1).unwrap();
        assert_eq!(game.remaining_missions, 2);
    }

    #[test]
    fn take_crystal_goes_to_depot() {
        let mut game = TestSession::initial().game;
        take_from_orbit_bank(&mut game, 0, OrbitBankKind::Cristal).unwrap();
        assert_eq!(game.orbit_bank.cristal, 2);
        assert_eq!(game.players[0].crystal_depot, 1);
    }

    #[test]
    fn reload_bumps_generation_and_fills() {
        let mut game = TestSession::initial().game;
        game.orbit_bank.eau = 0;
        reload_orbit_bank(&mut game);
        assert_eq!(game.orbit_bank.eau, 3);
        assert_eq!(game.orbit_bank.generation, 1);
    }

    #[test]
    fn level_up_increments_lss_and_reloads_bank() {
        let mut game = TestSession::initial().game;
        game.orbit_bank.cristal = 0;
        let gen = game.orbit_bank.generation;
        level_up_lss(&mut game).unwrap();
        assert_eq!(game.lss_level, 2);
        assert_eq!(game.orbit_bank.cristal, 3);
        assert_eq!(game.orbit_bank.generation, gen + 1);
        set_lss_level(&mut game, LSS_MAX);
        assert!(level_up_lss(&mut game).is_err());
    }
}
