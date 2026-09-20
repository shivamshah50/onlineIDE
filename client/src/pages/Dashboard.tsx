import { useAuth } from '../context/AuthContext';
import '../styles/dashboard.css';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <span className="brand">onlineIDE</span>
        <div className="dashboard-user">
          <span>{user?.name}</span>
          <button className="btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="dashboard-empty">
        <h1>You're in, {user?.name?.split(' ')[0]}.</h1>
        <p>Rooms, projects, and the editor land here next.</p>
      </main>
    </div>
  );
}