import { leaveRoom, startGame, useGameStore } from "../lib/store";
import { useVoiceChat } from "../lib/voice";
import { VoiceControls } from "../components/VoiceControls";

export function RoomLobbyPage() {
  const playerId = useGameStore((s) => s.playerId);
  const room = useGameStore((s) => s.room);
  const error = useGameStore((s) => s.error);

  const peerId = room?.players.find((p) => p.id !== playerId)?.id ?? null;
  const devMode = useGameStore((s) => s.devMode);
  const voice = useVoiceChat(peerId, !devMode && Boolean(room && room.players.length >= 2));

  if (!room) return null;

  const isHost = room.host_id === playerId;
  const canStart = isHost && room.players.length >= 2;
  const gameLabel = room.game_kind === "on_mars" ? "On Mars" : "Morpion";

  return (
    <div className="page">
      <header className="brand-block">
        <p className="brand">On Mars</p>
        <h1>{room.name}</h1>
        <p className="lede">
          {gameLabel} · en attente ({room.players.length}/{room.max_players})
        </p>
      </header>

      <section className="panel">
        <h2>Joueurs ({room.players.length}/{room.max_players})</h2>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id}>
              <span>{p.nickname}</span>
              {p.is_host && <em className="tag">hôte</em>}
              {p.id === playerId && <em className="tag">toi</em>}
            </li>
          ))}
        </ul>
      </section>

      <VoiceControls voice={voice} peerReady={Boolean(peerId)} />

      <div className="actions">
        {isHost && (
          <button type="button" className="btn primary" disabled={!canStart} onClick={() => startGame()}>
            Démarrer
          </button>
        )}
        <button type="button" className="btn" onClick={() => leaveRoom()}>
          Quitter
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
