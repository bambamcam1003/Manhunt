import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';

const ROLE_EMOJI = { hunter: '🔴', runner: '🏃', spectator: '👀' };

function iconFor(player) {
  const emoji = player.caught ? '💀' : ROLE_EMOJI[player.role] || '📍';
  const opacity = player.connected ? 1 : 0.4;
  return L.divIcon({
    className: 'player-marker',
    html: `<div style="
      background:${player.color};
      opacity:${opacity};
      width:32px;height:32px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);
      font-size:16px;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function FitToPlayers({ players }) {
  const map = useMap();
  const located = players.filter((p) => p.lat != null && p.lng != null);
  useEffect(() => {
    if (located.length === 0) return;
    if (located.length === 1) {
      map.setView([located[0].lat, located[0].lng], 16);
    } else {
      const bounds = L.latLngBounds(located.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.3));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length]);
  return null;
}

function timeAgo(ts) {
  if (!ts) return 'never';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export default function GameMap({ players }) {
  const located = useMemo(() => players.filter((p) => p.lat != null && p.lng != null), [players]);
  const center = located.length > 0 ? [located[0].lat, located[0].lng] : [37.7749, -122.4194];

  return (
    <MapContainer center={center} zoom={15} className="map">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPlayers players={players} />
      {located.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={iconFor(p)}>
          {p.accuracy ? <Circle center={[p.lat, p.lng]} radius={p.accuracy} pathOptions={{ color: p.color, opacity: 0.3 }} /> : null}
          <Popup>
            <strong>{p.name}</strong> {p.caught ? '(caught)' : ''}
            <br />
            {p.role}
            <br />
            Updated {timeAgo(p.last_update)}
            <br />
            {p.connected ? 'Online' : 'Offline'}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
