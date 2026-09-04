import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../lib/socket.js';
import { fileToResizedDataUrl } from '../lib/image.js';
import { playTagAlertSound, playCatchSound } from '../lib/sound.js';
import GameMap from './GameMap.jsx';
import PlayerList from './PlayerList.jsx';
import Chat from './Chat.jsx';
import Avatar from './Avatar.jsx';

const INTERVAL_OPTIONS = [5, 10, 30, 60, 120, 300, 600];
const TAG_RADIUS_OPTIONS = [10, 15, 25, 50, 75, 100, 200];
const COUNTDOWN_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 300];

function formatInterval(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export default function Game({ room, player, players, messages, onLeave }) {
  const [tab, setTab] = useState('map');
  const [geoError, setGeoError] = useState('');
  const [lastSent, setLastSent] = useState(null);
  const [nextPingAt, setNextPingAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [flashing, setFlashing] = useState(false);
  const [catching, setCatching] = useState(null); // null = off, or the caught player's name
  const [avatarError, setAvatarError] = useState('');
  const intervalRef = useRef(null);
  const avatarInputRef = useRef(null);
  const wasCaughtRef = useRef(null);

  const me = players.find((p) => p.id === player.id) || player;
  const isHunter = me.role === 'hunter';
  const myIntervalSeconds = isHunter
    ? (room.hunter_ping_interval_seconds ?? 30)
    : room.ping_interval_seconds;
  const freshThresholdMs = Math.max(15, myIntervalSeconds * 2.5) * 1000;

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
    const ms = Math.max(5, myIntervalSeconds) * 1000;
    sendLocation();
    setNextPingAt(Date.now() + ms);
    intervalRef.current = setInterval(() => {
      sendLocation();
      setNextPingAt(Date.now() + ms);
    }, ms);
    return () => clearInterval(intervalRef.current);
  }, [myIntervalSeconds, sendLocation]);

  // Ticks once a second purely to keep the "next ping" and "game starts in" countdowns live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pingCountdownSeconds = nextPingAt ? Math.max(0, Math.round((nextPingAt - now) / 1000)) : null;

  const gameStartsAt = room.game_starts_at;
  const gameLive = !!gameStartsAt && now >= gameStartsAt;
  const gameCountingDown = !!gameStartsAt && now < gameStartsAt;
  const gameCountdownSeconds = gameCountingDown ? Math.max(0, Math.ceil((gameStartsAt - now) / 1000)) : 0;
  const won = !!room.winner;

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

  // Flash the screen green + play a sound when *this* hunter successfully
  // tags someone (auto-tag or manual), targeted directly by the server.
  useEffect(() => {
    function onTagSuccess({ targetName }) {
      setCatching(targetName);
      playCatchSound();
      if (navigator.vibrate) navigator.vibrate(150);
    }
    socket.on('tag-success', onTagSuccess);
    return () => socket.off('tag-success', onTagSuccess);
  }, []);

  useEffect(() => {
    if (!catching) return;
    const t = setTimeout(() => setCatching(null), 700);
    return () => clearTimeout(t);
  }, [catching]);

  // Red dot on the Chat tab whenever a new message arrives while we're not
  // looking at it.
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const seenMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > seenMessageCountRef.current && tab !== 'chat') {
      setHasUnreadChat(true);
    }
    seenMessageCountRef.current = messages.length;
  }, [messages.length, tab]);
  useEffect(() => {
    if (tab === 'chat') setHasUnreadChat(false);
  }, [tab]);

  // Recent-position breadcrumb trails, per player. Kept in a ref (not state)
  // so it survives switching away from the Map tab and back — GameMap
  // unmounts/remounts on tab switch, but Game.jsx stays mounted for the
  // whole session. Only ever contains players whose location we can
  // actually see (the server already strips cross-team lat/lng), so trails
  // automatically respect the same team-visibility rule as the markers.
  const trailsRef = useRef(new Map());
  useEffect(() => {
    const TRAIL_MAX_POINTS = 8;
    const TRAIL_MAX_AGE_MS = 10 * 60 * 1000;
    const cutoff = Date.now() - TRAIL_MAX_AGE_MS;

    for (const p of players) {
      if (p.lat == null || p.lng == null || !p.last_update) continue;
      const trail = trailsRef.current.get(p.id) || [];
      const lastPoint = trail[trail.length - 1];
      if (!lastPoint || lastPoint.t !== p.last_update) {
        trail.push({ lat: p.lat, lng: p.lng, t: p.last_update });
        while (trail.length > TRAIL_MAX_POINTS || (trail.length > 1 && trail[0].t < cutoff)) {
          trail.shift();
        }
        trailsRef.current.set(p.id, trail);
      }
    }
  }, [players]);

  function changeRole(newRole) {
    socket.emit('set-role', { role: newRole });
  }

  function changeInterval(seconds) {
    socket.emit('set-ping-interval', { seconds: Number(seconds) });
  }

  function changeHunterInterval(seconds) {
    socket.emit('set-hunter-ping-interval', { seconds: Number(seconds) });
  }

  function changeTagRadius(feet) {
    socket.emit('set-tag-radius', { feet: Number(feet) });
  }

  function changeCountdown(seconds) {
    socket.emit('set-countdown', { seconds: Number(seconds) });
  }

  function handleStartGame() {
    socket.emit('start-game', {});
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
      {catching && (
        <div className="tag-flash catch">
          <div className="tag-flash-label">🎯 You caught {catching}!</div>
        </div>
      )}

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

      {gameCountingDown && (
        <div className="banner countdown">🚦 Game starts in {gameCountdownSeconds}s — get ready!</div>
      )}
      {won && (
        <div className="banner won">🏆 Hunters win! All runners caught.</div>
      )}

      <div className="ping-bar">
        <span>
          ⏱️ Start delay
          <select
            value={room.countdown_seconds ?? 30}
            onChange={(e) => changeCountdown(e.target.value)}
          >
            {COUNTDOWN_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 0 ? 'None' : formatInterval(s)}</option>
            ))}
          </select>
        </span>
        <button className="btn small primary" onClick={handleStartGame}>
          {gameStartsAt ? '🔁 Restart Round' : '🚀 Start Game'}
        </button>
      </div>

      <div className="ping-bar">
        <span>
          🏃 Runners ping
          <select
            value={room.ping_interval_seconds}
            onChange={(e) => changeInterval(e.target.value)}
          >
            {INTERVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>{formatInterval(s)}</option>
            ))}
          </select>
        </span>
        <span>
          🔴 Hunters ping
          <select
            value={room.hunter_ping_interval_seconds ?? 30}
            onChange={(e) => changeHunterInterval(e.target.value)}
          >
            {INTERVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>{formatInterval(s)}</option>
            ))}
          </select>
        </span>
      </div>

      <div className="ping-bar">
        <span className="next-ping">
          {pingCountdownSeconds === null
            ? 'Waiting for GPS...'
            : pingCountdownSeconds <= 0
              ? 'Pinging now...'
              : `Next ping in ${pingCountdownSeconds}s`}
        </span>
        <span className="last-sent">
          {lastSent ? `Last sent ${new Date(lastSent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </span>
      </div>

      <div className="ping-bar">
        <span>
          🎯 Auto-tag within
          <select
            value={room.tag_radius_feet ?? 50}
            onChange={(e) => changeTagRadius(e.target.value)}
          >
            {TAG_RADIUS_OPTIONS.map((ft) => (
              <option key={ft} value={ft}>{ft}ft</option>
            ))}
          </select>
        </span>
        <span className="last-sent">
          {gameLive ? 'Hunters auto-catch runners within this range' : 'Tagging starts once the game begins'}
        </span>
      </div>

      <main className="game-body">
        {tab === 'map' && (
          <GameMap
            players={players}
            freshThresholdMs={freshThresholdMs}
            viewerRole={me.role}
            trails={trailsRef.current}
          />
        )}
        {tab === 'players' && <PlayerList players={players} me={me} gameLive={gameLive} />}
        {tab === 'chat' && <Chat messages={messages} me={me} />}
      </main>

      <nav className="tabbar">
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>🗺️ Map</button>
        <button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>
          👥 Players ({players.length})
        </button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
          💬 Chat
          {hasUnreadChat && <span className="unread-dot" />}
        </button>
      </nav>
    </div>
  );
}
