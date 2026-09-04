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

function playNotes(notes, waveType, peakGain) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveType;
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0, now + note.start);
    gain.gain.linearRampToValueAtTime(peakGain, now + note.start + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + note.start + note.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.duration + 0.02);
  }
}

// Short descending alarm "wah-wah" for the player who just got tagged.
export function playTagAlertSound() {
  playNotes(
    [
      { freq: 880, start: 0, duration: 0.18 },
      { freq: 660, start: 0.2, duration: 0.18 },
      { freq: 880, start: 0.4, duration: 0.18 },
      { freq: 660, start: 0.6, duration: 0.25 },
    ],
    'square',
    0.25
  );
}

// Short ascending triumphant chime for the hunter who just made a catch.
export function playCatchSound() {
  playNotes(
    [
      { freq: 523.25, start: 0, duration: 0.14 }, // C5
      { freq: 659.25, start: 0.12, duration: 0.14 }, // E5
      { freq: 783.99, start: 0.24, duration: 0.14 }, // G5
      { freq: 1046.5, start: 0.36, duration: 0.32 }, // C6
    ],
    'sine',
    0.28
  );
}
