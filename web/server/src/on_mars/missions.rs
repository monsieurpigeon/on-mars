//! Missions et Fin.
use super::constants::{DEFAULT_MISSION_GOAL, DEFAULT_MISSION_TRACKER, MISSION_COUNT};
use super::types::{MissionTracker, OnMarsUiGameState};

pub(crate) fn default_missions() -> Vec<MissionTracker> {
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


pub(crate) fn normalize_missions(game: &mut OnMarsUiGameState) {
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
