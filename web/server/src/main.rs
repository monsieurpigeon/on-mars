mod game;
mod protocol;
mod state;
mod on_mars;
mod ws;

use std::net::SocketAddr;
use std::path::PathBuf;

use axum::routing::{get, post};
use axum::Router;
use state::AppState;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let state = AppState::default();
    let addr: SocketAddr = std::env::var("SERVER_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".into())
        .parse()
        .expect("SERVER_ADDR invalide");

    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../client/dist".into());
    let static_path = PathBuf::from(&static_dir);
    let index = static_path.join("index.html");

    let mut app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/ws", get(ws::ws_handler))
        .route(
            "/api/test-session",
            get(on_mars::get_test_session).put(on_mars::put_test_session),
        )
        .route(
            "/api/test-session/reset",
            post(on_mars::reset_test_session),
        )
        .route(
            "/api/test-session/lss",
            post(on_mars::update_lss_level),
        )
        .route(
            "/api/test-session/lss/level-up",
            post(on_mars::level_up_lss_endpoint),
        )
        .route(
            "/api/test-session/lss/advance-resource",
            post(on_mars::advance_lss_resource_endpoint),
        )
        .route(
            "/api/test-session/lss/place-player-token",
            post(on_mars::place_lss_player_token_endpoint),
        )
        .route(
            "/api/test-session/shelters/install",
            post(on_mars::install_shelter_endpoint),
        )
        .route(
            "/api/test-session/shelters/place-colon",
            post(on_mars::place_colon_endpoint),
        )
        .route(
            "/api/test-session/shelters/send-to-work",
            post(on_mars::send_colon_to_work_endpoint),
        )
        .route(
            "/api/test-session/shelters/recall-workers",
            post(on_mars::recall_working_colonists_endpoint),
        )
        .route(
            "/api/test-session/resources",
            post(on_mars::update_player_resource),
        )
        .route(
            "/api/test-session/missions",
            post(on_mars::update_mission_tracker),
        )
        .route(
            "/api/test-session/orbit-bank/take",
            post(on_mars::take_orbit_bank_item),
        )
        .route(
            "/api/test-session/blueprints/take",
            post(on_mars::take_blueprint_card),
        )
        .route(
            "/api/test-session/scientists/take",
            post(on_mars::take_scientist_card),
        )
        .route(
            "/api/test-session/orbit-bank/reload",
            post(on_mars::reload_orbit_bank_endpoint),
        )
        .route(
            "/api/test-session/rovers/move",
            post(on_mars::move_rover_endpoint),
        )
        .route(
            "/api/test-session/techs/take",
            post(on_mars::take_tech_tile),
        )
        .route(
            "/api/test-session/techs/advance",
            post(on_mars::advance_tech_tile),
        )
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    if static_path.is_dir() {
        let serve = ServeDir::new(&static_path)
            .not_found_service(ServeFile::new(index));
        app = app.fallback_service(serve);
        tracing::info!("Serving static files from {}", static_path.display());
    } else {
        tracing::warn!(
            "Static dir {} not found — API/WS only (dev mode)",
            static_path.display()
        );
    }

    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    tracing::info!("on-mars server listening on http://{addr}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("serve");
}
