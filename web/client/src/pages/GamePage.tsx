import {
  backToLobby,
  placeMark,
  rematch,
  useGameStore,
} from "../lib/store";
import { useVoiceChat } from "../lib/voice";
import { VoiceControls } from "../components/VoiceControls";
import type { TicTacToeState } from "../protocol";
function cellLabel(cell: string) {
  if (cell === "x") return "X";
  if (cell === "o") return "O";
  return "";
}

function TicTacToePage({ game }: { game: TicTacToeState }) {
  const playerId = useGameStore((s) => s.playerId);
  const room = useGameStore((s) => s.room);
  const error = useGameStore((s) => s.error);
  const devMode = useGameStore((s) => s.devMode);
  const peerId = room?.players.find((p) => p.id !== playerId)?.id ?? null;
  const voice = useVoiceChat(peerId, !devMode && Boolean(room));

  if (!room) return null;

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
      </header>
      <div className={`board ${isMyTurn ? "active-turn" : ""}`} role="grid">
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
      <div className="actions">
        {finished && isHost && (
          <button type="button" className="btn primary" onClick={() => rematch()}>
            Rejouer
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

export function GamePage() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  if (game.kind === "on_mars") {
    return (
      <div className="page">
        <header className="brand-block compact">
          <p className="brand">On Mars</p>
          <h1>En reconstruction</h1>
          <p className="lede">UI en cours sur <code>/test</code>.</p>
        </header>
      </div>
    );
  }
  return <TicTacToePage game={game} />;
}
