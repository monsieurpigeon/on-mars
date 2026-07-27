use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayerColor {
    Purple,
    Green,
    Yellow,
    Blue,
}

impl PlayerColor {
    pub fn from_index(i: usize) -> Self {
        match i % 4 {
            0 => PlayerColor::Purple,
            1 => PlayerColor::Green,
            2 => PlayerColor::Yellow,
            _ => PlayerColor::Blue,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Resource {
    Mineral,
    Battery,
    Water,
    Plant,
    Oxygen,
}

impl Resource {
    pub const ALL: [Resource; 5] = [
        Resource::Mineral,
        Resource::Battery,
        Resource::Water,
        Resource::Plant,
        Resource::Oxygen,
    ];

    pub fn index(self) -> usize {
        match self {
            Resource::Mineral => 0,
            Resource::Battery => 1,
            Resource::Water => 2,
            Resource::Plant => 3,
            Resource::Oxygen => 4,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BuildingType {
    Mine,
    Generator,
    WaterExtractor,
    Greenhouse,
    OxygenCondenser,
    Shelter,
}

impl BuildingType {
    pub fn prerequisite(self) -> Option<Resource> {
        match self {
            BuildingType::Mine => None,
            BuildingType::Generator => Some(Resource::Mineral),
            BuildingType::WaterExtractor => Some(Resource::Battery),
            BuildingType::Greenhouse => Some(Resource::Water),
            BuildingType::OxygenCondenser => Some(Resource::Plant),
            BuildingType::Shelter => Some(Resource::Oxygen),
        }
    }

    pub fn produces(self) -> Option<Resource> {
        match self {
            BuildingType::Mine => Some(Resource::Mineral),
            BuildingType::Generator => Some(Resource::Battery),
            BuildingType::WaterExtractor => Some(Resource::Water),
            BuildingType::Greenhouse => Some(Resource::Plant),
            BuildingType::OxygenCondenser => Some(Resource::Oxygen),
            BuildingType::Shelter => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    Orbit,
    Colony,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OmPhase {
    Colonization,
    Shuttle,
    GameEnd,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TurnStep {
    /// May take executive before or after main
    AwaitingActions,
    AwaitingTravelChoice,
    AwaitingTurnOrderPick,
    FinishedTurn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HexCell {
    pub id: u8,
    pub q: i8,
    pub r: i8,
    pub building: Option<BuildingOnHex>,
    pub bot: Option<Uuid>,
    pub rover: Option<Uuid>,
    pub colonist: Option<Uuid>,
    pub advanced_marker: Option<Uuid>,
    pub research_tile: Option<String>,
    pub discovery: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingOnHex {
    pub building_type: BuildingType,
    pub owner: Option<Uuid>,
    pub upgraded: bool,
    pub blueprint_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechTile {
    pub id: String,
    pub tech_type: String,
    pub level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlueprintCard {
    pub id: String,
    pub level: u8,
    pub building_type: BuildingType,
    pub op: i32,
    pub gain: Option<Resource>,
    pub gain_crystal: bool,
    pub executive_id: String,
    pub executive_cost: u8,
    pub marker_owner: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScientistCard {
    pub id: String,
    pub name: String,
    pub specialty: BuildingType,
    pub cost_crystals: u8,
    pub hired_by: Option<Uuid>,
    pub working_on: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarthContract {
    pub id: String,
    pub label: String,
    pub needs: Vec<(Resource, u8)>,
    pub complete_op: i32,
    pub incomplete_op: i32,
    pub owner: Option<Uuid>,
    pub deposited: [u8; 5],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionCard {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub crystals_per_contrib: u8,
    pub tracker: u8,
    pub goal: u8,
    pub contrib_building: Option<BuildingType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivateGoal {
    pub id: String,
    pub title: String,
    pub op: i32,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OmPlayer {
    pub id: Uuid,
    pub nickname: String,
    pub color: PlayerColor,
    pub side: Side,
    pub turn_order_slot: Option<u8>,
    pub op: i32,
    pub storage: [u8; 5],
    pub crystals_depot: u8,
    pub crystals_pending: u8,
    pub depot_capacity: u8,
    pub ships_in_depot: u8,
    pub ships_in_hangar: u8,
    pub ships_welcomed_total: u8,
    pub colonists_living: u8,
    pub colonists_living_cap: u8,
    pub colonists_working: u8,
    pub colonists_supply: u8,
    pub bots_available: u8,
    pub bots_on_map: u8,
    pub rover_hex: Option<u8>,
    pub shelter_count: u8,
    pub lab: Vec<TechTile>,
    pub blueprints: Vec<BlueprintCard>,
    pub advanced_markers_left: u8,
    pub progress_cubes: [u8; 5],
    pub private_goals: Vec<PrivateGoal>,
    pub scientist_ids: Vec<String>,
    pub contracts: Vec<EarthContract>,
    pub main_used: bool,
    pub executive_used: bool,
    pub marker_laid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OnMarsAction {
    PassMain,
    PassExecutive,
    Resupply {
        item: String,
        boost_colonists: u8,
    },
    LearnTech {
        tech_id: String,
        boost: bool,
    },
    ObtainBlueprint {
        blueprint_id: String,
        boost_count: u8,
    },
    ResearchDevelop {
        moves: Vec<TechMove>,
        boost_colonists: u8,
    },
    LandingPod,
    MoveUnits {
        bot_steps: Vec<MoveStep>,
        rover_steps: Vec<MoveStep>,
    },
    ConstructBuilding {
        building_type: BuildingType,
        hex_id: u8,
        use_tech_owner: Option<Uuid>,
        boost_tech_colonists: u8,
    },
    UpgradeBuilding {
        hex_id: u8,
        blueprint_id: String,
    },
    WelcomeShip {
        gain_bot: bool,
        boost_count: u8,
    },
    HireScientist {
        scientist_id: String,
    },
    TakeContract,
    Executive {
        executive_id: String,
        target_hex: Option<u8>,
        scientist_id: Option<String>,
        boost_colonists: u8,
    },
    Travel {
        travel: bool,
    },
    PickTurnOrder {
        slot: u8,
    },
    EndTurn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechMove {
    pub tech_id: String,
    pub steps: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveStep {
    pub from: u8,
    pub to: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionSlotOccupancy {
    pub action_id: String,
    pub colonists: Vec<(Uuid, u8)>,
}
