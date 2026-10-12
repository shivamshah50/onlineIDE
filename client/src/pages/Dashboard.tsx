import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage, createRoom, LANGUAGES, languageLabel, listRooms } from '../lib/roomsApi';
import type { LanguageId, Room } from '../lib/roomsApi';
import '../styles/dashboard.css';

type LoadState = 'loading' | 'ready' | 'error';

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Accepts a bare room code or a full invite link ("…/room/k3x9ab"). */
function parseRoomCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromLink = text.match(/\/room\/([A-Za-z0-9_-]+)/);
  const code = fromLink ? fromLink[1] : text;
  return /^[A-Za-z0-9_-]{4,64}$/.test(code) ? code : null;
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [name, setName] = useState('');
  const [language, setLanguage] = useState<LanguageId>('javascript');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoadState('loading');
    try {
      setRooms(await listRooms());
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError('Give the room a name.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const room = await createRoom({ name: trimmed, language });
      navigate(`/room/${room.roomId}`);
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'Could not create the room. Try again.'));
      setCreating(false);
    }
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    const code = parseRoomCode(joinInput);
    if (!code) {
      setJoinError('Paste a room code or an invite link.');
      return;
    }
    setJoinError(null);
    navigate(`/room/${code}`);
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <span className="dash-logo">onlineIDE</span>
        <div className="dash-header-right">
          <span className="dash-user">{user?.name}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="dash-main">
        <section className="dash-rooms">
          <h1 className="dash-title">Your rooms</h1>

          {loadState === 'loading' && <p className="dash-muted">Loading rooms…</p>}

          {loadState === 'error' && (
            <div className="dash-notice">
              <p>We couldn't load your rooms.</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadRooms()}>
                Retry
              </button>
            </div>
          )}

          {loadState === 'ready' && rooms.length === 0 && (
            <p className="dash-muted">No rooms yet — start one on the right, then send the link.</p>
          )}

          {loadState === 'ready' && rooms.length > 0 && (
            <ul className="dash-list">
              {rooms.map((room) => (
                <li key={room.roomId}>
                  <button type="button" className="dash-row" onClick={() => navigate(`/room/${room.roomId}`)}>
                    <span className="dash-row-main">
                      <span className="dash-row-name">{room.name}</span>
                      <span className="dash-chip">{languageLabel(room.language)}</span>
                    </span>
                    <span className="dash-row-meta">
                      <span className="dash-muted">Active {timeAgo(room.lastActiveAt)}</span>
                      <span className="dash-row-code">{room.roomId}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="dash-side">
          <form className="dash-panel" onSubmit={onCreate} noValidate>
            <h2 className="dash-panel-title">Start a room</h2>
            <div className="field">
              <label htmlFor="room-name">Room name</label>
              <input
                id="room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Merge sort practice"
                maxLength={60}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="room-language">Language</label>
              <select id="room-language" value={language} onChange={(e) => setLanguage(e.target.value as LanguageId)}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            {createError && <p className="field-error">{createError}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={creating}>
              {creating ? 'Creating room…' : 'Create room'}
            </button>
          </form>

          <form className="dash-panel" onSubmit={onJoin} noValidate>
            <h2 className="dash-panel-title">Join with a code</h2>
            <div className="field">
              <label htmlFor="join-code">Room code or invite link</label>
              <input
                id="join-code"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="k3x9ab2f"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {joinError && <p className="field-error">{joinError}</p>}
            <button type="submit" className="btn btn-ghost btn-block">
              Join room
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}