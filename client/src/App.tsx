import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import ChatPage from "./pages/ChatPage";
import ConfigurePage from "./pages/ConfigurePage";
import "./styles/layout.css";

export default function App() {
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="nav-links">
          <NavLink
            to="/chat"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Mobile Chat
          </NavLink>
          <NavLink
            to="/configure"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Configure
          </NavLink>
        </div>
      </nav>

      <main className="app-content">
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </main>
    </div>
  );
}
