use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::types::*;
use super::scoring;

const MAX_ROUNDS_TEMP: u8 = 12;
const HEX_COUNT: u8 = 19;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnMarsState {
    pub player_count: u8,
    pub phase: OmPhase,
    pub turn_step: TurnStep,
    pub round: u8,
    pub colony_level: u8,
    pub remaining_missions: u8,
    pub shuttle_side: Side,
    pub shuttle_steps_to_travel: u8,
    /// Turn order slots 1..=8 → player id
    pub turn_order: [Option<Uuid>; 8],
    pub colonization_queue: Vec<Uuid>,
    pub active_player: Option<Uuid>,
    pub warehouse: Warehouse,
    pub tech_grid: Vec<TechGridSlot>,
    pub blueprint_display: Vec<BlueprintCard>,
    pub blueprint_deck_left: u8,
    pub hexes: Vec<HexCell>,
    pub action_slots: Vec<ActionSlotOccupancy>,
    pub scientists: Vec<ScientistCard>,
    pub contract_deck_left: u8,
    pub missions: Vec<MissionCard>,
    pub players: Vec<OmPlayer>,
    pub winner_ids: Vec<Uuid>,
    pub legal_actions: Vec<OnMarsAction>,
    pub log: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Warehouse {
    pub crystals: u8,
    pub resources: [u8; 5],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechGridSlot {
    pub tech: Option<TechTile>,
    pub row: u8,
    pub cost_battery: u8,
    pub cost_any: u8,
}

impl OnMarsState {
    pub fn setup(player_ids: &[Uuid], nicknames: &[String]) -> Self {
        let n = player_ids.len() as u8;
        let warehouse_each = if n == 2 { 2 } else { 3 };

        let mut hexes = build_hexes();
        // Starting mine in center (hex 9)
        hexes[9].building = Some(BuildingOnHex {
            building_type: BuildingType::Mine,
            owner: None,
            upgraded: false,
            blueprint_id: None,
        });
        // Starting generators / water / etc on fixed hexes
        for (hid, bt) in [
            (4, BuildingType::Generator),
            (7, BuildingType::WaterExtractor),
            (11, BuildingType::Greenhouse),
            (14, BuildingType::OxygenCondenser),
        ] {
            hexes[hid].building = Some(BuildingOnHex {
                building_type: bt,
                owner: None,
                upgraded: false,
                blueprint_id: None,
            });
        }

        let mut players = Vec::new();
        for (i, &id) in player_ids.iter().enumerate() {
            let color = PlayerColor::from_index(i);
            let shelter_hex = match (n, i) {
                (2, 0) => 1u8,
                (2, 1) => 17,
                (3, 0) => 1,
                (3, 1) => 10,
                (3, 2) => 17,
                (_, 0) => 0,
                (_, 1) => 6,
                (_, 2) => 12,
                (_, _) => 18,
            };
            hexes[shelter_hex as usize].building = Some(BuildingOnHex {
                building_type: BuildingType::Shelter,
                owner: Some(id),
                upgraded: false,
                blueprint_id: None,
            });
            hexes[shelter_hex as usize].bot = Some(id);

            let lab = vec![TechTile {
                id: format!("shelter-{}", i),
                tech_type: "shelter".into(),
                level: 2,
            }];
            // starter progress
            let _ = lab;

            players.push(OmPlayer {
                id,
                nickname: nicknames.get(i).cloned().unwrap_or_else(|| format!("P{}", i + 1)),
                color,
                side: Side::Orbit,
                turn_order_slot: None,
                op: 0,
                storage: [1, 1, 1, 1, 1],
                crystals_depot: 1,
                crystals_pending: 0,
                depot_capacity: 3,
                ships_in_depot: 5,
                ships_in_hangar: 0,
                ships_welcomed_total: 0,
                colonists_living: 3,
                colonists_living_cap: 4,
                colonists_working: 0,
                colonists_supply: 9,
                bots_available: 3,
                bots_on_map: 1,
                rover_hex: None,
                shelter_count: 1,
                lab: vec![TechTile {
                    id: format!("shelter-tech-{i}"),
                    tech_type: "shelter".into(),
                    level: 2,
                }],
                blueprints: vec![],
                advanced_markers_left: 8,
                progress_cubes: [0; 5],
                private_goals: default_private_goals(i),
                scientist_ids: vec![],
                contracts: vec![],
                main_used: false,
                executive_used: false,
                marker_laid: false,
            });
        }

        // Initial turn order: assign slots 1..n on orbit side
        let mut turn_order = [None; 8];
        for (i, p) in players.iter_mut().enumerate() {
            let slot = i as u8; // 0-based slots 0..=3 orbit
            turn_order[slot as usize] = Some(p.id);
            p.turn_order_slot = Some(slot);
            p.side = Side::Orbit;
        }

        let tech_grid = default_tech_grid(n == 2);
        let blueprint_display = default_blueprints();
        let scientists = default_scientists();
        let missions = default_missions(n);

        let mut state = Self {
            player_count: n,
            phase: OmPhase::Colonization,
            turn_step: TurnStep::AwaitingActions,
            round: 1,
            colony_level: 1,
            remaining_missions: 3,
            shuttle_side: Side::Orbit,
            shuttle_steps_to_travel: 2,
            turn_order,
            colonization_queue: Vec::new(),
            active_player: None,
            warehouse: Warehouse {
                crystals: warehouse_each,
                resources: [warehouse_each; 5],
            },
            tech_grid,
            blueprint_display,
            blueprint_deck_left: 18,
            hexes,
            action_slots: default_action_slots(),
            scientists,
            contract_deck_left: 12,
            missions,
            players,
            winner_ids: vec![],
            legal_actions: vec![],
            log: vec!["Partie On Mars démarrée".into()],
        };
        state.begin_colonization_round();
        state.refresh_legal();
        state
    }

    fn begin_colonization_round(&mut self) {
        self.phase = OmPhase::Colonization;
        self.colonization_queue = self
            .turn_order
            .iter()
            .flatten()
            .copied()
            .collect();
        for p in &mut self.players {
            p.main_used = false;
            p.executive_used = false;
            p.marker_laid = false;
            // move pending crystals into depot
            let space = p.depot_capacity.saturating_sub(p.crystals_depot);
            let move_amt = p.crystals_pending.min(space);
            p.crystals_depot += move_amt;
            p.crystals_pending -= move_amt;
        }
        self.start_next_player_turn();
    }

    fn start_next_player_turn(&mut self) {
        while let Some(pid) = self.colonization_queue.first().copied() {
            if self
                .players
                .iter()
                .any(|p| p.id == pid && !p.marker_laid)
            {
                self.active_player = Some(pid);
                self.turn_step = TurnStep::AwaitingActions;
                // pending crystals already moved at round start; also at turn start for mid-gains
                if let Some(p) = self.player_mut(pid) {
                    let space = p.depot_capacity.saturating_sub(p.crystals_depot);
                    let move_amt = p.crystals_pending.min(space);
                    p.crystals_depot += move_amt;
                    p.crystals_pending = p.crystals_pending.saturating_sub(move_amt);
                    p.main_used = false;
                    p.executive_used = false;
                }
                return;
            }
            self.colonization_queue.remove(0);
        }
        self.begin_shuttle_phase();
    }

    fn begin_shuttle_phase(&mut self) {
        self.phase = OmPhase::Shuttle;
        if self.shuttle_steps_to_travel == 0 {
            // travel
            self.shuttle_side = match self.shuttle_side {
                Side::Orbit => Side::Colony,
                Side::Colony => Side::Orbit,
            };
            self.shuttle_steps_to_travel = match self.colony_level {
                1 => 2,
                2 => 2,
                3 => 3,
                _ => 3,
            };
            self.log.push(format!(
                "La navette voyage vers {:?}",
                self.shuttle_side
            ));
        } else {
            self.shuttle_steps_to_travel -= 1;
            self.log.push("La navette avance".into());
        }

        self.colonization_queue = self
            .turn_order
            .iter()
            .flatten()
            .copied()
            .collect();
        self.turn_step = TurnStep::AwaitingTravelChoice;
        self.active_player = self.colonization_queue.first().copied();
        if self.active_player.is_none() {
            self.finish_shuttle_and_next_round();
        }
    }

    fn finish_shuttle_and_next_round(&mut self) {
        // Return working colonists home for travelers already handled
        self.round += 1;
        if self.round > MAX_ROUNDS_TEMP || self.remaining_missions == 0 {
            self.end_game();
            return;
        }
        self.begin_colonization_round();
    }

    fn end_game(&mut self) {
        self.phase = OmPhase::GameEnd;
        self.turn_step = TurnStep::FinishedTurn;
        self.active_player = None;
        scoring::apply_final_scoring(self);
        let mut ranked = self.players.clone();
        ranked.sort_by(|a, b| {
            b.op.cmp(&a.op)
                .then(b.crystals_depot.cmp(&a.crystals_depot))
                .then(b.blueprints.iter().filter(|bp| bp.marker_owner.is_none()).count().cmp(
                    &a.blueprints.iter().filter(|bp| bp.marker_owner.is_none()).count(),
                ))
        });
        if let Some(best) = ranked.first() {
            let best_op = best.op;
            self.winner_ids = ranked
                .iter()
                .filter(|p| p.op == best_op)
                .map(|p| p.id)
                .collect();
        }
        self.log.push("Fin de partie — scoring appliqué".into());
        self.legal_actions.clear();
    }

    pub fn player(&self, id: Uuid) -> Option<&OmPlayer> {
        self.players.iter().find(|p| p.id == id)
    }

    pub fn player_mut(&mut self, id: Uuid) -> Option<&mut OmPlayer> {
        self.players.iter_mut().find(|p| p.id == id)
    }

    pub fn storage_limit(player: &OmPlayer) -> u8 {
        player.shelter_count + 1
    }

    pub fn refresh_legal(&mut self) {
        self.legal_actions = self.compute_legal();
    }

    fn compute_legal(&self) -> Vec<OnMarsAction> {
        let Some(pid) = self.active_player else {
            return vec![];
        };
        let Some(p) = self.player(pid) else {
            return vec![];
        };

        match self.phase {
            OmPhase::GameEnd => vec![],
            OmPhase::Shuttle => match self.turn_step {
                TurnStep::AwaitingTravelChoice => {
                    vec![
                        OnMarsAction::Travel { travel: true },
                        OnMarsAction::Travel { travel: false },
                    ]
                }
                TurnStep::AwaitingTurnOrderPick => {
                    let side = p.side;
                    let range = match side {
                        Side::Orbit => 0u8..4,
                        Side::Colony => 4u8..8,
                    };
                    range
                        .filter(|&s| self.turn_order[s as usize].is_none())
                        .map(|slot| OnMarsAction::PickTurnOrder { slot })
                        .collect()
                }
                _ => vec![OnMarsAction::EndTurn],
            },
            OmPhase::Colonization => {
                let mut acts = Vec::new();
                if !p.executive_used {
                    acts.push(OnMarsAction::PassExecutive);
                    // base executives from unlocked depot slots
                    let unlocked = 8u8.saturating_sub(p.ships_in_depot);
                    if unlocked >= 1 && p.crystals_depot >= 1 {
                        acts.push(OnMarsAction::Executive {
                            executive_id: "gain_mineral".into(),
                            target_hex: None,
                            scientist_id: None,
                            boost_colonists: 0,
                        });
                    }
                    if unlocked >= 2 && p.crystals_depot >= 2 {
                        acts.push(OnMarsAction::Executive {
                            executive_id: "use_advanced".into(),
                            target_hex: None,
                            scientist_id: p.scientist_ids.first().cloned(),
                            boost_colonists: 0,
                        });
                    }
                    // scientist-assisted free executive on any advanced
                    for bp in self.players.iter().flat_map(|pl| pl.blueprints.iter()) {
                        if bp.marker_owner.is_none() {
                            if let Some(sid) = p.scientist_ids.first() {
                                acts.push(OnMarsAction::Executive {
                                    executive_id: bp.executive_id.clone(),
                                    target_hex: None,
                                    scientist_id: Some(sid.clone()),
                                    boost_colonists: 0,
                                });
                            }
                        }
                    }
                }
                if !p.main_used {
                    acts.push(OnMarsAction::PassMain);
                    match p.side {
                        Side::Orbit => {
                            // Resupply
                            if self.warehouse.crystals > 0 {
                                acts.push(OnMarsAction::Resupply {
                                    item: "crystal".into(),
                                    boost_colonists: 0,
                                });
                            }
                            for (i, &amt) in self.warehouse.resources.iter().enumerate() {
                                if amt > 0 {
                                    let name = match i {
                                        0 => "mineral",
                                        1 => "battery",
                                        2 => "water",
                                        3 => "plant",
                                        _ => "oxygen",
                                    };
                                    acts.push(OnMarsAction::Resupply {
                                        item: name.into(),
                                        boost_colonists: 0,
                                    });
                                }
                            }
                            for slot in &self.tech_grid {
                                if let Some(t) = &slot.tech {
                                    if !p.lab.iter().any(|l| l.tech_type == t.tech_type) {
                                        acts.push(OnMarsAction::LearnTech {
                                            tech_id: t.id.clone(),
                                            boost: false,
                                        });
                                    }
                                }
                            }
                            for bp in &self.blueprint_display {
                                if p.advanced_markers_left > 0 {
                                    acts.push(OnMarsAction::ObtainBlueprint {
                                        blueprint_id: bp.id.clone(),
                                        boost_count: 0,
                                    });
                                }
                            }
                            // R&D
                            if !p.lab.is_empty() {
                                acts.push(OnMarsAction::ResearchDevelop {
                                    moves: vec![],
                                    boost_colonists: 0,
                                });
                            }
                            acts.push(OnMarsAction::LandingPod);
                            acts.push(OnMarsAction::HireScientist {
                                scientist_id: String::new(),
                            });
                            acts.push(OnMarsAction::TakeContract);
                        }
                        Side::Colony => {
                            acts.push(OnMarsAction::MoveUnits {
                                bot_steps: vec![],
                                rover_steps: vec![],
                            });
                            for bt in [
                                BuildingType::Mine,
                                BuildingType::Generator,
                                BuildingType::WaterExtractor,
                                BuildingType::Greenhouse,
                                BuildingType::OxygenCondenser,
                                BuildingType::Shelter,
                            ] {
                                for h in &self.hexes {
                                    if h.building.is_none()
                                        && h.bot.is_none()
                                        && h.rover.is_none()
                                        && can_construct(p, bt)
                                    {
                                        acts.push(OnMarsAction::ConstructBuilding {
                                            building_type: bt,
                                            hex_id: h.id,
                                            use_tech_owner: None,
                                            boost_tech_colonists: 0,
                                        });
                                    }
                                }
                            }
                            for h in &self.hexes {
                                if let Some(b) = &h.building {
                                    if b.owner == Some(pid) && !b.upgraded {
                                        for bp in &p.blueprints {
                                            if bp.marker_owner == Some(pid)
                                                && bp.building_type == b.building_type
                                            {
                                                acts.push(OnMarsAction::UpgradeBuilding {
                                                    hex_id: h.id,
                                                    blueprint_id: bp.id.clone(),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            if p.ships_in_depot > 0
                                && p.ships_welcomed_total < self.colony_level
                                && p.storage[Resource::Plant.index()] > 0
                                && p.storage[Resource::Water.index()] > 0
                            {
                                acts.push(OnMarsAction::WelcomeShip {
                                    gain_bot: true,
                                    boost_count: 0,
                                });
                            }
                            acts.push(OnMarsAction::HireScientist {
                                scientist_id: String::new(),
                            });
                            acts.push(OnMarsAction::TakeContract);
                        }
                    }
                }
                if p.main_used {
                    acts.push(OnMarsAction::EndTurn);
                }
                // Dedup construct spam — keep first 12 construct options only
                let mut constructs = 0;
                acts.retain(|a| match a {
                    OnMarsAction::ConstructBuilding { .. } => {
                        constructs += 1;
                        constructs <= 12
                    }
                    _ => true,
                });
                acts
            }
        }
    }

    pub fn apply(&mut self, player_id: Uuid, action: OnMarsAction) -> Result<(), &'static str> {
        if self.active_player != Some(player_id) {
            return Err("Ce n'est pas ton tour");
        }
        // Allow EndTurn / Travel / Pick even if not in legal list edge cases
        let legal = self.compute_legal();
        let allowed = legal.iter().any(|a| actions_compatible(a, &action))
            || matches!(
                action,
                OnMarsAction::EndTurn
                    | OnMarsAction::PassMain
                    | OnMarsAction::PassExecutive
                    | OnMarsAction::Travel { .. }
                    | OnMarsAction::PickTurnOrder { .. }
                    | OnMarsAction::ResearchDevelop { .. }
                    | OnMarsAction::MoveUnits { .. }
                    | OnMarsAction::HireScientist { .. }
                    | OnMarsAction::Resupply { .. }
            );
        if !allowed {
            return Err("Action illégale");
        }

        match action {
            OnMarsAction::PassMain => {
                let p = self.player_mut(player_id).ok_or("Joueur introuvable")?;
                if p.main_used {
                    return Err("Action principale déjà jouée");
                }
                p.main_used = true;
            }
            OnMarsAction::PassExecutive => {
                let p = self.player_mut(player_id).ok_or("Joueur introuvable")?;
                if p.executive_used {
                    return Err("Executive déjà jouée");
                }
                p.executive_used = true;
            }
            OnMarsAction::Resupply {
                item,
                boost_colonists,
            } => {
                self.require_side(player_id, Side::Orbit)?;
                self.pay_red_colonist(player_id, "resupply")?;
                let total = 1 + boost_colonists;
                self.spend_teal(player_id, boost_colonists)?;
                for _ in 0..total {
                    self.take_warehouse_item(player_id, &item)?;
                }
                self.mark_main(player_id)?;
            }
            OnMarsAction::LearnTech { tech_id, boost } => {
                self.require_side(player_id, Side::Orbit)?;
                self.pay_red_colonist(player_id, "learn_tech")?;
                self.take_tech(player_id, &tech_id)?;
                if boost {
                    self.spend_teal(player_id, 1)?;
                    // second free-ish: take cheapest remaining
                    if let Some(id) = self
                        .tech_grid
                        .iter()
                        .find_map(|s| s.tech.as_ref().map(|t| t.id.clone()))
                    {
                        let _ = self.take_tech(player_id, &id);
                    }
                }
                self.mark_main(player_id)?;
            }
            OnMarsAction::ObtainBlueprint {
                blueprint_id,
                boost_count,
            } => {
                self.require_side(player_id, Side::Orbit)?;
                self.pay_red_colonist(player_id, "blueprint")?;
                self.take_blueprint(player_id, &blueprint_id)?;
                self.spend_teal(player_id, boost_count)?;
                for _ in 0..boost_count {
                    if let Some(id) = self.blueprint_display.first().map(|b| b.id.clone()) {
                        let _ = self.take_blueprint(player_id, &id);
                    }
                }
                self.mark_main(player_id)?;
            }
            OnMarsAction::ResearchDevelop {
                moves,
                boost_colonists,
            } => {
                self.require_side(player_id, Side::Orbit)?;
                self.pay_red_colonist(player_id, "rd")?;
                let mut develop_count = 2u8;
                self.spend_teal(player_id, boost_colonists)?;
                develop_count += boost_colonists;
                if moves.is_empty() {
                    // auto-develop first tech once or twice
                    if let Some(tid) = self.player(player_id).and_then(|p| p.lab.first().map(|t| t.id.clone())) {
                        for _ in 0..develop_count.min(2) {
                            let _ = self.develop_tech(player_id, &tid);
                        }
                    }
                } else {
                    let mut left = develop_count;
                    for m in moves {
                        for _ in 0..m.steps {
                            if left == 0 {
                                break;
                            }
                            self.develop_tech(player_id, &m.tech_id)?;
                            left -= 1;
                        }
                    }
                }
                self.mark_main(player_id)?;
            }
            OnMarsAction::LandingPod => {
                self.require_side(player_id, Side::Orbit)?;
                // Travel to colony without shuttle step 1
                let old_slot = self.player(player_id).and_then(|p| p.turn_order_slot);
                if let Some(slot) = old_slot {
                    self.turn_order[slot as usize] = None;
                }
                if let Some(p) = self.player_mut(player_id) {
                    p.side = Side::Colony;
                    p.turn_order_slot = None;
                }
                // pick first free colony slot
                let slot = (4..8).find(|&s| self.turn_order[s].is_none()).ok_or("Pas de place Colony")?;
                self.turn_order[slot] = Some(player_id);
                if let Some(p) = self.player_mut(player_id) {
                    p.turn_order_slot = Some(slot as u8);
                    p.side = Side::Colony;
                    p.main_used = true;
                    p.marker_laid = true;
                }
                self.return_working_colonists(player_id);
                self.log.push("Landing Pod → Colony".into());
                self.finish_player_turn(player_id);
            }
            OnMarsAction::MoveUnits {
                bot_steps,
                rover_steps,
            } => {
                self.require_side(player_id, Side::Colony)?;
                self.pay_red_colonist(player_id, "control")?;
                let mut bot_mp = 2i32;
                let mut rover_mp = 2i32;
                for step in bot_steps {
                    if bot_mp <= 0 {
                        break;
                    }
                    self.move_piece(player_id, step.from, step.to, true)?;
                    bot_mp -= 1;
                }
                for step in rover_steps {
                    if rover_mp <= 0 {
                        break;
                    }
                    self.move_piece(player_id, step.from, step.to, false)?;
                    rover_mp -= 1;
                }
                // If no steps provided, place rover on empty hex near shelter or move bot one step auto
                if bot_mp == 2 && rover_mp == 2 {
                    self.auto_move_bot(player_id);
                }
                self.mark_main(player_id)?;
            }
            OnMarsAction::ConstructBuilding {
                building_type,
                hex_id,
                use_tech_owner,
                boost_tech_colonists,
            } => {
                self.require_side(player_id, Side::Colony)?;
                self.pay_red_colonist(player_id, "construct")?;
                self.construct(player_id, building_type, hex_id, use_tech_owner, boost_tech_colonists)?;
                self.mark_main(player_id)?;
            }
            OnMarsAction::UpgradeBuilding {
                hex_id,
                blueprint_id,
            } => {
                self.require_side(player_id, Side::Colony)?;
                self.pay_red_colonist(player_id, "upgrade")?;
                self.upgrade(player_id, hex_id, &blueprint_id)?;
                self.mark_main(player_id)?;
            }
            OnMarsAction::WelcomeShip {
                gain_bot,
                boost_count,
            } => {
                self.require_side(player_id, Side::Colony)?;
                self.pay_red_colonist(player_id, "ship")?;
                let times = 1 + boost_count;
                self.spend_teal(player_id, boost_count)?;
                for _ in 0..times {
                    self.welcome_ship(player_id, gain_bot)?;
                }
                self.mark_main(player_id)?;
            }
            OnMarsAction::HireScientist { scientist_id } => {
                self.pay_red_colonist(player_id, "scientist")?;
                let id = if scientist_id.is_empty() {
                    self.scientists
                        .iter()
                        .find(|s| s.hired_by.is_none())
                        .map(|s| s.id.clone())
                        .ok_or("Aucun scientifique disponible")?
                } else {
                    scientist_id
                };
                self.hire_scientist(player_id, &id)?;
                self.mark_main(player_id)?;
            }
            OnMarsAction::TakeContract => {
                self.pay_red_colonist(player_id, "contract")?;
                self.give_contract(player_id)?;
                self.mark_main(player_id)?;
            }
            OnMarsAction::Executive {
                executive_id,
                target_hex: _,
                scientist_id,
                boost_colonists,
            } => {
                let p = self.player_mut(player_id).ok_or("Joueur")?;
                if p.executive_used {
                    return Err("Executive déjà utilisée");
                }
                let free = scientist_id.as_ref().is_some();
                if !free {
                    let cost = if executive_id == "gain_mineral" { 1 } else { 2 };
                    if p.crystals_depot < cost {
                        return Err("Pas assez de cristaux");
                    }
                    p.crystals_depot -= cost;
                }
                self.spend_teal(player_id, boost_colonists)?;
                if let Some(sid) = scientist_id {
                    if let Some(s) = self.scientists.iter_mut().find(|s| s.id == sid) {
                        s.working_on = Some(executive_id.clone());
                    }
                }
                match executive_id.as_str() {
                    "gain_mineral" => {
                        self.gain_resource(player_id, Resource::Mineral, 1);
                    }
                    "use_advanced" | "construct_bonus" => {
                        // gain 1 OP or construct helper resource
                        if let Some(p) = self.player_mut(player_id) {
                            p.op += 1;
                        }
                    }
                    _ => {
                        if let Some(p) = self.player_mut(player_id) {
                            p.op += 1;
                        }
                    }
                }
                if let Some(p) = self.player_mut(player_id) {
                    p.executive_used = true;
                }
            }
            OnMarsAction::Travel { travel } => {
                if self.phase != OmPhase::Shuttle || self.turn_step != TurnStep::AwaitingTravelChoice
                {
                    return Err("Pas la phase voyage");
                }
                if travel {
                    let ride_free = self
                        .player(player_id)
                        .map(|p| p.side != self.shuttle_side)
                        .unwrap_or(false);
                    if !ride_free {
                        let p = self.player_mut(player_id).ok_or("Joueur")?;
                        if p.ships_in_hangar == 0 {
                            return Err("Il faut un vaisseau dans le Hangar pour voyager");
                        }
                        p.ships_in_hangar -= 1;
                    }
                    let new_side = match self.player(player_id).map(|p| p.side) {
                        Some(Side::Orbit) => Side::Colony,
                        _ => Side::Orbit,
                    };
                    let old_slot = self.player(player_id).and_then(|p| p.turn_order_slot);
                    if let Some(slot) = old_slot {
                        self.turn_order[slot as usize] = None;
                    }
                    if let Some(p) = self.player_mut(player_id) {
                        p.turn_order_slot = None;
                        p.side = new_side;
                    }
                    // production when traveling to orbit
                    if new_side == Side::Orbit {
                        self.produce_on_travel_to_orbit(player_id);
                    }
                    self.return_working_colonists(player_id);
                    self.turn_step = TurnStep::AwaitingTurnOrderPick;
                } else {
                    // stay — stand marker
                    self.advance_shuttle_player();
                }
            }
            OnMarsAction::PickTurnOrder { slot } => {
                if self.turn_step != TurnStep::AwaitingTurnOrderPick {
                    return Err("Pas le moment de choisir l'ordre");
                }
                let side = self.player(player_id).map(|p| p.side).ok_or("Joueur")?;
                let ok = match side {
                    Side::Orbit => slot < 4,
                    Side::Colony => (4..8).contains(&slot),
                };
                if !ok || self.turn_order[slot as usize].is_some() {
                    return Err("Emplacement d'ordre invalide");
                }
                self.turn_order[slot as usize] = Some(player_id);
                if let Some(p) = self.player_mut(player_id) {
                    p.turn_order_slot = Some(slot);
                    // turn order bonus
                    p.crystals_pending += 1;
                    p.op += 1;
                }
                self.advance_shuttle_player();
            }
            OnMarsAction::EndTurn => {
                let p = self.player(player_id).ok_or("Joueur")?;
                if self.phase == OmPhase::Colonization && !p.main_used {
                    return Err("Tu dois faire (ou passer) l'action principale");
                }
                self.finish_player_turn(player_id);
            }
        }

        self.check_missions();
        self.check_colony_level();
        if self.remaining_missions == 0 {
            // trigger end after round — mark for end after shuttle
            self.log.push("3 missions complétées — dernière manche".into());
        }
        self.refresh_legal();
        Ok(())
    }

    fn advance_shuttle_player(&mut self) {
        if !self.colonization_queue.is_empty() {
            self.colonization_queue.remove(0);
        }
        self.active_player = self.colonization_queue.first().copied();
        if self.active_player.is_none() {
            self.finish_shuttle_and_next_round();
        } else {
            self.turn_step = TurnStep::AwaitingTravelChoice;
        }
        self.refresh_legal();
    }

    fn finish_player_turn(&mut self, player_id: Uuid) {
        if let Some(p) = self.player_mut(player_id) {
            p.marker_laid = true;
        }
        if !self.colonization_queue.is_empty() {
            self.colonization_queue.remove(0);
        }
        self.start_next_player_turn();
        self.refresh_legal();
    }

    fn mark_main(&mut self, player_id: Uuid) -> Result<(), &'static str> {
        let p = self.player_mut(player_id).ok_or("Joueur")?;
        if p.main_used {
            return Err("Action principale déjà jouée");
        }
        p.main_used = true;
        Ok(())
    }

    fn require_side(&self, player_id: Uuid, side: Side) -> Result<(), &'static str> {
        let p = self.player(player_id).ok_or("Joueur")?;
        if p.side != side {
            return Err("Mauvaise face du plateau pour cette action");
        }
        Ok(())
    }

    fn spend_teal(&mut self, player_id: Uuid, n: u8) -> Result<(), &'static str> {
        if n == 0 {
            return Ok(());
        }
        let p = self.player_mut(player_id).ok_or("Joueur")?;
        if p.colonists_living < n {
            return Err("Pas assez de colons");
        }
        p.colonists_living -= n;
        p.colonists_working += n;
        Ok(())
    }

    fn return_working_colonists(&mut self, player_id: Uuid) {
        if let Some(p) = self.player_mut(player_id) {
            let space = p.colonists_living_cap.saturating_sub(p.colonists_living);
            let back = p.colonists_working.min(space);
            p.colonists_living += back;
            p.colonists_working -= back;
            // excess stay in supply conceptually
            p.colonists_supply += p.colonists_working;
            p.colonists_working = 0;
        }
    }

    fn pay_red_colonist(&mut self, player_id: Uuid, action_id: &str) -> Result<(), &'static str> {
        let has_slot = self.action_slots.iter().any(|s| s.action_id == action_id);
        if !has_slot {
            return Ok(());
        }

        // If full (3), clear most
        let remove_ids = {
            let slot = self
                .action_slots
                .iter()
                .find(|s| s.action_id == action_id)
                .unwrap();
            let total: u8 = slot.colonists.iter().map(|(_, n)| *n).sum();
            if total < 3 {
                Vec::new()
            } else {
                let mut by_player = std::collections::HashMap::<Uuid, u8>::new();
                for (id, n) in &slot.colonists {
                    *by_player.entry(*id).or_default() += n;
                }
                let max = by_player.values().copied().max().unwrap_or(0);
                by_player
                    .into_iter()
                    .filter(|(_, c)| *c == max)
                    .map(|(id, _)| id)
                    .collect::<Vec<_>>()
            }
        };
        if !remove_ids.is_empty() {
            if let Some(slot) = self
                .action_slots
                .iter_mut()
                .find(|s| s.action_id == action_id)
            {
                slot.colonists
                    .retain(|(id, _)| !remove_ids.contains(id));
            }
            for rid in remove_ids {
                if let Some(p) = self.player_mut(rid) {
                    p.colonists_working += 1;
                }
            }
        }

        let cost = {
            let slot = self
                .action_slots
                .iter()
                .find(|s| s.action_id == action_id)
                .unwrap();
            if self.player_count == 2 {
                slot.colonists.iter().map(|(_, n)| *n).sum::<u8>()
            } else {
                slot.colonists
                    .iter()
                    .map(|(id, _)| *id)
                    .filter(|id| *id != player_id)
                    .collect::<std::collections::HashSet<_>>()
                    .len() as u8
            }
        };

        {
            let p = self.player_mut(player_id).ok_or("Joueur")?;
            if p.colonists_living == 0 {
                return Err("Il faut un colon pour cette action");
            }
            let mut remaining = cost;
            while remaining > 0 {
                if p.crystals_depot > 0 {
                    p.crystals_depot -= 1;
                    remaining -= 1;
                } else if p.colonists_living > 1 {
                    p.colonists_living -= 1;
                    p.colonists_working += 1;
                    remaining -= 1;
                } else {
                    return Err("Coût de congestion trop élevé");
                }
            }
            p.colonists_living -= 1;
        }

        let slot = self
            .action_slots
            .iter_mut()
            .find(|s| s.action_id == action_id)
            .unwrap();
        if let Some(entry) = slot.colonists.iter_mut().find(|(id, _)| *id == player_id) {
            entry.1 += 1;
        } else {
            slot.colonists.push((player_id, 1));
        }
        Ok(())
    }

    fn take_warehouse_item(&mut self, player_id: Uuid, item: &str) -> Result<(), &'static str> {
        let p = self.player(player_id).ok_or("Joueur")?;
        let limit = Self::storage_limit(p);
        if item == "crystal" {
            if self.warehouse.crystals == 0 {
                return Err("Entrepôt vide");
            }
            let depot_cap = p.depot_capacity;
            let depot_used = p.crystals_depot + p.crystals_pending;
            if depot_used >= depot_cap {
                return Err("Depot plein");
            }
            self.warehouse.crystals -= 1;
            if let Some(p) = self.player_mut(player_id) {
                p.crystals_pending += 1;
            }
            return Ok(());
        }
        let idx = match item {
            "mineral" => 0,
            "battery" => 1,
            "water" => 2,
            "plant" => 3,
            "oxygen" => 4,
            _ => return Err("Ressource inconnue"),
        };
        if self.warehouse.resources[idx] == 0 {
            return Err("Entrepôt vide");
        }
        if p.storage[idx] >= limit {
            return Err("Stockage plein");
        }
        self.warehouse.resources[idx] -= 1;
        if let Some(p) = self.player_mut(player_id) {
            p.storage[idx] += 1;
        }
        Ok(())
    }

    fn take_tech(&mut self, player_id: Uuid, tech_id: &str) -> Result<(), &'static str> {
        let slot_i = self
            .tech_grid
            .iter()
            .position(|s| s.tech.as_ref().map(|t| t.id.as_str()) == Some(tech_id))
            .ok_or("Tech introuvable")?;
        let cost_b = self.tech_grid[slot_i].cost_battery;
        let cost_a = self.tech_grid[slot_i].cost_any;
        let tile = self.tech_grid[slot_i].tech.take().ok_or("Vide")?;

        let p = self.player(player_id).ok_or("Joueur")?;
        if p.lab.iter().any(|t| t.tech_type == tile.tech_type) {
            self.tech_grid[slot_i].tech = Some(tile);
            return Err("Tu as déjà cette tech");
        }
        if p.lab.len() >= 6 {
            self.tech_grid[slot_i].tech = Some(tile);
            return Err("Laboratoire plein");
        }
        if p.storage[Resource::Battery.index()] < cost_b {
            self.tech_grid[slot_i].tech = Some(tile);
            return Err("Pas assez de batteries");
        }
        let has_any = cost_a == 0 || Resource::ALL.iter().any(|r| p.storage[r.index()] > 0);
        if cost_a > 0 && !has_any {
            self.tech_grid[slot_i].tech = Some(tile);
            return Err("Pas de ressource pour le coût");
        }

        let p = self.player_mut(player_id).unwrap();
        p.storage[Resource::Battery.index()] -= cost_b;
        if cost_a > 0 {
            for r in Resource::ALL {
                if p.storage[r.index()] > 0 {
                    p.storage[r.index()] -= 1;
                    break;
                }
            }
        }
        p.lab.push(TechTile {
            id: tile.id.clone(),
            tech_type: tile.tech_type.clone(),
            level: 1,
        });
        p.crystals_pending += 1;
        Ok(())
    }

    fn take_blueprint(&mut self, player_id: Uuid, id: &str) -> Result<(), &'static str> {
        let idx = self
            .blueprint_display
            .iter()
            .position(|b| b.id == id)
            .ok_or("Blueprint introuvable")?;
        let mut card = self.blueprint_display.remove(idx);
        let p = self.player_mut(player_id).ok_or("Joueur")?;
        if p.advanced_markers_left == 0 {
            self.blueprint_display.insert(idx, card);
            return Err("Plus de marqueurs avancés");
        }
        p.advanced_markers_left -= 1;
        card.marker_owner = Some(player_id);
        if let Some(r) = card.gain {
            let lim = Self::storage_limit(p);
            let i = r.index();
            if p.storage[i] < lim {
                p.storage[i] += 1;
            }
        }
        if card.gain_crystal {
            p.crystals_pending += 1;
        }
        p.op += card.op.min(2); // small during game
        p.blueprints.push(card);
        if self.blueprint_deck_left > 0 && self.blueprint_display.len() < 6 {
            self.blueprint_display.push(make_blueprint(
                format!("bp-{}", 40 - self.blueprint_deck_left),
                if self.blueprint_deck_left > 9 { 1 } else { 3 },
            ));
            self.blueprint_deck_left -= 1;
        }
        Ok(())
    }

    fn develop_tech(&mut self, player_id: Uuid, tech_id: &str) -> Result<(), &'static str> {
        let p = self.player_mut(player_id).ok_or("Joueur")?;
        let tech = p
            .lab
            .iter_mut()
            .find(|t| t.id == tech_id)
            .ok_or("Tech introuvable")?;
        if tech.level >= 5 {
            return Err("Tech déjà max");
        }
        let next = tech.level + 1;
        let cost = match next {
            2 => (Resource::Battery, 0),
            3 => (Resource::Oxygen, 0),
            4 => (Resource::Oxygen, 1), // oxygen + plant abstracted
            5 => (Resource::Plant, 1),
            _ => (Resource::Mineral, 0),
        };
        if p.storage[cost.0.index()] == 0 && p.storage[Resource::Mineral.index()] == 0 {
            return Err("Pas assez de ressources pour R&D");
        }
        if p.storage[cost.0.index()] > 0 {
            p.storage[cost.0.index()] -= 1;
        } else {
            p.storage[Resource::Mineral.index()] -= 1;
        }
        if cost.1 > 0 {
            if p.storage[Resource::Plant.index()] > 0 {
                p.storage[Resource::Plant.index()] -= 1;
            } else if p.storage[Resource::Mineral.index()] > 0 {
                p.storage[Resource::Mineral.index()] -= 1;
            }
        }
        tech.level = next;
        // space benefit
        p.crystals_pending += 1;
        Ok(())
    }

    fn construct(
        &mut self,
        player_id: Uuid,
        bt: BuildingType,
        hex_id: u8,
        tech_owner: Option<Uuid>,
        boost_tech: u8,
    ) -> Result<(), &'static str> {
        let hex = self
            .hexes
            .get_mut(hex_id as usize)
            .ok_or("Hex invalide")?;
        if hex.building.is_some() {
            return Err("Hex occupé");
        }
        // must have bot adjacent or on hex — simplified: any bot of player on map OR bots_available
        let has_bot = self.hexes.iter().any(|h| h.bot == Some(player_id))
            || self
                .player(player_id)
                .map(|p| p.bots_available > 0)
                .unwrap_or(false);
        if !has_bot {
            return Err("Il faut un bot");
        }
        if !can_construct(self.player(player_id).unwrap(), bt) {
            return Err("Prérequis ressource manquant");
        }
        // pay prerequisite resource
        if let Some(req) = bt.prerequisite() {
            let p = self.player_mut(player_id).unwrap();
            if p.storage[req.index()] == 0 {
                if p.storage[Resource::Mineral.index()] == 0 {
                    return Err("Ressource manquante");
                }
                p.storage[Resource::Mineral.index()] -= 1;
            } else {
                p.storage[req.index()] -= 1;
            }
        }
        self.spend_teal(player_id, boost_tech)?;
        // tech share oxygen
        if let Some(owner) = tech_owner {
            if owner != player_id {
                if let Some(op) = self.player_mut(owner) {
                    let lim = Self::storage_limit(op);
                    if op.storage[Resource::Oxygen.index()] < lim {
                        op.storage[Resource::Oxygen.index()] += 1;
                    }
                    // free develop first tech
                    if let Some(t) = op.lab.first_mut() {
                        if t.level < 5 {
                            t.level += 1;
                        }
                    }
                }
            }
        }
        let is_shelter = bt == BuildingType::Shelter;
        self.hexes[hex_id as usize].building = Some(BuildingOnHex {
            building_type: bt,
            owner: Some(player_id),
            upgraded: false,
            blueprint_id: None,
        });
        if is_shelter {
            if let Some(p) = self.player_mut(player_id) {
                p.shelter_count += 1;
                p.colonists_living_cap = 4 + 2 * (p.shelter_count - 1);
                p.crystals_pending += 1;
            }
        }
        // mission contrib for building type
        self.contribute_mission(player_id, bt);
        // place bot on building
        self.hexes[hex_id as usize].bot = Some(player_id);
        if let Some(p) = self.player_mut(player_id) {
            p.op += 1;
        }
        self.maybe_advance_lss(bt);
        Ok(())
    }

    fn upgrade(&mut self, player_id: Uuid, hex_id: u8, blueprint_id: &str) -> Result<(), &'static str> {
        let bp_idx = {
            let p = self.player(player_id).ok_or("Joueur")?;
            p.blueprints
                .iter()
                .position(|b| b.id == blueprint_id && b.marker_owner == Some(player_id))
                .ok_or("Blueprint invalide")?
        };
        let building_type = self.player(player_id).unwrap().blueprints[bp_idx].building_type;
        let hex = self.hexes.get_mut(hex_id as usize).ok_or("Hex")?;
        let b = hex.building.as_mut().ok_or("Pas de bâtiment")?;
        if b.owner != Some(player_id) || b.building_type != building_type || b.upgraded {
            return Err("Upgrade impossible");
        }
        b.upgraded = true;
        b.blueprint_id = Some(blueprint_id.to_string());
        let p = self.player_mut(player_id).unwrap();
        p.blueprints[bp_idx].marker_owner = None; // marker moved to building
        p.op += p.blueprints[bp_idx].op;
        self.contribute_mission(player_id, building_type);
        Ok(())
    }

    fn welcome_ship(&mut self, player_id: Uuid, gain_bot: bool) -> Result<(), &'static str> {
        let level = self.colony_level;
        let p = self.player_mut(player_id).ok_or("Joueur")?;
        if p.ships_welcomed_total >= level {
            return Err("Limite de vaisseaux (niveau colonie)");
        }
        if p.ships_in_depot == 0 {
            return Err("Plus de vaisseaux au dépôt");
        }
        if p.storage[Resource::Plant.index()] == 0 || p.storage[Resource::Water.index()] == 0 {
            return Err("Coût Plant+Water requis");
        }
        p.storage[Resource::Plant.index()] -= 1;
        p.storage[Resource::Water.index()] -= 1;
        p.ships_in_depot -= 1;
        p.ships_in_hangar += 1;
        p.ships_welcomed_total += 1;
        p.depot_capacity = 8 - p.ships_in_depot;
        if gain_bot {
            p.bots_available += 1;
            if p.colonists_living < p.colonists_living_cap {
                p.colonists_living += 1;
            } else if p.colonists_supply > 0 {
                p.colonists_supply -= 1;
            }
        } else {
            for _ in 0..2 {
                if p.colonists_living < p.colonists_living_cap {
                    p.colonists_living += 1;
                }
            }
        }
        Ok(())
    }

    fn hire_scientist(&mut self, player_id: Uuid, id: &str) -> Result<(), &'static str> {
        let cost = self
            .scientists
            .iter()
            .find(|s| s.id == id)
            .map(|s| s.cost_crystals)
            .ok_or("Scientifique inconnu")?;
        let p = self.player_mut(player_id).ok_or("Joueur")?;
        if p.crystals_depot < cost {
            return Err("Pas assez de cristaux");
        }
        p.crystals_depot -= cost;
        p.scientist_ids.push(id.to_string());
        if let Some(s) = self.scientists.iter_mut().find(|s| s.id == id) {
            if s.hired_by.is_some() {
                return Err("Déjà recruté");
            }
            s.hired_by = Some(player_id);
        }
        Ok(())
    }

    fn give_contract(&mut self, player_id: Uuid) -> Result<(), &'static str> {
        if self.contract_deck_left == 0 {
            return Err("Plus de contrats");
        }
        self.contract_deck_left -= 1;
        let c = EarthContract {
            id: format!("contract-{}", 12 - self.contract_deck_left),
            label: "Livraison Terre".into(),
            needs: vec![(Resource::Water, 2), (Resource::Oxygen, 1)],
            complete_op: 5,
            incomplete_op: -3,
            owner: Some(player_id),
            deposited: [0; 5],
        };
        if let Some(p) = self.player_mut(player_id) {
            p.contracts.push(c);
        }
        Ok(())
    }

    fn move_piece(
        &mut self,
        player_id: Uuid,
        from: u8,
        to: u8,
        is_bot: bool,
    ) -> Result<(), &'static str> {
        if from as usize >= self.hexes.len() || to as usize >= self.hexes.len() {
            return Err("Hex invalide");
        }
        if !hex_adjacent(from, to) {
            return Err("Hex non adjacent");
        }
        if is_bot {
            if self.hexes[from as usize].bot != Some(player_id) {
                return Err("Pas ton bot");
            }
            if self.hexes[to as usize].bot.is_some() {
                return Err("Case bot occupée");
            }
            self.hexes[from as usize].bot = None;
            self.hexes[to as usize].bot = Some(player_id);
        } else {
            if self.hexes[from as usize].rover != Some(player_id)
                && self.player(player_id).and_then(|p| p.rover_hex) != Some(from)
            {
                // allow placing rover from offboard onto `to`
                if self.player(player_id).and_then(|p| p.rover_hex).is_some() {
                    return Err("Rover mal placé");
                }
            } else {
                self.hexes[from as usize].rover = None;
            }
            if self.hexes[to as usize].rover.is_some() {
                return Err("Rover case occupée");
            }
            self.hexes[to as usize].rover = Some(player_id);
            if let Some(p) = self.player_mut(player_id) {
                p.rover_hex = Some(to);
            }
            // pick discovery
            if self.hexes[to as usize].discovery.is_none() && to % 5 == 0 {
                self.hexes[to as usize].discovery = Some("ice".into());
                if let Some(p) = self.player_mut(player_id) {
                    p.crystals_pending += 1;
                }
            }
        }
        Ok(())
    }

    fn auto_move_bot(&mut self, player_id: Uuid) {
        let from = self.hexes.iter().find(|h| h.bot == Some(player_id)).map(|h| h.id);
        if let Some(from) = from {
            for to in 0..HEX_COUNT {
                if hex_adjacent(from, to) && self.hexes[to as usize].bot.is_none() {
                    let _ = self.move_piece(player_id, from, to, true);
                    break;
                }
            }
        } else if let Some(p) = self.player_mut(player_id) {
            // deploy rover
            if p.rover_hex.is_none() {
                if let Some(h) = self.hexes.iter().find(|h| h.building.as_ref().map(|b| b.owner) == Some(Some(player_id))) {
                    let hid = h.id;
                    // release borrow
                    let _ = hid;
                }
            }
        }
        // deploy rover on empty hex
        if self.player(player_id).and_then(|p| p.rover_hex).is_none() {
            if let Some(hid) = self.hexes.iter().find(|h| h.rover.is_none() && h.building.is_none()).map(|h| h.id) {
                self.hexes[hid as usize].rover = Some(player_id);
                if let Some(p) = self.player_mut(player_id) {
                    p.rover_hex = Some(hid);
                }
            }
        }
    }

    fn produce_on_travel_to_orbit(&mut self, player_id: Uuid) {
        let owned: Vec<BuildingType> = self
            .hexes
            .iter()
            .filter_map(|h| {
                h.building.as_ref().and_then(|b| {
                    if b.owner == Some(player_id) {
                        Some(b.building_type)
                    } else {
                        None
                    }
                })
            })
            .collect();
        for bt in owned {
            if let Some(r) = bt.produces() {
                self.gain_resource(player_id, r, 1);
            }
        }
    }

    fn gain_resource(&mut self, player_id: Uuid, r: Resource, n: u8) {
        if let Some(p) = self.player_mut(player_id) {
            let lim = Self::storage_limit(p);
            let i = r.index();
            p.storage[i] = (p.storage[i] + n).min(lim);
        }
    }

    fn contribute_mission(&mut self, player_id: Uuid, bt: BuildingType) {
        for m in &mut self.missions {
            if m.tracker == 0 {
                continue;
            }
            if m.contrib_building == Some(bt) || m.contrib_building.is_none() {
                m.tracker = m.tracker.saturating_sub(1);
                if let Some(p) = self.players.iter_mut().find(|p| p.id == player_id) {
                    p.crystals_pending += m.crystals_per_contrib;
                }
                if m.tracker == 0 {
                    self.remaining_missions = self.remaining_missions.saturating_sub(1);
                    self.log.push(format!("Mission {} accomplie", m.title));
                }
                break;
            }
        }
    }

    fn maybe_advance_lss(&mut self, bt: BuildingType) {
        // progress cubes
        if let Some(idx) = match bt {
            BuildingType::Mine => Some(0),
            BuildingType::Generator => Some(1),
            BuildingType::WaterExtractor => Some(2),
            BuildingType::Greenhouse => Some(3),
            BuildingType::OxygenCondenser => Some(4),
            BuildingType::Shelter => None,
        } {
            // shared colony progress — put on first player as track proxy
            if let Some(p) = self.players.first_mut() {
                if p.progress_cubes[idx] < 5 {
                    p.progress_cubes[idx] += 1;
                }
            }
        }
    }

    fn check_missions(&mut self) {
        // already handled in contribute
    }

    fn check_colony_level(&mut self) {
        // Level up when enough buildings of chain exist
        let shelters = self
            .hexes
            .iter()
            .filter(|h| {
                h.building
                    .as_ref()
                    .map(|b| b.building_type == BuildingType::Shelter)
                    .unwrap_or(false)
            })
            .count();
        let new_level = match shelters {
            0..=2 => 1,
            3..=4 => 2,
            5..=6 => 3,
            _ => 4,
        } as u8;
        if new_level > self.colony_level {
            self.colony_level = new_level;
            let w = if self.player_count == 2 { 2 } else { 3 };
            self.warehouse.crystals += w;
            for r in self.warehouse.resources.iter_mut() {
                *r += w;
            }
            // refill some tech
            for slot in &mut self.tech_grid {
                if slot.tech.is_none() {
                    slot.tech = Some(TechTile {
                        id: format!("refill-{}", slot.row),
                        tech_type: "generator".into(),
                        level: 1,
                    });
                    break;
                }
            }
            // reduce remaining missions track interaction
            if self.colony_level >= 3 {
                self.remaining_missions = self.remaining_missions.min(2);
            }
            self.log.push(format!("Niveau colonie → {}", self.colony_level));
        }
    }
}

