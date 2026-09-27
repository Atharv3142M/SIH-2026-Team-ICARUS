import { NavLink } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import Button from "./Button";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projects", label: "Projects" },
  { to: "/projects/new", label: "New" },
  { to: "/settings", label: "Settings" },
];

export default function Header() {
  const { theme, toggle } = useTheme();
  return (
    <header className="header">
      <div className="brand">JARVIS Digital Twin</div>
      <nav>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Button variant="ghost" onClick={toggle} aria-label="Toggle theme">
        {theme === "dark" ? "Light" : "Dark"}
      </Button>
    </header>
  );
}
