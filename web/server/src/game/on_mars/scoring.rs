use super::engine::OnMarsState;
use super::types::*;

pub fn apply_final_scoring(state: &mut OnMarsState) {
    // Snapshot building counts for scientists
    let mut advanced_by_type = [0u8; 6];
    for h in &state.hexes {
        if let Some(b) = &h.building {
            if b.upgraded {
                let idx = match b.building_type {
                    BuildingType::Mine => 0,
                    BuildingType::Generator => 1,
                    BuildingType::WaterExtractor => 2,
                    BuildingType::Greenhouse => 3,
                    BuildingType::OxygenCondenser => 4,
                    BuildingType::Shelter => 5,
                };
                advanced_by_type[idx] += 1;
            }
        }
    }

    let player_ids: Vec<_> = state.players.iter().map(|p| p.id).collect();
    for pid in player_ids {
        let Some(p) = state.players.iter_mut().find(|p| p.id == pid) else {
            continue;
        };

        // Progress cubes triangular-ish OP
        let progress_total: u8 = p.progress_cubes.iter().sum();
        p.op += match progress_total {
            0 => 0,
            1 => 1,
            2 => 2,
            3 => 4,
            4 => 7,
            _ => 11,
        };

        // Ships in hangar
        p.op += (p.ships_in_hangar as i32) * 3;

        // Colonists in living quarters (highest slot value stub)
        p.op += match p.colonists_living {
            0 => 0,
            1..=2 => 2,
            3..=4 => 5,
            5..=6 => 8,
            _ => 10,
        };

        // Tech columns: level maps to OP roughly 0/1/2/4/7/9
        for t in &p.lab {
            p.op += match t.level {
                1 => 0,
                2 => 1,
                3 => 2,
                4 => 4,
                5 => 7,
                _ => 9,
            };
        }

        // Advanced buildings / unbuilt blueprints
        for bp in &p.blueprints {
            if bp.marker_owner.is_none() {
                // built (marker removed to hex)
                p.op += bp.op;
            } else {
                // unbuilt penalty
                p.op -= if bp.level == 1 { 3 } else { 5 };
            }
        }

        // Private goals
        for g in &mut p.private_goals {
            let done = match g.title.as_str() {
                "3 shelters" => p.shelter_count >= 3,
                "Tech level 4+" => p.lab.iter().any(|t| t.level >= 4),
                "2 ships hangar" => p.ships_in_hangar >= 2,
                _ => false,
            };
            g.completed = done;
            if done {
                p.op += g.op;
            }
        }

        // Contracts
        for c in &mut p.contracts {
            let mut ok = true;
            for (res, need) in &c.needs {
                if p.storage[res.index()] < *need {
                    ok = false;
                    break;
                }
            }
            if ok {
                for (res, need) in &c.needs {
                    p.storage[res.index()] = p.storage[res.index()].saturating_sub(*need);
                }
                p.op += c.complete_op;
            } else {
                p.op += c.incomplete_op;
            }
        }
    }

    // Scientists score by specialty advanced buildings on Mars
    let sci = state.scientists.clone();
    for s in sci {
        if let Some(owner) = s.hired_by {
            let idx = match s.specialty {
                BuildingType::Mine => 0,
                BuildingType::Generator => 1,
                BuildingType::WaterExtractor => 2,
                BuildingType::Greenhouse => 3,
                BuildingType::OxygenCondenser => 4,
                BuildingType::Shelter => 5,
            };
            let pts = (advanced_by_type[idx] as i32) * 3;
            if let Some(p) = state.players.iter_mut().find(|p| p.id == owner) {
                p.op += pts;
            }
        }
    }
}
