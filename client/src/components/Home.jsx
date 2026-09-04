import { useState } from 'react';

const INTERVAL_OPTIONS = [
  { label: '5 seconds', value: 5 },
  { label: '10 seconds', value: 10 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
];

export default function Home({ onCreate, onJoin, connected, connecting, error }) {
  const [mode, setMode] = useState('join');
  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('runner');

  const [roomName, setRoomName] = useState('My Manhunt Game');
  const [pingIntervalSeconds, setPingIntervalSeconds] = useState(30);

  const [joinCode, setJoinCode] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!playerName.trim()) return;
    if (mode === 'create') {
      onCreate({ roomName, pingIntervalSeconds, playerName, role });
    } else {
      onJoin({ code: joinCode.trim().toUpperCase(), playerName, role });
    }
  }

  return (
    <div className="screen home">
      <div className="home-card">
        <h1>🏃 Manhunt</h1>
        <p className="subtitle">Track your friends' GPS in realtime &amp; chat during the hunt.</p>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'join' ? 'tab active' : 'tab'}
            onClick={() => setMode('join')}
          >
            Join Game
          </button>
          <button
            type="button"
            className={mode === 'create' ? 'tab active' : 'tab'}
            onClick={() => setMode('create')}
          >
            Create Game
          </button>
        </div>

        <form onSubmit={submit} className="form">
          {mode === 'create' && (
            <label>
              Game name
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="My Manhunt Game"
                maxLength={40}
              />
            </label>
          )}

          {mode === 'join' && (
            <label>
              Room code
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCDE"
                maxLength={5}
                autoCapitalize="characters"
                required
              />
            </label>
          )}

          <label>
            Your name
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              required
            />
          </label>

          <label>
            Your role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="runner">Runner (being hunted)</option>
              <option value="hunter">Hunter (seeking)</option>
              <option value="spectator">Spectator</option>
            </select>
          </label>

          {mode === 'create' && (
            <label>
              GPS ping interval
              <select
                value={pingIntervalSeconds}
                onChange={(e) => setPingIntervalSeconds(Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn primary" disabled={!connected || connecting}>
            {connecting ? 'Connecting...' : mode === 'create' ? 'Create Game' : 'Join Game'}
          </button>

          {!connected && <div className="hint">Connecting to server...</div>}
        </form>
      </div>
    </div>
  );
}
