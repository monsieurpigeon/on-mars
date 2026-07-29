//! Session UI / test-session du plateau On Mars.
//!
//! Découpage par domaine : types, LSS, abris, blueprints, orbite, missions, API.

pub mod api;
pub mod blueprints;
pub mod buildings;
pub mod constants;
pub mod lss;
pub mod missions;
pub mod orbit;
pub mod resources;
pub mod rovers;
pub mod scientists;
pub mod session;
pub mod shelters;
pub mod techs;
pub mod types;

#[cfg(test)]
mod tests;

pub use api::*;
pub use session::load_from_disk;
pub use types::TestSession;
