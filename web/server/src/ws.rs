use std::net::SocketAddr;

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{ConnectInfo, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::game::{GameKind, GameSession};
use crate::protocol::{ClientMessage, ServerMessage};
use crate::state::{AppState, ConnectionMeta, Player, Room, RoomPhase};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    ConnectInfo(_addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    let player_id = Uuid::new_v4();

    {
        let mut inner = state.inner.lock();
        inner.connections.insert(player_id, tx.clone());
        inner.metas.insert(
            player_id,
            ConnectionMeta {
                nickname: String::new(),
                room_id: None,
            },
        );
    }

    AppState::send_raw(&tx, &ServerMessage::Welcome { player_id });
    {
        let inner = state.inner.lock();
        AppState::send_raw(&tx, &AppState::lobby_list_locked(&inner));
    }

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => {
                        if let Err(err) = handle_client_message(&state, player_id, client_msg) {
                            state.send_to_player(
                                player_id,
                                &ServerMessage::Error {
                                    code: err.0.into(),
                                    message: err.1.into(),
                                },
                            );
                        }
                    }
                    Err(_) => {
                        state.send_to_player(
                            player_id,
                            &ServerMessage::Error {
                                code: "bad_message".into(),
                                message: "Message invalide".into(),
                            },
                        );
                    }
                }
            }
            Message::Ping(payload) => {
                let _ = tx.send(Message::Pong(payload));
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    cleanup_disconnect(&state, player_id);
    send_task.abort();
}

