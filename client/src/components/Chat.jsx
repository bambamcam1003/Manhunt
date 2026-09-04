import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket.js';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Chat({ messages, me }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('chat-message', { text });
    setText('');
  }

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-msg${m.system ? ' system' : ''}${m.playerName === me.name ? ' mine' : ''}`}
          >
            {!m.system && <span className="chat-author">{m.playerName}</span>}
            <span className="chat-text">{m.text}</span>
            <span className="chat-time">{formatTime(m.createdAt)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the group..."
          maxLength={500}
        />
        <button type="submit" className="btn primary small">Send</button>
      </form>
    </div>
  );
}
