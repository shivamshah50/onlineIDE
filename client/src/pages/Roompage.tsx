import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import { useAuth } from '../context/AuthContext';
import { PresenceTags } from '../components/Presencetags';
import { useRoomPresence } from '../hooks/useRoomPresence';
import { useYjsDoc } from '../hooks/useYjsDoc';
import { useExecutionResult } from '../hooks/useExecutionResult';
import { userColor } from '../lib/colors';
import { getRoom, LANGUAGES, RoomNotFoundError, apiErrorMessage } from '../lib/roomsApi';
import type { LanguageId, Room } from '../lib/roomsApi';
import { executeCode } from '../lib/executeApi';
import type { ExecutionResult } from '../lib/executeApi';
import '../styles/room.css';

type Status = 'loading' | 'ready' | 'missing' | 'error';
type MonacoEditorInstance = Parameters<OnMount>[0];

function renderConsole({
  running,
  runError,
  result,
}: {
  running: boolean;
  runError: string | null;
  result: ExecutionResult | null;
}): string {
  if (running) return 'Running…';
  if (runError) return `Error: ${runError}`;
  if (!result) return 'Run your code to see output here.';

  // compileOutput covers syntax/compile errors (C++, Java, Go, TS); stderr
  // covers runtime errors and anything written to stderr. A clean run with
  // no stdout still gets a line, so "Run" never looks like it silently did
  // nothing.
  const parts: string[] = [];
  if (result.compileOutput.trim()) parts.push(result.compileOutput.trimEnd());
  if (result.stdout.trim()) parts.push(result.stdout.trimEnd());
  if (result.stderr.trim()) parts.push(result.stderr.trimEnd());
  if (parts.length === 0) parts.push('(no output)');

  const meta = [result.time ? `${result.time}s` : null, result.memory ? `${result.memory} KB` : null]
    .filter(Boolean)
    .join(' · ');

  return parts.join('\n\n') + (meta ? `\n\n[${result.status}${meta ? ` · ${meta}` : ''}]` : `\n\n[${result.status}]`);
}