fn handle_client_message(
    state: &AppState,
    player_id: Uuid,
    msg: ClientMessage,
) -> Result<(), (&'static str, &'static str)> {
    match msg {
        ClientMessage::SetNickname { nickname } => {
            let nickname = sanitize_nickname(&nickname)?;
            let mut inner = state.inner.lock();
            if let Some(meta) = inner.metas.get_mut(&player_id) {
                meta.nickname = nickname;
            }
            Ok(())
        }
        ClientMessage::CreateRoom {
            name,
            game_kind,
            max_players,
        } => {
            let name = sanitize_room_name(&name)?;
            let max_players = game_kind.clamp_max_players(max_players);
            let room_id = Uuid::new_v4();

            {
                let mut inner = state.inner.lock();
                let nickname = nickname_or_err(&inner, player_id)?;
                if inner
                    .metas
                    .get(&player_id)
                    .and_then(|m| m.room_id)
                    .is_some()
                {
                    return Err(("already_in_room", "Tu es déjà dans une partie"));
                }

                let tx = inner.connections.get(&player_id).cloned();
                let room = Room {
                    id: room_id,
                    name,
                    host_id: player_id,
                    players: vec![Player {
                        id: player_id,
                        nickname,
                        tx,
                    }],
                    phase: RoomPhase::Waiting,
                    max_players,
                    game_kind,
                    game: None,
                };
                let payload = room.state_payload();
                inner.rooms.insert(room_id, room);
                if let Some(meta) = inner.metas.get_mut(&player_id) {
                    meta.room_id = Some(room_id);
                }
                if let Some(tx) = inner.connections.get(&player_id) {
                    AppState::send_raw(tx, &ServerMessage::RoomState { room: payload });
                }
            }
            state.broadcast_lobby();
            Ok(())
        }
        ClientMessage::JoinRoom { room_id } => {
            let mut inner = state.inner.lock();
            let nickname = nickname_or_err(&inner, player_id)?;
            if inner
                .metas
                .get(&player_id)
                .and_then(|m| m.room_id)
                .is_some()
            {
                return Err(("already_in_room", "Tu es déjà dans une partie"));
            }

            let is_public = inner
                .rooms
                .get(&room_id)
                .map(|r| r.is_public())
                .ok_or(("not_found", "Partie introuvable"))?;
            if !is_public {
                return Err(("room_full", "Cette partie n'est plus disponible"));
            }

            let tx = inner.connections.get(&player_id).cloned();
            if let Some(meta) = inner.metas.get_mut(&player_id) {
                meta.room_id = Some(room_id);
            }
            let room = inner.rooms.get_mut(&room_id).unwrap();
            room.players.push(Player {
                id: player_id,
                nickname,
                tx,
            });
            let room_state = ServerMessage::RoomState {
                room: room.state_payload(),
            };
            room.broadcast(&room_state);
            drop(inner);
            state.broadcast_lobby();
            Ok(())
        }
        ClientMessage::LeaveRoom => {
            leave_room(state, player_id);
            let inner = state.inner.lock();
            if let Some(tx) = inner.connections.get(&player_id) {
                AppState::send_raw(tx, &AppState::lobby_list_locked(&inner));
            }
            drop(inner);
            state.broadcast_lobby();
            Ok(())
        }
        ClientMessage::StartGame => {
            let mut inner = state.inner.lock();
            let room_id = room_id_or_err(&inner, player_id)?;
            let Some(room) = inner.rooms.get_mut(&room_id) else {
                return Err(("not_found", "Partie introuvable"));
            };
            if room.host_id != player_id {
                return Err(("not_host", "Seul l'hôte peut démarrer"));
            }
            let min_players = match room.game_kind {
                GameKind::TicTacToe => 2,
                GameKind::OnMars => 2,
            };
            if room.players.len() < min_players {
                return Err(("not_enough_players", "Pas assez de joueurs"));
            }
            if room.phase != RoomPhase::Waiting && room.phase != RoomPhase::Finished {
                return Err(("bad_phase", "La partie a déjà commencé"));
            }

            let ids: Vec<_> = room.players.iter().map(|p| p.id).collect();
            let names: Vec<_> = room.players.iter().map(|p| p.nickname.clone()).collect();
            let session = GameSession::start(room.game_kind, &ids, &names)
                .map_err(|e| ("start_failed", e))?;
            room.game = Some(session);
            room.phase = RoomPhase::Playing;

            let room_state = ServerMessage::RoomState {
                room: room.state_payload(),
            };
            let game_state = ServerMessage::GameState {
                game: room.game_payload().unwrap(),
            };
            room.broadcast(&room_state);
            room.broadcast(&game_state);
            drop(inner);
            state.broadcast_lobby();
            Ok(())
        }
        ClientMessage::PlaceMark { index } => {
            let mut inner = state.inner.lock();
            let room_id = room_id_or_err(&inner, player_id)?;
            let Some(room) = inner.rooms.get_mut(&room_id) else {
                return Err(("not_found", "Partie introuvable"));
            };
            if room.phase != RoomPhase::Playing {
                return Err(("bad_phase", "La partie n'est pas en cours"));
            }
            let Some(GameSession::TicTacToe(game)) = room.game.as_mut() else {
                return Err(("no_game", "Pas une partie de morpion"));
            };
            game.place(player_id, index)
                .map_err(|e| ("illegal_move", e))?;

            if game.winner.is_some() {
                room.phase = RoomPhase::Finished;
            }

            let room_state = ServerMessage::RoomState {
                room: room.state_payload(),
            };
            let game_state = ServerMessage::GameState {
                game: room.game_payload().unwrap(),
            };
            room.broadcast(&room_state);
            room.broadcast(&game_state);
            Ok(())
        }
        ClientMessage::OnMarsAction { action } => {
            let mut inner = state.inner.lock();
            let room_id = room_id_or_err(&inner, player_id)?;
            let Some(room) = inner.rooms.get_mut(&room_id) else {
                return Err(("not_found", "Partie introuvable"));
            };
            if room.phase != RoomPhase::Playing {
                return Err(("bad_phase", "La partie n'est pas en cours"));
            }
            let Some(GameSession::OnMars(game)) = room.game.as_mut() else {
                return Err(("no_game", "Pas une partie On Mars"));
            };
            game.apply(player_id, action)
                .map_err(|e| ("illegal_action", e))?;

            if matches!(game.phase, crate::game::on_mars::OmPhase::GameEnd) {
                room.phase = RoomPhase::Finished;
            }

            let room_state = ServerMessage::RoomState {
                room: room.state_payload(),
            };
            let game_state = ServerMessage::GameState {
                game: room.game_payload().unwrap(),
            };
            room.broadcast(&room_state);
            room.broadcast(&game_state);
            Ok(())
        }
        ClientMessage::Rematch => {
            let mut inner = state.inner.lock();
            let room_id = room_id_or_err(&inner, player_id)?;
            let Some(room) = inner.rooms.get_mut(&room_id) else {
                return Err(("not_found", "Partie introuvable"));
            };
            if room.host_id != player_id {
                return Err(("not_host", "Seul l'hôte peut relancer"));
            }
            if room.players.len() < 2 {
                return Err(("not_enough_players", "Il faut au moins 2 joueurs"));
            }
            match room.game.as_mut() {
                Some(GameSession::TicTacToe(game)) => {
                    std::mem::swap(&mut game.x_player_id, &mut game.o_player_id);
                    game.reset();
                }
                _ => {
                    let ids: Vec<_> = room.players.iter().map(|p| p.id).collect();
                    let names: Vec<_> = room.players.iter().map(|p| p.nickname.clone()).collect();
                    room.game = Some(
                        GameSession::start(room.game_kind, &ids, &names)
                            .map_err(|e| ("start_failed", e))?,
                    );
                }
            }
            room.phase = RoomPhase::Playing;
            let room_state = ServerMessage::RoomState {
                room: room.state_payload(),
            };
            let game_state = ServerMessage::GameState {
                game: room.game_payload().unwrap(),
            };
            room.broadcast(&room_state);
            room.broadcast(&game_state);
            Ok(())
        }
        ClientMessage::BackToLobby => {
            leave_room(state, player_id);
            let inner = state.inner.lock();
            if let Some(tx) = inner.connections.get(&player_id) {
                AppState::send_raw(tx, &AppState::lobby_list_locked(&inner));
            }
            drop(inner);
            state.broadcast_lobby();
            Ok(())
        }
        ClientMessage::Reconnect { player_id: old_id } => {
            // Transfer connection identity to previous player id when possible
            let mut inner = state.inner.lock();
            if !inner.metas.contains_key(&old_id) && !inner.rooms.values().any(|r| {
                r.players.iter().any(|p| p.id == old_id)
            }) {
                return Err(("reconnect_failed", "Session expirée"));
            }

            let tx = inner.connections.remove(&player_id);
            let _ = inner.metas.remove(&player_id);

            if let Some(tx) = tx {
                inner.connections.insert(old_id, tx.clone());
                let nickname = inner
                    .metas
                    .get(&old_id)
                    .map(|m| m.nickname.clone())
                    .unwrap_or_default();
                if !inner.metas.contains_key(&old_id) {
                    inner.metas.insert(
                        old_id,
                        ConnectionMeta {
                            nickname: nickname.clone(),
                            room_id: None,
                        },
                    );
                }

                // Re-attach tx to room player
                let room_id = inner.metas.get(&old_id).and_then(|m| m.room_id);
                if let Some(room_id) = room_id {
                    if let Some(room) = inner.rooms.get_mut(&room_id) {
                        if let Some(p) = room.players.iter_mut().find(|p| p.id == old_id) {
                            p.tx = Some(tx.clone());
                        }
                        AppState::send_raw(
                            &tx,
                            &ServerMessage::RoomState {
                                room: room.state_payload(),
                            },
                        );
                        if let Some(game) = room.game_payload() {
                            AppState::send_raw(&tx, &ServerMessage::GameState { game });
                        }
                    }
                } else {
                    AppState::send_raw(&tx, &AppState::lobby_list_locked(&inner));
                }
                AppState::send_raw(&tx, &ServerMessage::Welcome { player_id: old_id });
            }
            Ok(())
        }
        ClientMessage::RtcSignal { target, payload } => {
            let inner = state.inner.lock();
            let room_id = room_id_or_err(&inner, player_id)?;
            let Some(room) = inner.rooms.get(&room_id) else {
                return Err(("not_found", "Partie introuvable"));
            };
            if !room.players.iter().any(|p| p.id == target) {
                return Err(("not_found", "Joueur cible introuvable"));
            }
            room.send_to(
                target,
                &ServerMessage::RtcSignal {
                    from: player_id,
                    payload,
                },
            );
            Ok(())
        }
    }
}