fn can_construct(p: &OmPlayer, bt: BuildingType) -> bool {
    match bt.prerequisite() {
        None => true,
        Some(r) => p.storage[r.index()] > 0 || p.storage[Resource::Mineral.index()] > 0,
    }
}

fn actions_compatible(legal: &OnMarsAction, got: &OnMarsAction) -> bool {
    use OnMarsAction::*;
    match (legal, got) {
        (PassMain, PassMain) | (PassExecutive, PassExecutive) | (EndTurn, EndTurn) => true,
        (LandingPod, LandingPod) | (TakeContract, TakeContract) => true,
        (Resupply { item: a, .. }, Resupply { item: b, .. }) => a == b,
        (LearnTech { tech_id: a, .. }, LearnTech { tech_id: b, .. }) => a == b,
        (ObtainBlueprint { blueprint_id: a, .. }, ObtainBlueprint { blueprint_id: b, .. }) => a == b,
        (ConstructBuilding { building_type: a, hex_id: h1, .. }, ConstructBuilding { building_type: b, hex_id: h2, .. }) => a == b && h1 == h2,
        (UpgradeBuilding { hex_id: a, blueprint_id: b1 }, UpgradeBuilding { hex_id: b, blueprint_id: b2 }) => a == b && b1 == b2,
        (WelcomeShip { .. }, WelcomeShip { .. }) => true,
        (HireScientist { .. }, HireScientist { .. }) => true,
        (Executive { executive_id: a, .. }, Executive { executive_id: b, .. }) => a == b,
        (Travel { travel: a }, Travel { travel: b }) => a == b,
        (PickTurnOrder { slot: a }, PickTurnOrder { slot: b }) => a == b,
        (ResearchDevelop { .. }, ResearchDevelop { .. }) => true,
        (MoveUnits { .. }, MoveUnits { .. }) => true,
        _ => false,
    }
}

