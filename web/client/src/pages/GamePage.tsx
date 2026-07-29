import { backToLobby, rematch, useGameStore } from "../lib/store";
import { useVoiceChat } from "../lib/voice";
import { VoiceControls } from "../components/VoiceControls";

export function GamePage() {
  const game = useGameStore((s) => s.game);
  const playerId = useGameStore((s) => s.playerId);
  const room = useGameStore((s) => s.room);
  const error = useGameStore((s) => s.error);
  const devMode = useGameStore((s) => s.devMode);

  const peerId = room?.players.find((p) => p.id !== playerId)?.id ?? null;
  const voice = useVoiceChat(peerId, !devMode && Boolean(room));

  if (!game || !room) return null;

  const isHost = room.host_id === playerId;

  return (
    <div className="page">
      <header className="brand-block compact">
        <p className="brand">On Mars</p>
        <h1>{room.name}</h1>
        <p className="lede">
          UI en cours sur <code>/test</code>
          {game.state.stub ? " — partie WS stub" : ""}.
        </p>
      </header>
      <VoiceControls voice={voice} peerReady={Boolean(peerId)} />
      <div className="actions">
        {isHost && (
          <button type="button" className="btn primary" onClick={() => rematch()}>
            Relancer
          </button>
        )}
        <button type="button" className="btn" onClick={() => backToLobby()}>
          Retour au lobby
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
