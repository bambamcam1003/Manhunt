import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../lib/socket.js';
import { fileToResizedDataUrl } from '../lib/image.js';
import { playTagAlertSound } from '../lib/sound.js';
import GameMap from './GameMap.jsx';
import PlayerList from './PlayerList.jsx';
import Chat from './Chat.jsx';
import Avatar from './Avatar.jsx';

const INTERVAL_OPTIONS = [5, 10, 30, 60, 120, 300, 600];
const TAG_RADIUS_OPTIONS = [5, 10, 15, 20, 30, 50, 100];

function formatInterval(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export default function Game({ room, player, players, messages, onLeave }) {
  const [tab, setTab] = useState('map');
  const [geoError, setGeoError] = useState('');
  const [lastSent, setLastSent] = useState(null);
  const [flashing, setFlashing] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const intervalRef = useRef(null);
  const avatarInputRef = useRef(null);
  const wasCaughtRef = useRef(null);

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

  // Flash the screen red + play a sound the moment *this* player transitions
  // into "caught" (proximity auto-tag or a hunter's manual toggle).
  useEffect(() => {
    if (wasCaughtRef.current === null) {
      wasCaughtRef.current = !!me.caught;
      return;
    }
    if (me.caught && !wasCaughtRef.current) {
      setFlashing(true);
      playTagAlertSound();
      if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
      const t = setTimeout(() => setFlashing(false), 700);
      wasCaughtRef.current = true;
      return () => clearTimeout(t);
    }
    wasCaughtRef.current = !!me.caught;
  }, [me.caught]);

  function changeRole(newRole) {
    socket.emit('set-role', { role: newRole });
  }

  function changeInterval(seconds) {
    socket.emit('set-ping-interval', { seconds: Number(seconds) });
  }

  function changeTagRadius(meters) {
    socket.emit('set-tag-radius', { meters: Number(meters) });
  }

  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      socket.emit('set-avatar', { avatar: dataUrl }, (res) => {
        if (!res.ok) setAvatarError(res.error || 'Failed to set photo');
      });
    } catch {
      setAvatarError('Could not process that image');
    }
  }

  return (
    <div className="screen game">
      {flashing && <div className="tag-flash" />}

      <header className="game-header">
        <div className="header-identity">
          <button
            className="avatar-edit-btn"
            onClick={() => avatarInputRef.current?.click()}
            title="Change your photo"
          >
            <Avatar player={me} size={40} />
            <span className="avatar-edit-badge">✎</span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarFile}
          />
          <div>
            <div className="room-name">{room.name}</div>
            <button className="room-code" onClick={copyCode} title="Tap to copy">
              {room.code}
            </button>
          </div>
        </div>
        <div className="header-actions">
          <select value={me.role} onChange={(e) => changeRole(e.target.value)} className="role-select">
            <option value="runner">Runner</option>
            <option value="hunter">Hunter</option>
            <option value="spectator">Spectator</option>
          </select>
          <button className="btn small danger" onClick={onLeave}>Leave</button>
        </div>
      </header>

      {geoError && <div className="banner error">{geoError}</div>}
      {avatarError && <div className="banner error">{avatarError}</div>}

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

      <div className="ping-bar">
        <span>
          Auto-tag within
          <select
            value={room.tag_radius_meters ?? 15}
            onChange={(e) => changeTagRadius(e.target.value)}
          >
            {TAG_RADIUS_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}m</option>
            ))}
          </select>
        </span>
        <span className="last-sent">Hunters auto-catch runners within this range</span>
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
