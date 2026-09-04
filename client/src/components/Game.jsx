import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../lib/socket.js';
import GameMap from './GameMap.jsx';
import PlayerList from './PlayerList.jsx';
import Chat from './Chat.jsx';

const INTERVAL_OPTIONS = [5, 10, 30, 60, 120, 300, 600];

function formatInterval(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export default function Game({ room, player, players, messages, onLeave }) {
  const [tab, setTab] = useState('map');
  const [geoError, setGeoError] = useState('');
  const [lastSent, setLastSent] = useState(null);
  const [role, setRole] = useState(player.role);
  const intervalRef = useRef(null);

  const me = players.find((p) => p.id === player.id) || player;

  const sendLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported on this device/browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoError('');
        setLastSent(Date.now());
        socket.emit('location-update', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location permission denied. Enable it in your browser settings.'
            : `Location error: ${err.message}`
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, []);

  useEffect(() => {
    sendLocation();
    const ms = Math.max(5, room.ping_interval_seconds) * 1000;
    intervalRef.current = setInterval(sendLocation, ms);
    return () => clearInterval(intervalRef.current);
  }, [room.ping_interval_seconds, sendLocation]);

  function changeRole(newRole) {
    setRole(newRole);
    socket.emit('set-role', { role: newRole });
  }

  function changeInterval(seconds) {
    socket.emit('set-ping-interval', { seconds: Number(seconds) });
  }

  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
  }

  return (
    <div className="screen game">
      <header className="game-header">
        <div>
          <div className="room-name">{room.name}</div>
          <button className="room-code" onClick={copyCode} title="Tap to copy">
            {room.code}
          </button>
        </div>
        <div className="header-actions">
          <select value={role} onChange={(e) => changeRole(e.target.value)} className="role-select">
            <option value="runner">Runner</option>
            <option value="hunter">Hunter</option>
            <option value="spectator">Spectator</option>
          </select>
          <button className="btn small danger" onClick={onLeave}>Leave</button>
        </div>
      </header>

      {geoError && <div className="banner error">{geoError}</div>}

      <div className="ping-bar">
        <span>
          Ping every
          <select
            value={room.ping_interval_seconds}
            onChange={(e) => changeInterval(e.target.value)}
          >
            {INTERVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>{formatInterval(s)}</option>
            ))}
          </select>
        </span>
        <span className="last-sent">
          {lastSent ? `Last sent ${new Date(lastSent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for GPS...'}
        </span>
      </div>

      <main className="game-body">
        {tab === 'map' && <GameMap players={players} />}
        {tab === 'players' && <PlayerList players={players} me={me} />}
        {tab === 'chat' && <Chat messages={messages} me={me} />}
      </main>

      <nav className="tabbar">
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>🗺️ Map</button>
        <button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>
          👥 Players ({players.length})
        </button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>💬 Chat</button>
      </nav>
    </div>
  );
}