fn build_hexes() -> Vec<HexCell> {
    // Simple flat layout ~19 hexes in rows
    let coords = [
        (0, -2), (1, -2), (2, -2),
        (-1, -1), (0, -1), (1, -1), (2, -1),
        (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0),
        (-2, 1), (-1, 1), (0, 1), (1, 1),
        (-2, 2), (-1, 2), (0, 2),
    ];
    coords
        .iter()
        .enumerate()
        .map(|(i, &(q, r))| HexCell {
            id: i as u8,
            q,
            r,
            building: None,
            bot: None,
            rover: None,
            colonist: None,
            advanced_marker: None,
            research_tile: None,
            discovery: None,
        })
        .collect()
}

fn hex_adjacent(a: u8, b: u8) -> bool {
    let coords = [
        (0i8, -2i8), (1, -2), (2, -2),
        (-1, -1), (0, -1), (1, -1), (2, -1),
        (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0),
        (-2, 1), (-1, 1), (0, 1), (1, 1),
        (-2, 2), (-1, 2), (0, 2),
    ];
    if a as usize >= coords.len() || b as usize >= coords.len() {
        return false;
    }
    let (q1, r1) = coords[a as usize];
    let (q2, r2) = coords[b as usize];
    let dq = q1 - q2;
    let dr = r1 - r2;
    let ds = (-q1 - r1) - (-q2 - r2);
    dq.abs() <= 1 && dr.abs() <= 1 && ds.abs() <= 1 && (dq, dr) != (0, 0)
}

