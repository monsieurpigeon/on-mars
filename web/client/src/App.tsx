import { useGameStore, useSocketLifecycle } from "./lib/store";
import { HomePage } from "./pages/HomePage";
import { RoomLobbyPage } from "./pages/RoomLobbyPage";
import { GamePage } from "./pages/GamePage";
import "./App.css";

export default function App() {
  useSocketLifecycle();
  const room = useGameStore((s) => s.room);
  const game = useGameStore((s) => s.game);

  let screen = <HomePage />;
  if (room && (room.phase === "playing" || room.phase === "finished") && game) {
    screen = <GamePage />;
  } else if (room) {
    screen = <RoomLobbyPage />;
  }

  return <div className="app-shell">{screen}</div>;
}
