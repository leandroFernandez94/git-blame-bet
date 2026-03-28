import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider } from "./context/GameContext";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { LobbyPage } from "./pages/LobbyPage";
import { JoinPage } from "./pages/JoinPage";
import { PlayingPage } from "./pages/PlayingPage";
import { ResultsPage } from "./pages/ResultsPage";

export function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:gameId" element={<LobbyPage />} />
            <Route path="/play/:gameId" element={<JoinPage />} />
            <Route path="/playing/:gameId" element={<PlayingPage />} />
            <Route path="/results/:gameId" element={<ResultsPage />} />
          </Routes>
        </Layout>
      </GameProvider>
    </BrowserRouter>
  );
}
