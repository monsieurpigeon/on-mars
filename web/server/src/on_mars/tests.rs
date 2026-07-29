//! Tests unitaires session UI On Mars.
use super::blueprints::*;
use super::buildings::{ColonyBuilding, ColonyBuildingKind, normalize_colony_buildings};
use super::constants::*;
use super::lss::*;
use super::missions::*;
use super::orbit::*;
use super::resources::set_player_resource;
use super::rovers::{
    deploy_rover_from_stock, move_rover, normalize_colony_rovers, sync_rover_stocks_with_board,
};
use super::scientists::take_scientist;
use super::shelters::*;
use super::types::*;


    #[test]
    fn starting_map_empty_buildings_one_rover_per_player() {
        let game = TestSession::initial().game;
        assert!(game.colony_buildings.is_empty());
        assert_eq!(game.colony_rovers.len(), PLAYER_COUNT);
        for (i, rover) in game.colony_rovers.iter().enumerate() {
            assert_eq!(rover.player_index as usize, i);
        }
        assert_eq!(
            (game.colony_rovers[0].q, game.colony_rovers[0].r),
            (0, 0)
        );
        // Sur le plateau → sorti du stock
        for p in &game.players {
            assert_eq!(p.rover_stock, 0, "player {} still has rover stock", p.player_index);
        }

        let mut empty_rovers = TestSession::initial().game;
        empty_rovers.colony_rovers.clear();
        normalize_colony_rovers(&mut empty_rovers.colony_rovers);
        sync_rover_stocks_with_board(
            &mut empty_rovers.players,
            &empty_rovers.colony_rovers,
        );
        assert!(empty_rovers.colony_rovers.is_empty());
        for p in &empty_rovers.players {
            assert_eq!(p.rover_stock, 1);
        }

        // Position conservée au normalize
        let mut moved = TestSession::initial().game;
        moved.colony_rovers[0].q = 2;
        moved.colony_rovers[0].r = -1;
        normalize_colony_rovers(&mut moved.colony_rovers);
        assert_eq!(moved.colony_rovers.len(), PLAYER_COUNT);
        assert_eq!((moved.colony_rovers[0].q, moved.colony_rovers[0].r), (2, -1));

        // Ancienne carte démo dense → vidée
        let mut demo = TestSession::initial().game;
        demo.colony_buildings = (0..61)
            .map(|i| ColonyBuilding {
                q: (i % 8) as i16,
                r: (i / 8) as i16,
                kind: ColonyBuildingKind::Mine,
                player_index: None,
            })
            .collect();
        normalize_colony_buildings(&mut demo.colony_buildings);
        assert!(demo.colony_buildings.is_empty());
    }

    #[test]
    fn deploy_rover_takes_from_personal_stock() {
        let mut game = TestSession::initial().game;
        game.colony_rovers.clear();
        for p in &mut game.players {
            p.rover_stock = 1;
        }
        deploy_rover_from_stock(&mut game.players, &mut game.colony_rovers, 0, 3, -1)
            .unwrap();
        assert_eq!(game.colony_rovers.len(), 1);
        assert_eq!(game.colony_rovers[0].player_index, 0);
        assert_eq!((game.colony_rovers[0].q, game.colony_rovers[0].r), (3, -1));
        assert_eq!(game.players[0].rover_stock, 0);
        assert_eq!(game.players[1].rover_stock, 1);
        assert!(
            deploy_rover_from_stock(&mut game.players, &mut game.colony_rovers, 0, 0, 0)
                .is_err()
        );
    }

    #[test]
    fn move_rover_adjacent_persists() {
        let mut game = TestSession::initial().game;
        assert_eq!((game.colony_rovers[0].q, game.colony_rovers[0].r), (0, 0));
        // (1,0) est occupé par le joueur 1 — autorisé
        move_rover(&mut game.colony_rovers, 0, 1, 0).unwrap();
        assert_eq!((game.colony_rovers[0].q, game.colony_rovers[0].r), (1, 0));
        // Non adjacent
        assert!(move_rover(&mut game.colony_rovers, 0, 3, 0).is_err());
        move_rover(&mut game.colony_rovers, 0, 1, -1).unwrap();
        assert_eq!((game.colony_rovers[0].q, game.colony_rovers[0].r), (1, -1));
    }

    #[test]
    fn lss_rewards_dealt_at_start_and_stable() {
        let game = TestSession::initial().game;
        assert_eq!(game.lss_rewards.len(), 8);
        assert_eq!(game.lss_rewards, (1..=8).collect::<Vec<_>>());
        assert_eq!(game.lss_reward_row.len(), 4);
        let mut seen = std::collections::HashSet::new();
        for &id in &game.lss_reward_row {
            assert!((1..=8).contains(&id));
            assert!(seen.insert(id), "duplicate reward {id}");
        }
        let row = game.lss_reward_row.clone();
        let mut again = TestSession {
            session_id: TEST_SESSION_ID.into(),
            view_player_index: 0,
            game,
        }
        .normalized()
        .game;
        assert_eq!(again.lss_reward_row, row, "tokens must not move");
        again.lss_reward_row = vec![];
        normalize_lss_rewards(&mut again);
        assert_eq!(again.lss_reward_row.len(), 4);
    }

    #[test]
    fn advance_resource_token_levels_up_when_all_reach_next() {
        let mut game = TestSession::initial().game;
        assert_eq!(game.lss_level, 1);
        assert_eq!(game.lss_resource_track.min_level(), 1);

        advance_lss_resource_token(&mut game, ColonyResourceKind::Energie).unwrap();
        assert_eq!(game.lss_resource_track.energie, 2);
        assert_eq!(game.lss_level, 1);

        advance_lss_resource_token(&mut game, ColonyResourceKind::Eau).unwrap();
        advance_lss_resource_token(&mut game, ColonyResourceKind::Plante).unwrap();
        assert_eq!(game.lss_level, 1);

        advance_lss_resource_token(&mut game, ColonyResourceKind::Oxygene).unwrap();
        // Tous au palier 2 → LSS monte
        assert_eq!(game.lss_level, 2);
        assert_eq!(game.lss_resource_track.min_level(), 2);

        assert!(advance_lss_resource_token(&mut game, ColonyResourceKind::Minerai).is_err());
    }

    #[test]
    fn install_shelter_reveals_row_and_raises_capacity() {
        let mut game = TestSession::initial().game;
        assert_eq!(game.players[0].shelters_installed, 0);
        assert_eq!(game.lss_resource_track.min_level(), 1);
        assert_eq!(game.lss_level, 1);
        assert_eq!(carry_capacity(0), 2);

        install_next_shelter(&mut game, 0).unwrap();
        assert_eq!(game.players[0].shelters_installed, 1);
        // Tokens LSS inchangés
        assert_eq!(game.lss_resource_track.min_level(), 1);
        assert_eq!(game.lss_level, 1);
        // +1 capacité perso ; rangée 3 visible, 2 cases vides
        assert_eq!(carry_capacity(game.players[0].shelters_installed), 3);
        assert_eq!(game.players[0].shelter_colonists, DEFAULT_SHELTER_COLONISTS);

        for _ in 0..3 {
            install_next_shelter(&mut game, 0).unwrap();
        }
        assert_eq!(game.players[0].shelters_installed, 4);
        assert_eq!(game.lss_resource_track.min_level(), 1);
        assert_eq!(game.lss_level, 1);
        assert_eq!(carry_capacity(4), 6);
        assert!(install_next_shelter(&mut game, 0).is_err());
    }

    #[test]
    fn capacity_is_base_plus_shelters_not_lss() {
        assert_eq!(carry_capacity(0), 2);
        assert_eq!(carry_capacity(1), 3);
        assert_eq!(carry_capacity(3), 5);
        assert_eq!(carry_capacity(4), 6);
        // LSS n’entre plus dans la formule
        let mut game = TestSession::initial().game;
        assert_eq!(carry_capacity(game.players[0].shelters_installed), 2);
        set_lss_level(&mut game, 5);
        assert_eq!(carry_capacity(game.players[0].shelters_installed), 2);
    }

    #[test]
    fn install_shelter_raises_carry_capacity() {
        let mut game = TestSession::initial().game;
        assert_eq!(carry_capacity(game.players[0].shelters_installed), 2);

        install_next_shelter(&mut game, 0).unwrap();
        assert_eq!(game.players[0].shelters_installed, 1);
        assert_eq!(game.lss_level, 1);
        assert_eq!(game.lss_resource_track.min_level(), 1);
        assert_eq!(carry_capacity(game.players[0].shelters_installed), 3);
        set_player_resource(&mut game, 0, ColonyResourceKind::Eau, 3).unwrap();
        assert_eq!(game.players[0].resources.eau, 3);
    }

    #[test]
    fn place_colon_increments_count_until_full() {
        let mut game = TestSession::initial().game;
        assert_eq!(game.players[0].shelter_colonists, 3);
        assert_eq!(game.players[0].colon_stock, 9);
        assert_eq!(visible_shelter_capacity(0), 4);

        place_colon_from_stock(&mut game, 0).unwrap();
        assert_eq!(game.players[0].colon_stock, 8);
        assert_eq!(game.players[0].shelter_colonists, 4);

        assert!(place_colon_from_stock(&mut game, 0).is_err());
        assert_eq!(game.players[0].colon_stock, 8);
    }

    #[test]
    fn send_colon_to_work_decrements_from_bottom() {
        let mut game = TestSession::initial().game;
        assert!(send_shelter_colon_to_work(&mut game, 0).is_ok());
        assert_eq!(game.players[0].working_colonists, 1);
        assert_eq!(game.players[0].shelter_colonists, 2);
        assert!(send_shelter_colon_to_work(&mut game, 0).is_ok());
        assert!(send_shelter_colon_to_work(&mut game, 0).is_ok());
        assert!(send_shelter_colon_to_work(&mut game, 0).is_err());
    }

    #[test]
    fn recall_workers_fills_shelters_then_stock() {
        let mut game = TestSession::initial().game;
        // 3 en abri (cap 4), stock 9 → envoie 3 au travail
        send_shelter_colon_to_work(&mut game, 0).unwrap();
        send_shelter_colon_to_work(&mut game, 0).unwrap();
        send_shelter_colon_to_work(&mut game, 0).unwrap();
        assert_eq!(game.players[0].shelter_colonists, 0);
        assert_eq!(game.players[0].working_colonists, 3);
        assert_eq!(game.players[0].colon_stock, 9);

        recall_working_colonists(&mut game, 0).unwrap();
        // Capacité 4 : 3 rentrent en abri, 0 en trop
        assert_eq!(game.players[0].shelter_colonists, 3);
        assert_eq!(game.players[0].working_colonists, 0);
        assert_eq!(game.players[0].colon_stock, 9);

        // Remplit + envoie 4 au travail, place encore depuis stock pour avoir overflow
        place_colon_from_stock(&mut game, 0).unwrap(); // 4 en abri, stock 8
        for _ in 0..4 {
            send_shelter_colon_to_work(&mut game, 0).unwrap();
        }
        assert_eq!(game.players[0].working_colonists, 4);
        assert_eq!(game.players[0].shelter_colonists, 0);
        // Installe un abri → cap 6, puis recall : 4 en abri
        install_next_shelter(&mut game, 0).unwrap();
        recall_working_colonists(&mut game, 0).unwrap();
        assert_eq!(game.players[0].shelter_colonists, 4);
        assert_eq!(game.players[0].working_colonists, 0);

        // Overflow : 4 en abri (cap 4 sans nouvel install — redescend) 
        // Remet shelters_installed à 0 via capacity 4: envoie 4 travail, recall avec cap 4
        game.players[0].shelters_installed = 0;
        game.players[0].shelter_colonists = 0;
        game.players[0].working_colonists = 5;
        game.players[0].colon_stock = 0;
        recall_working_colonists(&mut game, 0).unwrap();
        assert_eq!(game.players[0].shelter_colonists, 4);
        assert_eq!(game.players[0].colon_stock, 1);
        assert_eq!(game.players[0].working_colonists, 0);
        assert!(recall_working_colonists(&mut game, 0).is_err());
    }

    #[test]
    fn set_lss_does_not_change_carry_capacity() {
        let mut game = TestSession::initial().game;
        set_player_resource(&mut game, 0, ColonyResourceKind::Eau, 6).unwrap();
        assert_eq!(game.players[0].resources.eau, 2); // base 2
        set_lss_level(&mut game, 3);
        set_player_resource(&mut game, 0, ColonyResourceKind::Eau, 4).unwrap();
        assert_eq!(game.players[0].resources.eau, 2); // LSS n’augmente plus
        install_next_shelter(&mut game, 0).unwrap();
        set_player_resource(&mut game, 0, ColonyResourceKind::Eau, 3).unwrap();
        assert_eq!(game.players[0].resources.eau, 3); // +1 via abri
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

    #[test]
    fn blueprints_start_with_six_class1() {
        let game = TestSession::initial().game;
        assert_eq!(game.blueprints.deal_phase, 1);
        assert_eq!(game.blueprints.row_blue.len(), 6);
        assert_eq!(game.blueprints.row_red.len(), 6);
        assert!(game.blueprints.row_red.iter().all(|s| s.is_none()));
        assert!(game
            .blueprints
            .row_blue
            .iter()
            .all(|s| s.map(|id| blueprint_class(id) == 1).unwrap_or(false)));
        assert_eq!(game.blueprints.deck.len(), 18);
    }

    #[test]
    fn blueprints_phase2_deals_blues_then_reds() {
        let mut game = TestSession::initial().game;
        set_lss_level(&mut game, 2);
        assert_eq!(game.blueprints.deal_phase, 2);
        assert_eq!(game.blueprints.row_blue.len(), 6);
        assert_eq!(game.blueprints.row_red.len(), 6);
        assert!(game
            .blueprints
            .row_blue
            .iter()
            .all(|s| s.map(|id| blueprint_class(id) == 1).unwrap_or(false)));
        assert!(game
            .blueprints
            .row_red
            .iter()
            .all(|s| s.map(|id| blueprint_class(id) == 2).unwrap_or(false)));
        assert_eq!(game.blueprints.deck.len(), 6);
        assert!(game.blueprints.deck.iter().all(|id| blueprint_class(*id) == 2));
    }

    #[test]
    fn blueprints_phase3_fills_first_row_with_remaining_reds() {
        let mut game = TestSession::initial().game;
        set_lss_level(&mut game, 2);
        let taken_red = game.blueprints.row_red[0].unwrap();
        let kept_red = game.blueprints.row_red[1];
        take_blueprint(&mut game, 0, taken_red).unwrap();
        assert_eq!(game.blueprints.row_red[0], None);
        set_lss_level(&mut game, 3);
        assert_eq!(game.blueprints.deal_phase, 3);
        assert!(game.blueprints.deck.is_empty());
        // 6 rouges de la pioche sur la 1ʳᵉ ligne
        assert_eq!(occupied_blueprint_ids(&game.blueprints.row_blue).len(), 6);
        assert!(game
            .blueprints
            .row_blue
            .iter()
            .all(|s| s.map(|id| blueprint_class(id) == 2).unwrap_or(false)));
        // 2ᵉ ligne inchangée (trou conservé)
        assert_eq!(game.blueprints.row_red[0], None);
        assert_eq!(game.blueprints.row_red[1], kept_red);
        assert_eq!(occupied_blueprint_ids(&game.blueprints.row_red).len(), 5);
        assert_eq!(game.players[0].blueprints, vec![taken_red]);
    }

    #[test]
    fn take_blueprint_keeps_other_slots() {
        let mut game = TestSession::initial().game;
        let card = game.blueprints.row_blue[2].unwrap();
        let right = game.blueprints.row_blue[3];
        take_blueprint(&mut game, 0, card).unwrap();
        assert_eq!(game.blueprints.row_blue[2], None);
        assert_eq!(game.blueprints.row_blue[3], right);
        assert_eq!(game.players[0].blueprints, vec![card]);
        assert!(take_blueprint(&mut game, 0, card).is_err());
    }

    #[test]
    fn scientists_start_full_market() {
        let game = TestSession::initial().game;
        assert_eq!(game.scientists.slots.len(), 6);
        assert_eq!(
            game.scientists.slots,
            ScientistResource::ALL.iter().copied().map(Some).collect::<Vec<_>>()
        );
        assert!(game.players.iter().all(|p| p.scientists.is_empty()));
    }

    #[test]
    fn take_scientist_keeps_other_slots() {
        let mut game = TestSession::initial().game;
        take_scientist(&mut game, 0, ScientistResource::Eau).unwrap();
        assert_eq!(game.scientists.slots[2], None);
        assert_eq!(game.scientists.slots[0], Some(ScientistResource::Minerai));
        assert_eq!(game.scientists.slots[3], Some(ScientistResource::Plante));
        assert_eq!(game.players[0].scientists, vec![ScientistResource::Eau]);
        assert!(take_scientist(&mut game, 0, ScientistResource::Eau).is_err());
        assert!(take_scientist(&mut game, 1, ScientistResource::Eau).is_err());
    }
