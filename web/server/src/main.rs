mod game;
mod protocol;
mod state;
mod test_session;
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
            get(test_session::get_test_session).put(test_session::put_test_session),
        )
        .route(
            "/api/test-session/reset",
            post(test_session::reset_test_session),
        )
        .route(
            "/api/test-session/lss",
            post(test_session::update_lss_level),
        )
        .route(
            "/api/test-session/lss/level-up",
            post(test_session::level_up_lss_endpoint),
        )
        .route(
            "/api/test-session/resources",
            post(test_session::update_player_resource),
        )
        .route(
            "/api/test-session/missions",
            post(test_session::update_mission_tracker),
        )
        .route(
            "/api/test-session/orbit-bank/take",
            post(test_session::take_orbit_bank_item),
        )
        .route(
            "/api/test-session/orbit-bank/reload",
            post(test_session::reload_orbit_bank_endpoint),
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
