//! Structures de données de la session UI On Mars.
use serde::{Deserialize, Serialize};

use super::buildings::ColonyBuilding;
use super::rovers::ColonyRover;
use super::constants::{
    CARRY_BASE_CAPACITY, LSS_MAX, LSS_MIN, SHELTER_MAX_INSTALLS,
};

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
    /// Plans / blueprints pris (numéros de cartes 1–24).
    #[serde(default)]
    pub blueprints: Vec<u8>,
    /// Scientifiques pris (types ressource).
    #[serde(default)]
    pub scientists: Vec<ScientistResource>,
    /// Nombre de colons dans les abris (affichage empilé vers le bas, sans positions).
    #[serde(default = "super::constants::default_shelter_colonists")]
    pub shelter_colonists: u8,
    /// Legacy JSON — migré vers `shelter_colonists`, non sérialisé.
    #[serde(default, skip_serializing)]
    pub shelter_occupied: Vec<String>,
    /// Nombre d’abris installés (0–4) — chaque un débloque 2 cases vers le haut.
    #[serde(default)]
    pub shelters_installed: u8,
    /// Colons dans le stock personnel (pas encore placés en abri).
    #[serde(default = "super::constants::default_colon_stock")]
    pub colon_stock: u8,
    /// Rover dans le stock personnel (0 si déjà sur le plateau).
    #[serde(default = "super::constants::default_rover_stock")]
    pub rover_stock: u8,
    /// Tuiles techno placées sur la carte perso.
    #[serde(
        default,
        deserialize_with = "super::techs::deserialize_tech_owned"
    )]
    pub techs: Vec<TechPlacement>,
    /// Colons envoyés au travail.
    #[serde(default)]
    pub working_colonists: u8,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScientistResource {
    Minerai,
    Energie,
    Eau,
    Plante,
    Oxygene,
    Abri,
}