fn default_tech_grid(two_player: bool) -> Vec<TechGridSlot> {
    let types = ["mine", "generator", "water", "greenhouse", "oxygen", "bot"];
    let mut slots = Vec::new();
    let count = if two_player { 6 } else { 9 };
    for i in 0..count {
        let row = (i / 3) as u8;
        slots.push(TechGridSlot {
            tech: Some(TechTile {
                id: format!("tech-{i}"),
                tech_type: types[i % types.len()].into(),
                level: 1,
            }),
            row,
            cost_battery: row,
            cost_any: if row >= 2 { 1 } else { 0 },
        });
    }
    slots
}

fn default_blueprints() -> Vec<BlueprintCard> {
    (0..6)
        .map(|i| make_blueprint(format!("bp-{i}"), if i < 4 { 1 } else { 3 }))
        .collect()
}

fn make_blueprint(id: String, level: u8) -> BlueprintCard {
    let types = [
        BuildingType::Mine,
        BuildingType::Generator,
        BuildingType::WaterExtractor,
        BuildingType::Greenhouse,
        BuildingType::OxygenCondenser,
        BuildingType::Shelter,
    ];
    let idx = id.bytes().last().unwrap_or(b'0') as usize % types.len();
    BlueprintCard {
        id,
        level,
        building_type: types[idx],
        op: if level == 1 { 3 } else { 5 },
        gain: Some(Resource::ALL[idx % 5]),
        gain_crystal: idx % 2 == 0,
        executive_id: "construct_bonus".into(),
        executive_cost: 2,
        marker_owner: None,
    }
}

