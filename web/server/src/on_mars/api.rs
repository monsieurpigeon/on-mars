//! Endpoints HTTP de la session test On Mars.
use std::path::Path;

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;

use super::blueprints::take_blueprint;
use super::lss::{advance_lss_resource_token, level_up_lss, place_lss_player_token, set_lss_level};
use super::missions::set_mission_tracker;
use super::orbit::{reload_orbit_bank, take_from_orbit_bank};
use super::resources::set_player_resource;
use super::scientists::take_scientist;
use super::rovers::move_rover;
use super::session::{persist, session_path};
use super::shelters::{
    install_next_shelter, place_colon_from_stock, recall_working_colonists,
    send_shelter_colon_to_work,
};
use super::techs::{advance_tech, take_tech};
use super::types::{
    AdvanceLssResourceBody, AdvanceTechBody, InstallShelterBody, MoveRoverBody, PlaceColonBody,
    PlaceLssPlayerTokenBody, SendColonToWorkBody, TakeBlueprintBody, TakeOrbitBankBody,
    TakeScientistBody, TakeTechBody, TestSession, UpdateLssBody, UpdateMissionTrackerBody,
    UpdatePlayerResourceBody,
};
use crate::state::AppState;

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

/// POST /api/test-session/lss/advance-resource — monte un token ressource.
pub async fn advance_lss_resource_endpoint(
    State(state): State<AppState>,
    Json(body): Json<AdvanceLssResourceBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    advance_lss_resource_token(&mut session.game, body.resource)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/lss/place-player-token — jeton joueur sous une ressource.
pub async fn place_lss_player_token_endpoint(
    State(state): State<AppState>,
    Json(body): Json<PlaceLssPlayerTokenBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    place_lss_player_token(&mut session.game, body.player_index, body.resource)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/shelters/install — +2 cases meeples, +1 capacité perso (tokens LSS inchangés).
pub async fn install_shelter_endpoint(
    State(state): State<AppState>,
    Json(body): Json<InstallShelterBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    install_next_shelter(&mut session.game, body.player_index)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/shelters/place-colon — stock → abri (case libre la plus bas-gauche).
pub async fn place_colon_endpoint(
    State(state): State<AppState>,
    Json(body): Json<PlaceColonBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    place_colon_from_stock(&mut session.game, body.player_index)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/shelters/send-to-work — abri → zone de travail.
pub async fn send_colon_to_work_endpoint(
    State(state): State<AppState>,
    Json(body): Json<SendColonToWorkBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    send_shelter_colon_to_work(&mut session.game, body.player_index)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/shelters/recall-workers — travail → abris (plein) + surplus stock.
pub async fn recall_working_colonists_endpoint(
    State(state): State<AppState>,
    Json(body): Json<SendColonToWorkBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    recall_working_colonists(&mut session.game, body.player_index)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
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

/// POST /api/test-session/blueprints/take — prend une carte plan du marché.
pub async fn take_blueprint_card(
    State(state): State<AppState>,
    Json(body): Json<TakeBlueprintBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    take_blueprint(&mut session.game, body.player_index, body.card_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/scientists/take — prend un scientifique du marché.
pub async fn take_scientist_card(
    State(state): State<AppState>,
    Json(body): Json<TakeScientistBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    take_scientist(&mut session.game, body.player_index, body.resource)
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

/// POST /api/test-session/rovers/move — déplace le rover d’une case adjacente.
pub async fn move_rover_endpoint(
    State(state): State<AppState>,
    Json(body): Json<MoveRoverBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    move_rover(
        &mut session.game.colony_rovers,
        body.player_index,
        body.q,
        body.r,
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/techs/take — prend une tuile techno du marché.
pub async fn take_tech_tile(
    State(state): State<AppState>,
    Json(body): Json<TakeTechBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    take_tech(
        &mut session.game,
        body.player_index,
        body.kind,
        body.pay_resource,
        body.q,
        body.r,
    )
    .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}

/// POST /api/test-session/techs/advance — évolue une techno d’un hex vers la droite.
pub async fn advance_tech_tile(
    State(state): State<AppState>,
    Json(body): Json<AdvanceTechBody>,
) -> Result<Json<TestSession>, StatusCode> {
    let mut session = state.test_session.lock().clone();
    advance_tech(&mut session.game, body.player_index, body.kind, body.q, body.r)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let session = session.normalized();
    persist(&state, &session);
    Ok(Json(session))
}
