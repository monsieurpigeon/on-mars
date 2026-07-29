//! Constantes session UI On Mars.
pub const TEST_SESSION_ID: &str = "test-solo";
pub(crate) const PLAYER_COUNT: usize = 4;
pub(crate) const LSS_MIN: u8 = 1;
pub(crate) const LSS_MAX: u8 = 5;
pub(crate) const MISSION_COUNT: u8 = 3;
pub(crate) const DEFAULT_MISSION_TRACKER: u8 = 10;
pub(crate) const DEFAULT_MISSION_GOAL: u8 = 14;
pub(crate) const ORBIT_BANK_STACK: u8 = 3;
pub(crate) const CRYSTAL_DEPOT_CAPACITY: u8 = 8;
pub(crate) const BLUEPRINT_CLASS1_MAX: u8 = 12;
pub(crate) const BLUEPRINT_CLASS2_MAX: u8 = 24;
pub(crate) const BLUEPRINT_DEAL_COUNT: usize = 6;
pub(crate) const LSS_REWARD_COUNT: u8 = 8;
pub(crate) const LSS_REWARD_TRACK_SIZE: usize = 4;
pub(crate) const CARRY_BASE_CAPACITY: u8 = 2;
pub(crate) const SHELTER_ROW_COUNT: u8 = 6;
pub(crate) const SHELTER_SLOTS_PER_ROW: u8 = 2;
pub(crate) const SHELTER_MAX_INSTALLS: u8 = 4;
pub(crate) const DEFAULT_SHELTER_COLONISTS: u8 = 3;
pub(crate) const DEFAULT_COLON_STOCK: u8 = 9;
/// Rover en stock perso tant qu’il n’est pas sur le plateau (0 ou 1).
pub(crate) const DEFAULT_ROVER_STOCK: u8 = 1;

pub(crate) fn default_shelter_colonists() -> u8 {
    DEFAULT_SHELTER_COLONISTS
}

pub(crate) fn default_colon_stock() -> u8 {
    DEFAULT_COLON_STOCK
}

pub(crate) fn default_rover_stock() -> u8 {
    DEFAULT_ROVER_STOCK
}

pub(crate) fn default_lss_level() -> u8 {
    LSS_MIN
}

pub(crate) fn default_remaining_missions() -> u8 {
    MISSION_COUNT
}
