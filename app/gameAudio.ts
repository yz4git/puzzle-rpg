"use client";

export type GameSfx =
  | "uiSelect"
  | "uiConfirm"
  | "swap"
  | "match"
  | "cascade"
  | "drop"
  | "playerAttack"
  | "block"
  | "heal"
  | "shield"
  | "damage"
  | "pierce"
  | "skill"
  | "enemyBreak"
  | "stageClear"
  | "gameOver";

/**
 * Put a public URL here later (for example /audio/swap.wav) to replace only that sound.
 * Empty means the built-in 8-bit Web Audio synth is used.
 */
export const SFX_ASSET_OVERRIDES: Partial<Record<GameSfx, string>> = {};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function square(freq: number, start: number, duration: number, gain = 0.16, duty: OscillatorType = "square") {
  const c = audioContext();
  if (!c || !master) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = duty;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), start + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function sweep(from: number, to: number, start: number, duration: number, gain = 0.16, type: OscillatorType = "square") {
  const c = audioContext();
  if (!c || !master) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(start: number, duration: number, gain = 0.13) {
  const c = audioContext();
  if (!c || !master) return;
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let bit = 1;
    for (let i = 0; i < data.length; i += 1) {
      const feedback = ((bit >> 0) ^ (bit >> 1)) & 1;
      bit = (bit >> 1) | (feedback << 14);
      data[i] = (bit & 1) ? 0.8 : -0.8;
    }
  }
  const src = c.createBufferSource();
  const amp = c.createGain();
  src.buffer = noiseBuffer;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(amp);
  amp.connect(master);
  src.start(start);
  src.stop(start + duration);
}

function arpeggio(notes: number[], step = 0.045, gain = 0.11) {
  const c = audioContext();
  if (!c) return;
  const t = c.currentTime;
  notes.forEach((n, i) => square(n, t + i * step, step * 1.15, gain));
}

function synth(name: GameSfx) {
  const c = audioContext();
  if (!c) return;
  const t = c.currentTime;
  switch (name) {
    case "uiSelect":
      square(740, t, 0.045, 0.08); break;
    case "uiConfirm":
      square(660, t, 0.05, 0.09); square(990, t + 0.045, 0.065, 0.08); break;
    case "swap":
      sweep(380, 720, t, 0.09, 0.11); break;
    case "match":
      arpeggio([523.25, 659.25, 783.99], 0.035, 0.1); break;
    case "cascade":
      arpeggio([659.25, 783.99, 1046.5], 0.03, 0.11); break;
    case "drop":
      sweep(250, 125, t, 0.075, 0.055, "triangle"); break;
    case "playerAttack":
      sweep(260, 1180, t, 0.14, 0.13); noise(t + 0.095, 0.06, 0.075); break;
    case "block":
      square(150, t, 0.08, 0.14); noise(t, 0.055, 0.12); break;
    case "heal":
      arpeggio([523.25, 659.25, 783.99, 1046.5], 0.055, 0.08); break;
    case "shield":
      arpeggio([392, 523.25, 659.25], 0.045, 0.08); break;
    case "damage":
      noise(t, 0.13, 0.16); sweep(210, 70, t, 0.15, 0.12); break;
    case "pierce":
      sweep(1200, 190, t, 0.16, 0.13); noise(t + 0.045, 0.08, 0.08); break;
    case "skill":
      arpeggio([392, 523.25, 659.25, 783.99, 1046.5], 0.045, 0.1); break;
    case "enemyBreak":
      sweep(520, 90, t, 0.24, 0.13); noise(t + 0.04, 0.18, 0.15); break;
    case "stageClear":
      arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.08, 0.1); break;
    case "gameOver":
      [392, 330, 262, 196].forEach((n, i) => square(n, t + i * 0.13, 0.17, 0.09)); break;
  }
}

export function primeAudio() {
  const c = audioContext();
  if (c?.state === "suspended") void c.resume();
}

export function playSfx(name: GameSfx) {
  const replacement = SFX_ASSET_OVERRIDES[name];
  if (replacement && typeof window !== "undefined") {
    const audio = new Audio(replacement);
    audio.volume = 0.55;
    void audio.play().catch(() => synth(name));
    return;
  }
  synth(name);
}