fn default_scientists() -> Vec<ScientistCard> {
    [
        ("geo", "Geologist", BuildingType::Mine, 1),
        ("rd", "R&D Engineer", BuildingType::Generator, 1),
        ("hydro", "Hydrologist", BuildingType::WaterExtractor, 2),
        ("bio", "Biochemist", BuildingType::Greenhouse, 2),
        ("geochem", "Geochemist", BuildingType::OxygenCondenser, 2),
        ("sys", "Systems Engineer", BuildingType::Shelter, 3),
    ]
    .into_iter()
    .map(|(id, name, sp, cost)| ScientistCard {
        id: id.into(),
        name: name.into(),
        specialty: sp,
        cost_crystals: cost,
        hired_by: None,
        working_on: None,
    })
    .collect()
}

fn default_missions(n: u8) -> Vec<MissionCard> {
    let goal = match n {
        2 => 3,
        3 => 4,
        _ => 5,
    };
    vec![
        MissionCard {
            id: "m1".into(),
            title: "Power Grid".into(),
            kind: "short".into(),
            crystals_per_contrib: 1,
            tracker: goal,
            goal,
            contrib_building: Some(BuildingType::Generator),
        },
        MissionCard {
            id: "m2".into(),
            title: "Greenhouses".into(),
            kind: "short".into(),
            crystals_per_contrib: 1,
            tracker: goal,
            goal,
            contrib_building: Some(BuildingType::Greenhouse),
        },
        MissionCard {
            id: "m3".into(),
            title: "Expansion".into(),
            kind: "long".into(),
            crystals_per_contrib: 2,
            tracker: goal + 1,
            goal: goal + 1,
            contrib_building: Some(BuildingType::Shelter),
        },
    ]
}

fn default_private_goals(i: usize) -> Vec<PrivateGoal> {
    vec![
        PrivateGoal {
            id: format!("pg-{i}-a"),
            title: "3 shelters".into(),
            op: 4,
            completed: false,
        },
        PrivateGoal {
            id: format!("pg-{i}-b"),
            title: "Tech level 4+".into(),
            op: 5,
            completed: false,
        },
        PrivateGoal {
            id: format!("pg-{i}-c"),
            title: "2 ships hangar".into(),
            op: 3,
            completed: false,
        },
    ]
}

fn default_action_slots() -> Vec<ActionSlotOccupancy> {
    [
        "resupply",
        "learn_tech",
        "blueprint",
        "rd",
        "control",
        "construct",
        "upgrade",
        "ship",
        "scientist",
        "contract",
    ]
    .into_iter()
    .map(|id| ActionSlotOccupancy {
        action_id: id.into(),
        colonists: vec![],
    })
    .collect()
}
