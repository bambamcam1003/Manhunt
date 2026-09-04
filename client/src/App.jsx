import { useEffect, useState, useCallback } from 'react';
import { socket } from './lib/socket.js';
import Home from './components/Home.jsx';
import Game from './components/Game.jsx';

const STORAGE_KEY = 'manhunt-session';

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    socket.connect();

    function onConnect() {
      setConnected(true);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const { code, playerId } = JSON.parse(saved);
          if (code && playerId) {
            socket.emit('rejoin-room', { code, playerId }, (res) => {
              if (res.ok) {
                setRoom(res.room);
                setPlayer(res.player);
                setMessages(res.messages);
              } else {
                localStorage.removeItem(STORAGE_KEY);
              }
            });
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onRoomState({ room: r, players: p }) {
      setRoom((prev) => (r ? r : prev));
      setPlayers(p || []);
    }
    function onChatMessage(msg) {
      setMessages((prev) => [...prev, msg]);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-state', onRoomState);
    socket.on('chat-message', onChatMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-state', onRoomState);
      socket.off('chat-message', onChatMessage);
    };
  }, []);

  const handleJoined = useCallback(({ room: r, player: p, messages: m }) => {
    setRoom(r);
    setPlayer(p);
    setMessages(m);
    setError('');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: r.code, playerId: p.id }));
  }, []);

  const createRoom = useCallback((form) => {
    setConnecting(true);
    setError('');
    socket.emit('create-room', form, (res) => {
      setConnecting(false);
      if (res.ok) handleJoined(res);
      else setError(res.error || 'Failed to create room');
    });
  }, [handleJoined]);

  const joinRoom = useCallback((form) => {
    setConnecting(true);
    setError('');
    socket.emit('join-room', form, (res) => {
      setConnecting(false);
      if (res.ok) handleJoined(res);
      else setError(res.error || 'Failed to join room');
    });
  }, [handleJoined]);

  const leaveGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRoom(null);
    setPlayer(null);
    setPlayers([]);
    setMessages([]);
    socket.disconnect();
    socket.connect();
  }, []);

  if (!room || !player) {
    return (
      <Home
        onCreate={createRoom}
        onJoin={joinRoom}
        connected={connected}
        connecting={connecting}
        error={error}
      />
    );
  }

  return (
    <Game
      room={room}
      player={player}
      players={players}
      messages={messages}
      onLeave={leaveGame}
    />
  );
}
