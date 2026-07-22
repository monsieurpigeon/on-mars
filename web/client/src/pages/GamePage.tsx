import {
  backToLobby,
  placeMark,
  rematch,
  useGameStore,
} from "../lib/store";
import { useVoiceChat } from "../lib/voice";
import { VoiceControls } from "../components/VoiceControls";

function cellLabel(cell: string) {
  if (cell === "x") return "X";
  if (cell === "o") return "O";
  return "";
}

export function GamePage() {
  const playerId = useGameStore((s) => s.playerId);
  const room = useGameStore((s) => s.room);
  const game = useGameStore((s) => s.game);
  const error = useGameStore((s) => s.error);

  const peerId = room?.players.find((p) => p.id !== playerId)?.id ?? null;
  const voice = useVoiceChat(peerId, Boolean(room && game));

  if (!room || !game) return null;

  const myMark =
    game.x_player_id === playerId ? "x" : game.o_player_id === playerId ? "o" : null;
  const isMyTurn = myMark === game.turn && !game.winner;
  const isHost = room.host_id === playerId;
  const finished = Boolean(game.winner);

  const xName = room.players.find((p) => p.id === game.x_player_id)?.nickname ?? "X";
  const oName = room.players.find((p) => p.id === game.o_player_id)?.nickname ?? "O";

  let statusText = `Tour de ${game.turn === "x" ? xName : oName}`;
  if (game.winner === "draw") statusText = "Égalité";
  else if (game.winner === "x") statusText = `${xName} gagne`;
  else if (game.winner === "o") statusText = `${oName} gagne`;

  return (
    <div className="page game-page">
      <header className="brand-block compact">
        <p className="brand">On Mars</p>
        <h1>{room.name}</h1>
        <p className="lede status-line">{statusText}</p>
        <p className="muted">
          {xName} (X) · {oName} (O)
          {myMark ? ` · tu joues ${myMark.toUpperCase()}` : ""}
        </p>
      </header>

      <div className={`board ${isMyTurn ? "active-turn" : ""}`} role="grid" aria-label="Grille morpion">
        {game.board.map((cell, index) => (
          <button
            key={index}
            type="button"
            className={`cell mark-${cell}`}
            disabled={!isMyTurn || cell !== "empty" || finished}
            onClick={() => placeMark(index)}
          >
            {cellLabel(cell)}
          </button>
        ))}
      </div>

      <VoiceControls voice={voice} peerReady={Boolean(peerId)} />

      {finished && (
        <div className="actions">
          {isHost && (
            <button type="button" className="btn primary" onClick={() => rematch()}>
              Rejouer
            </button>
          )}
          <button type="button" className="btn" onClick={() => backToLobby()}>
            Retour au lobby
          </button>
        </div>
      )}

      {!finished && (
        <div className="actions">
          <button type="button" className="btn" onClick={() => backToLobby()}>
            Abandonner
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
