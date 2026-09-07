import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { FaqPage } from "./pages/FaqPage";
import { HomePage } from "./pages/HomePage";
import { FixtureAnalysisPage } from "./pages/FixtureAnalysisPage";
import { PredictionPage } from "./pages/PredictionPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/match-result" element={<PredictionPage market="match" />} />
        <Route path="/match-result/:marketId" element={<FixtureAnalysisPage market="match" />} />
        <Route path="/match-result/:marketId/:slug" element={<FixtureAnalysisPage market="match" />} />
        <Route path="/over-under-25" element={<PredictionPage market="ou" />} />
        <Route path="/over-under-25/:marketId" element={<FixtureAnalysisPage market="ou" />} />
        <Route path="/over-under-25/:marketId/:slug" element={<FixtureAnalysisPage market="ou" />} />
        <Route path="/faqs" element={<FaqPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
