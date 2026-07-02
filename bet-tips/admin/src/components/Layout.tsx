import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

const Layout = ({ children }: { children: ReactNode }) => {
  const { me, logout } = useAuth();
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Bet Tips</h1>
        <NavLink to="/tokens" className={({ isActive }) => (isActive ? "active" : "")}>Signup Tokens</NavLink>
        <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>Users</NavLink>
        <NavLink to="/uploads" className={({ isActive }) => (isActive ? "active" : "")}>Uploads</NavLink>
        <NavLink to="/assets" className={({ isActive }) => (isActive ? "active" : "")}>Asset Library</NavLink>
        <div className="spacer" />
        <div className="muted" style={{ fontSize: 12, padding: "8px 12px" }}>{me?.email}</div>
        <button className="secondary" onClick={logout}>Log out</button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
};

export default Layout;
