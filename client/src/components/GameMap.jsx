import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';

const ROLE_EMOJI = { hunter: '🔴', runner: '🏃', spectator: '👀' };

// Cycle order for the layer-toggle button.
const LAYER_ORDER = ['street', 'satellite', 'usgs'];

const LAYERS = {
  street: {
    label: 'Street',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  // Real aerial photography (not a satellite composite), flown specifically
  // under clear-sky conditions -- effectively cloud-free, unlike Esri's
  // imagery which can have clouds baked in for some areas/dates. US-only
  // coverage, and its native detail tops out around z16 (Leaflet upscales
  // beyond that automatically via maxNativeZoom).
  usgs: {
    label: 'USGS Aerial',
    description: 'US only — real aerial photography, no clouds',
    icon: '🌎',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery courtesy USGS The National Map',
    maxZoom: 19,
    maxNativeZoom: 16,
  },
};

function timeAgo(ts) {
  if (!ts) return 'never';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function iconFor(player, isLive) {
  const badge = player.caught ? '💀' : ROLE_EMOJI[player.role] || '📍';
  const opacity = !player.connected ? 0.35 : isLive ? 1 : 0.6;
  const inner = player.avatar
    ? `<img src="${player.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${player.color};font-weight:700;color:#fff;">${(player.name || '?').charAt(0).toUpperCase()}</div>`;

  return L.divIcon({
    className: 'player-marker',
    html: `
      <div class="${isLive ? 'player-marker-live' : ''}" style="position:relative;width:36px;height:36px;opacity:${opacity};">
        <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:3px solid ${player.color};box-shadow:0 2px 6px rgba(0,0,0,0.5);">${inner}</div>
        <div style="position:absolute;bottom:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#1e293b;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;">${badge}</div>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

// Leaflet only measures its container once, when the map is created. If the
// surrounding layout shifts afterward (a banner appears/disappears, the
// ping-bar rows wrap, the tab becomes visible again) the map keeps using its
// stale size and renders tiles for the wrong bounds until something forces a
// redraw — which is why zooming "fixes" it. Watch the container and redraw
// automatically instead of relying on the user to zoom.
function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function FitToPlayers({ players }) {
  const map = useMap();
  const located = players.filter((p) => p.lat != null && p.lng != null);
  useEffect(() => {
    if (located.length === 0) return;
    if (located.length === 1) {
      map.setView([located[0].lat, located[0].lng], 18);
    } else {
      const bounds = L.latLngBounds(located.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.3));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length]);
  return null;
}

// Renders each player's recent-position history as a fading trail of short
// line segments -- older segments are more transparent than newer ones.
function Trails({ trails, playersById }) {
  return (
    <>
      {Array.from(trails.entries()).map(([id, points]) => {
        const player = playersById.get(id);
        if (!player || points.length < 2) return null;
        return points.slice(1).map((point, i) => {
          const prev = points[i];
          const recency = (i + 1) / points.length; // 0 (oldest) .. 1 (newest)
          return (
            <Polyline
              key={`${id}-${i}`}
              positions={[[prev.lat, prev.lng], [point.lat, point.lng]]}
              pathOptions={{ color: player.color, opacity: 0.15 + recency * 0.5, weight: 3 }}
              interactive={false}
            />
          );
        });
      })}
    </>
  );
}

const VISIBILITY_LABEL = {
  hunter: '🔴 Hunters only',
  runner: '🏃 Runners only',
  spectator: '👀 Everyone',
};

const EMPTY_TRAILS = new Map();

export default function GameMap({ players, freshThresholdMs = 60000, viewerRole, trails = EMPTY_TRAILS }) {
  const [layerKey, setLayerKey] = useState('street');
  const layer = LAYERS[layerKey];
  const located = useMemo(() => players.filter((p) => p.lat != null && p.lng != null), [players]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const center = located.length > 0 ? [located[0].lat, located[0].lng] : [37.7749, -122.4194];

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={16} maxZoom={19} zoomControl={false} className="map">
        <TileLayer
          key={layerKey}
          attribution={layer.attribution}
          url={layer.url}
          maxZoom={layer.maxZoom}
          maxNativeZoom={layer.maxNativeZoom}
        />
        <ZoomControl position="bottomright" />
        <InvalidateSizeOnResize />
        <FitToPlayers players={players} />
        <Trails trails={trails} playersById={playersById} />
        {located.map((p) => {
          const isLive = !!p.connected && !!p.last_update && Date.now() - p.last_update < freshThresholdMs;
          return (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={iconFor(p, isLive)}>
              {p.accuracy ? <Circle center={[p.lat, p.lng]} radius={p.accuracy} pathOptions={{ color: p.color, opacity: 0.3 }} /> : null}
              {!isLive && (
                <Tooltip direction="bottom" offset={[0, 4]} permanent className="stale-tooltip">
                  last known &middot; {timeAgo(p.last_update)}
                </Tooltip>
              )}
              <Popup>
                <strong>{p.name}</strong> {p.caught ? '(caught)' : ''}
                <br />
                {p.role}
                <br />
                {isLive ? 'Live' : `Last known — updated ${timeAgo(p.last_update)}`}
                <br />
                {p.connected ? 'Online' : 'Offline'}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <button
        className="layer-toggle"
        onClick={() => {
          const next = LAYER_ORDER[(LAYER_ORDER.indexOf(layerKey) + 1) % LAYER_ORDER.length];
          setLayerKey(next);
        }}
        title={layer.description || 'Cycle map style (street / satellite / USGS aerial)'}
      >
        {layer.icon} {layer.label}
      </button>

      {viewerRole && (
        <div className="visibility-pill" title="You only see your own team's live locations">
          {VISIBILITY_LABEL[viewerRole] || 'Everyone'}
        </div>
      )}
    </div>
  );
}
