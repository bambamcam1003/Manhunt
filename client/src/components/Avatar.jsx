export default function Avatar({ player, size = 36 }) {
  const style = { width: size, height: size, fontSize: size * 0.45 };

  if (player.avatar) {
    return (
      <div className="avatar" style={{ ...style, borderColor: player.color }}>
        <img src={player.avatar} alt={player.name} />
      </div>
    );
  }

  const initial = (player.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="avatar avatar-fallback" style={{ ...style, background: player.color, borderColor: player.color }}>
      {initial}
    </div>
  );
}
