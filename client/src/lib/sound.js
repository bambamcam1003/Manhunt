let sharedContext = null;

function getContext() {
  if (!sharedContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    sharedContext = new Ctx();
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume().catch(() => {});
  }
  return sharedContext;
}

// Call from a direct user gesture (e.g. a form submit) so the browser's
// autoplay policy allows this context to actually produce sound later.
export function primeAudioContext() {
  getContext();
}

// Short descending alarm "wah-wah" — no external audio file needed.
export function playTagAlertSound() {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 880, start: 0, duration: 0.18 },
    { freq: 660, start: 0.2, duration: 0.18 },
    { freq: 880, start: 0.4, duration: 0.18 },
    { freq: 660, start: 0.6, duration: 0.25 },
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0, now + note.start);
    gain.gain.linearRampToValueAtTime(0.25, now + note.start + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + note.start + note.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.duration + 0.02);
  }
}