impl ScientistResource {
    pub const ALL: [ScientistResource; 6] = [
        ScientistResource::Minerai,
        ScientistResource::Energie,
        ScientistResource::Eau,
        ScientistResource::Plante,
        ScientistResource::Oxygene,
        ScientistResource::Abri,
    ];
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScientistMarket {
    /// 6 cases fixes ; None = déjà pris (place conservée).
    pub slots: Vec<Option<ScientistResource>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TechKind {
    Minerai,
    Energie,
    Eau,
    Plante,
    Oxygene,
    Rover,
    Fusee,
    Batiment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TechPlacement {
    pub kind: TechKind,
    pub q: i16,
    pub r: i16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TechMarket {
    /// 8 cases piochées au hasard ; None = déjà prise.
    pub slots: Vec<Option<TechKind>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LssResourceTrack {
    pub energie: u8,
    pub eau: u8,
    pub plante: u8,
    pub oxygene: u8,
}

impl Default for LssResourceTrack {
    fn default() -> Self {
        Self {
            energie: LSS_MIN,
            eau: LSS_MIN,
            plante: LSS_MIN,
            oxygene: LSS_MIN,
        }
    }
}

impl LssResourceTrack {
    pub(crate) fn get(&self, kind: ColonyResourceKind) -> Option<u8> {
        match kind {
            ColonyResourceKind::Energie => Some(self.energie),
            ColonyResourceKind::Eau => Some(self.eau),
            ColonyResourceKind::Plante => Some(self.plante),
            ColonyResourceKind::Oxygene => Some(self.oxygene),
            ColonyResourceKind::Minerai => None,
        }
    }

    pub(crate) fn set(&mut self, kind: ColonyResourceKind, level: u8) -> Result<(), &'static str> {
        let level = level.clamp(LSS_MIN, LSS_MAX);
        match kind {
            ColonyResourceKind::Energie => self.energie = level,
            ColonyResourceKind::Eau => self.eau = level,
            ColonyResourceKind::Plante => self.plante = level,
            ColonyResourceKind::Oxygene => self.oxygene = level,
            ColonyResourceKind::Minerai => return Err("not a track resource"),
        }
        Ok(())
    }

    pub(crate) fn min_level(&self) -> u8 {
        *[self.energie, self.eau, self.plante, self.oxygene]
            .iter()
            .min()
            .unwrap_or(&LSS_MIN)
    }

    pub(crate) fn clamp_all(&mut self) {
        self.energie = self.energie.clamp(LSS_MIN, LSS_MAX);
        self.eau = self.eau.clamp(LSS_MIN, LSS_MAX);
        self.plante = self.plante.clamp(LSS_MIN, LSS_MAX);
        self.oxygene = self.oxygene.clamp(LSS_MIN, LSS_MAX);
    }
}

/// Indices joueurs ayant placé un jeton sous chaque ressource LSS.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LssPlayerTokens {
    pub minerai: Vec<u8>,
    pub energie: Vec<u8>,
    pub eau: Vec<u8>,
    pub plante: Vec<u8>,
    pub oxygene: Vec<u8>,
}

impl Default for LssPlayerTokens {
    fn default() -> Self {
        Self {
            minerai: Vec::new(),
            energie: Vec::new(),
            eau: Vec::new(),
            plante: Vec::new(),
            oxygene: Vec::new(),
        }
    }
}

impl LssPlayerTokens {
    pub(crate) fn get_mut(&mut self, kind: ColonyResourceKind) -> &mut Vec<u8> {
        match kind {
            ColonyResourceKind::Minerai => &mut self.minerai,
            ColonyResourceKind::Energie => &mut self.energie,
            ColonyResourceKind::Eau => &mut self.eau,
            ColonyResourceKind::Plante => &mut self.plante,
            ColonyResourceKind::Oxygene => &mut self.oxygene,
        }
    }

    pub(crate) fn normalize(&mut self) {
        for kind in ColonyResourceKind::ALL {
            let slot = self.get_mut(kind);
            slot.retain(|&i| (i as usize) < super::constants::PLAYER_COUNT);
            slot.sort_unstable();
            slot.dedup();
        }
    }
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
    #[serde(default = "super::constants::default_lss_level")]
    pub lss_level: u8,
    /// Compteurs des 3 missions (A/B/C).
    #[serde(default = "super::missions::default_missions")]
    pub missions: Vec<MissionTracker>,
    /// Missions encore ouvertes — affiché en Fin comme remaining/3.
    #[serde(default = "super::constants::default_remaining_missions")]
    pub remaining_missions: u8,
    /// Banque / stock orbite (colonnes de 3).
    #[serde(default)]
    pub orbit_bank: OrbitBank,
    /// Marché / pioche des plans (24 cartes).
    #[serde(default = "super::blueprints::default_blueprints")]
    pub blueprints: BlueprintMarket,
    /// Marché des scientifiques (6 cases fixes).
    #[serde(default = "super::scientists::default_scientists")]
    pub scientists: ScientistMarket,
    /// Marché Techno — 8 tuiles piochées au hasard.
    #[serde(default = "super::techs::default_tech_market")]
    pub tech_market: TechMarket,
    /// Les 8 tokens récompense LSS (1–8).
    #[serde(default = "super::lss::default_lss_rewards")]
    pub lss_rewards: Vec<u8>,
    /// 4 tokens piochés en début de partie (gauche → droite), figés.
    #[serde(default = "super::lss::default_lss_reward_row")]
    pub lss_reward_row: Vec<u8>,
    /// Position (1–5) des tokens ressource sur la piste LSS.
    #[serde(default = "super::lss::default_lss_resource_track")]
    pub lss_resource_track: LssResourceTrack,
    /// Jetons joueurs placés sous chaque ressource LSS (indices 0–3).
    #[serde(default = "super::lss::default_lss_player_tokens")]
    pub lss_player_tokens: LssPlayerTokens,
    /// Bâtiments placés sur la grille hex (départ : vide).
    #[serde(default = "super::buildings::default_colony_buildings")]
    pub colony_buildings: Vec<ColonyBuilding>,
    /// Rovers : exactement un par joueur, position persistée.
    #[serde(default = "super::rovers::default_colony_rovers")]
    pub colony_rovers: Vec<ColonyRover>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlueprintMarket {
    /// Ligne 1 — 6 emplacements (None = vide, place conservée).
    #[serde(default)]
    pub row_blue: Vec<Option<u8>>,
    /// Ligne 2 — 6 emplacements (None = vide, place conservée).
    #[serde(default)]
    pub row_red: Vec<Option<u8>>,
    /// Ancien champ plat (migration).
    #[serde(default, skip_serializing)]
    pub market: Vec<u8>,
    pub deck: Vec<u8>,
    pub discarded: Vec<u8>,
    /// Phase de service : 1 (début), 2 (LSS≥2), 3 (LSS≥3).
    pub deal_phase: u8,
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
pub struct AdvanceLssResourceBody {
    pub resource: ColonyResourceKind,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceLssPlayerTokenBody {
    pub player_index: u8,
    pub resource: ColonyResourceKind,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeBlueprintBody {
    pub player_index: u8,
    pub card_id: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeScientistBody {
    pub player_index: u8,
    pub resource: ScientistResource,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeTechBody {
    pub player_index: u8,
    pub kind: TechKind,
    /// Requis pour la ligne haute : énergie / eau / plante / oxygène.
    #[serde(default)]
    pub pay_resource: Option<ColonyResourceKind>,
    /// Case de placement sur la carte tech perso (une des 2 à gauche).
    pub q: i16,
    pub r: i16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvanceTechBody {
    pub player_index: u8,
    pub kind: TechKind,
    pub q: i16,
    pub r: i16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallShelterBody {
    pub player_index: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceColonBody {
    pub player_index: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveRoverBody {
    pub player_index: u8,
    pub q: i16,
    pub r: i16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendColonToWorkBody {
    pub player_index: u8,
}


pub(crate) fn clamp_shelters_installed(n: u8) -> u8 {
    n.min(SHELTER_MAX_INSTALLS)
}

/// Capacité de portage = base + abris installés (le LSS n’ajoute plus de slots).
pub fn carry_capacity(shelters_installed: u8) -> u8 {
    CARRY_BASE_CAPACITY.saturating_add(clamp_shelters_installed(shelters_installed))
}

pub fn clamp_lss_level(level: u8) -> u8 {
    level.clamp(LSS_MIN, LSS_MAX)
}
