import type { CSSProperties } from 'react';
import type { PresenceUser } from '../hooks/useRoomPresence';

interface Props {
  users: PresenceUser[];
}

export function PresenceTags({ users }: Props) {
  return (
    <div className="presence" aria-live="polite">
      <ul className="presence-list" aria-label="People in this room">
        {users.map((u) => (
          <li key={u.userId}>
            <span
              className="presence-tag"
              style={{ '--tag-color': u.color } as CSSProperties}
              title={u.name}
            >
              {u.name.split(' ')[0]}
            </span>
          </li>
        ))}
      </ul>
      <span className="presence-count">{users.length} online</span>
    </div>
  );
}