fn leave_room(state: &AppState, player_id: Uuid) {
    let mut inner = state.inner.lock();
    let Some(room_id) = inner.metas.get(&player_id).and_then(|m| m.room_id) else {
        return;
    };
    if let Some(meta) = inner.metas.get_mut(&player_id) {
        meta.room_id = None;
    }

    let mut remove_room = false;
    let mut host_changed = false;
    if let Some(room) = inner.rooms.get_mut(&room_id) {
        room.players.retain(|p| p.id != player_id);
        if room.players.is_empty() {
            remove_room = true;
        } else {
            if room.host_id == player_id {
                room.host_id = room.players[0].id;
                host_changed = true;
            }
            // If mid-game and someone left, finish / reset to waiting
            if room.phase == RoomPhase::Playing || room.phase == RoomPhase::Finished {
                room.phase = RoomPhase::Waiting;
                room.game = None;
            }
            let _ = host_changed;
            let room_state = ServerMessage::RoomState {
                room: room.state_payload(),
            };
            room.broadcast(&room_state);
        }
    }
    if remove_room {
        inner.rooms.remove(&room_id);
    }
}

fn cleanup_disconnect(state: &AppState, player_id: Uuid) {
    leave_room(state, player_id);
    {
        let mut inner = state.inner.lock();
        inner.connections.remove(&player_id);
        // Keep meta briefly for reconnect? For MVP remove; reconnect needs room still holding player
        // Actually leave_room already removed from room. Clear meta.
        inner.metas.remove(&player_id);
    }
    state.broadcast_lobby();
}

fn sanitize_nickname(raw: &str) -> Result<String, (&'static str, &'static str)> {
    let n = raw.trim();
    if n.is_empty() || n.len() > 24 {
        return Err(("bad_nickname", "Pseudo invalide (1–24 caractères)"));
    }
    Ok(n.to_string())
}

fn sanitize_room_name(raw: &str) -> Result<String, (&'static str, &'static str)> {
    let n = raw.trim();
    if n.is_empty() || n.len() > 40 {
        return Err(("bad_room_name", "Nom de partie invalide (1–40 caractères)"));
    }
    Ok(n.to_string())
}

fn nickname_or_err(
    inner: &crate::state::AppInner,
    player_id: Uuid,
) -> Result<String, (&'static str, &'static str)> {
    let nickname = inner
        .metas
        .get(&player_id)
        .map(|m| m.nickname.clone())
        .unwrap_or_default();
    if nickname.trim().is_empty() {
        return Err(("no_nickname", "Choisis un pseudo d'abord"));
    }
    Ok(nickname)
}

fn room_id_or_err(
    inner: &crate::state::AppInner,
    player_id: Uuid,
) -> Result<Uuid, (&'static str, &'static str)> {
    inner
        .metas
        .get(&player_id)
        .and_then(|m| m.room_id)
        .ok_or(("not_in_room", "Tu n'es dans aucune partie"))
}
