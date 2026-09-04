import { socket } from '../lib/socket.js';

function timeAgo(ts) {
  if (!ts) return 'never';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

const ROLE_LABEL = { hunter: 'Hunter', runner: 'Runner', spectator: 'Spectator' };

export default function PlayerList({ players, me }) {
  const iAmHunter = me.role === 'hunter';

  function toggleCaught(p) {
    socket.emit('toggle-caught', { targetPlayerId: p.id, caught: !p.caught });
  }

  const sorted = [...players].sort((a, b) => {
    if (a.id === me.id) return -1;
    if (b.id === me.id) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="player-list">
      {sorted.map((p) => (
        <div className={`player-row${p.connected ? '' : ' offline'}`} key={p.id}>
          <span className="dot" style={{ background: p.color }} />
          <div className="player-info">
            <div className="player-name">
              {p.name}{p.id === me.id ? ' (you)' : ''}
              {p.caught && <span className="badge caught">caught</span>}
              {!p.connected && <span className="badge offline">offline</span>}
            </div>
            <div className="player-meta">
              {ROLE_LABEL[p.role]} &middot; updated {timeAgo(p.last_update)}
            </div>
          </div>
          {iAmHunter && p.id !== me.id && p.role !== 'spectator' && (
            <button className="btn small" onClick={() => toggleCaught(p)}>
              {p.caught ? 'Uncatch' : 'Caught'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
