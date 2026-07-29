import { useState, type FormEvent } from "react";
import {
  clearError,
  createRoom,
  joinRoom,
  setNickname,
  useGameStore,
} from "../lib/store";

export function HomePage() {
  const nickname = useGameStore((s) => s.nickname);
  const rooms = useGameStore((s) => s.rooms);
  const error = useGameStore((s) => s.error);
  const [nameInput, setNameInput] = useState(nickname);
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);

  function ensureNick(value: string) {
    const n = value.trim();
    if (!n) return false;
    setNickname(n);
    return true;
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    clearError();
    if (!ensureNick(nameInput)) return;
    if (!roomName.trim()) return;
    createRoom(roomName.trim(), "on_mars", maxPlayers);
  }

  function onJoin(roomId: string) {
    clearError();
    if (!ensureNick(nameInput)) return;
    joinRoom(roomId);
  }

  return (
    <div className="page home">
      <header className="brand-block">
        <p className="brand">On Mars</p>
        <h1>Colonie</h1>
        <p className="lede">Crée une partie ou rejoins une salle en attente.</p>
      </header>

      <section className="panel">
        <label className="field">
          <span>Pseudo</span>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={24}
            placeholder="Ton pseudo"
            autoComplete="nickname"
          />
        </label>
      </section>

      <section className="panel">
        <h2>Créer une partie</h2>
        <form className="stack" onSubmit={onCreate}>
          <label className="field">
            <span>Joueurs (2–4)</span>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          <label className="field">
            <span>Nom de la salle</span>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={40}
              placeholder="ex. DOME Alpha"
            />
          </label>
          <button type="submit" className="btn primary" disabled={!nameInput.trim() || !roomName.trim()}>
            Créer
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Parties en attente</h2>
        {rooms.length === 0 ? (
          <p className="muted">Aucune partie pour l’instant — sois le premier.</p>
        ) : (
          <ul className="room-list">
            {rooms.map((room) => (
              <li key={room.id}>
                <div>
                  <strong>{room.name}</strong>
                  <span className="muted">
                    {" "}
                    · On Mars · {room.host_nickname} · {room.player_count}/{room.max_players}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn"
                  disabled={!nameInput.trim() || room.player_count >= room.max_players}
                  onClick={() => onJoin(room.id)}
                >
                  Rejoindre
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