// Matches the purple/teal theme from your login screen.
const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('online-ide', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7d8596', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c68fe8' },
      { token: 'string', foreground: '7fdfc4' },
    ],
    colors: {
      'editor.background': '#1a1e25',
      'editorLineNumber.activeForeground': '#c68fe8',
      'editorCursor.foreground': '#c68fe8',
    },
  });
};

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [room, setRoom] = useState<Room | null>(null);

  // Language is still local/display-only for now — it drives Monaco's syntax
  // highlighting, but doesn't change the shared document (the room's saved
  // language is what seeds the doc, server-side, the first time anyone
  // joins; see yjsStore.js). Broadcasting a language change is a later
  // phase, not this one.
  const [language, setLanguage] = useState<LanguageId>('javascript');
  const [copied, setCopied] = useState(false);
  const [editor, setEditor] = useState<MonacoEditorInstance | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  // "Clear" only hides the last result FOR THIS TAB — `result` itself is
  // shared, read-only broadcast state (see useExecutionResult), so clearing
  // it for real isn't this tab's call to make. A fresh run un-hides it again.
  const [dismissed, setDismissed] = useState(false);

  const online = useRoomPresence(status === 'ready' ? roomId : undefined);
  const yjsRoom = useYjsDoc(status === 'ready' ? roomId : undefined);
  // Broadcast from the server (executeController.js) — updates for EVERYONE
  // in the room, not just whoever clicked Run, so each tab's console shows
  // the same result.
  const result = useExecutionResult(status === 'ready' ? roomId : undefined);

  useEffect(() => {
    if (result) setDismissed(false);
  }, [result]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setStatus('loading');
    try {
      const r = await getRoom(roomId);
      setRoom(r);
      setLanguage(r.language);
      setStatus('ready');
    } catch (err) {
      setStatus(err instanceof RoomNotFoundError ? 'missing' : 'error');
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Binds Monaco's model directly to the shared Yjs text — this is what
  // makes typing actually sync between everyone in the room. Content from
  // here on is owned by the Yjs document, not by any React state; destroying
  // and recreating the binding when either side changes avoids two bindings
  // ever fighting over the same editor.
  useEffect(() => {
    if (!editor || !yjsRoom || !user) return;
    const model = editor.getModel();
    if (!model) return;

    yjsRoom.awareness.setLocalStateField('user', { name: user.name, color: userColor(user._id) });

    const binding = new MonacoBinding(yjsRoom.doc.getText('monaco'), model, new Set([editor]), yjsRoom.awareness);
    return () => binding.destroy();
  }, [editor, yjsRoom, user]);

  async function copyInvite() {
    const link = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  }

  async function run() {
    const code = editor?.getValue() ?? '';
    if (!roomId || !code.trim() || running) return;
    setRunning(true);
    setRunError(null);
    try {
      // The result itself isn't used directly here — it arrives back through
      // the 'execution:result' socket broadcast (useExecutionResult above),
      // the same way it reaches every other tab in the room. That keeps a
      // single source of truth for "what did the last run show" instead of
      // the caller's tab trusting its own HTTP response while everyone
      // else trusts the socket.
      await executeCode(roomId, { code });
    } catch (err) {
      setRunError(apiErrorMessage(err, 'Could not run the code'));
    } finally {
      setRunning(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="room-state">
        <p className="dash-muted">Loading room…</p>
      </div>
    );
  }

  if (status === 'missing' || status === 'error') {
    return (
      <div className="room-state">
        <h1 className="dash-title">{status === 'missing' ? "This room doesn't exist" : "Couldn't open this room"}</h1>
        <p className="dash-muted">
          {status === 'missing' ? 'The code may be mistyped, or the owner closed the room.' : 'Check your connection and try again.'}
        </p>
        <div className="room-state-actions">
          {status === 'error' && (
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
              Retry
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Back to your rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room">
      <header className="room-bar">
        <button type="button" className="room-back" onClick={() => navigate('/dashboard')} aria-label="Back to your rooms">
          ←
        </button>
        <h1 className="room-name">{room?.name}</h1>
        <PresenceTags users={online} />
        <div className="room-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyInvite()}>
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void run()} disabled={running}>
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
      </header>

      <div className="room-body">
        <div className="room-toolbar">
          <label htmlFor="editor-language">Language</label>
          <select id="editor-language" value={language} onChange={(e) => setLanguage(e.target.value as LanguageId)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          {!yjsRoom?.synced && <span className="room-sync-status">Syncing…</span>}
        </div>

        <div className="room-editor">
          <Editor
            height="100%"
            theme="online-ide"
            language={language}
            beforeMount={defineTheme}
            onMount={(ed) => setEditor(ed)}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              automaticLayout: true,
              // Collaborative editing + Monaco's "smart" bracket/indent features don't mix well.
              // Auto-closing brackets, auto-surround and auto-reindent all work by Monaco
              // silently inserting or deleting EXTRA characters beyond what you typed (e.g.
              // backspacing one '{' deletes the matching '}' too, as a second, synthetic edit).
              // y-monaco's MonacoBinding turns every one of those edits — real or synthetic —
              // into a Yjs op and ships it out. The synthetic ones are computed from your LOCAL
              // buffer at the instant you pressed backspace; if a remote edit from the other tab
              // lands a few ms earlier or later, Monaco's synthetic delete targets stale
              // positions, and you get exactly what you saw: tab1 (the one that typed) ends up
              // with a brace the other tab never had. Turning these off makes every edit exactly
              // what the user typed, with nothing synthesized — the thing that was actually
              // racing with the sync.
              autoClosingBrackets: 'never',
              autoClosingQuotes: 'never',
              autoClosingOvertype: 'never',
              autoSurround: 'never',
              autoIndent: 'none',
            }}
          />
        </div>

        <section className="room-console">
          <div className="room-console-head">
            <span>
              Console{!dismissed && result && <span className="room-console-status"> · {result.status}</span>}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setRunError(null);
                setDismissed(true);
              }}
            >
              Clear
            </button>
          </div>
          <pre className="room-console-out">
            {renderConsole({ running, runError, result: dismissed ? null : result })}
          </pre>
        </section>
      </div>
    </div>
  );
}