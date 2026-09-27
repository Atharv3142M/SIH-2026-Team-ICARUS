import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import Processing from "./pages/Processing";
import ProjectsList from "./pages/ProjectsList";
import Settings from "./pages/Settings";
import Viewer from "./pages/Viewer";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  useTheme();
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/processing/:id" element={<Processing />} />
        <Route path="/viewer/:id" element={<Viewer />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
}
