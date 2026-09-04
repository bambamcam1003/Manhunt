import { useState } from 'react';
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

function RandomizeTeams({ players }) {
  const eligibleCount = players.filter((p) => p.role !== 'spectator').length;
  const [hunterCount, setHunterCount] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function randomize() {
    setBusy(true);
    setError('');
    socket.emit('randomize-teams', { hunterCount }, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error || 'Failed to randomize teams');
    });
  }

  return (
    <div className="randomize-box">
      <div className="randomize-row">
        <label>
          Hunters
          <input
            type="number"
            min={1}
            max={Math.max(1, eligibleCount - 1)}
            value={hunterCount}
            onChange={(e) => setHunterCount(Number(e.target.value))}
          />
        </label>
        <button
          className="btn small primary"
          onClick={randomize}
          disabled={busy || eligibleCount < 2}
        >
          🎲 Randomize Teams
        </button>
      </div>
      {eligibleCount < 2 && (
        <div className="hint">Need at least 2 hunters/runners (spectators are excluded).</div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

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
      <RandomizeTeams players={players} />
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
