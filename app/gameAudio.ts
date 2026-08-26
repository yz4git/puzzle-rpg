"use client";

export type GameSfx =
  | "uiSelect" | "uiConfirm" | "swap" | "drop"
  | "match" | "matchFire" | "matchWater" | "matchLight" | "matchHeart" | "matchGuard" | "cascade"
  | "playerAttack" | "attackFire" | "attackWater" | "attackLight"
  | "block" | "plateBlock" | "armor" | "heal" | "shield" | "setup"
  | "damage" | "enemyAttack" | "enemyHeavy" | "enemyDrain" | "pierce" | "enemyDisrupt"
  | "skill" | "prismRecycle" | "enemyBreak" | "stageClear" | "gameOver";

/**
 * Replace any individual synthesized effect later without touching combat logic.
 * Example: SFX_ASSET_OVERRIDES.attackFire = "/audio/fire-hit.wav";
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
    master.gain.value = 0.18;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 10;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    master.connect(limiter);
    limiter.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, gain = 0.12, type: OscillatorType = "square") {
  const c = audioContext();
  if (!c || !master) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), start + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function sweep(from: number, to: number, start: number, duration: number, gain = 0.12, type: OscillatorType = "square") {
  const c = audioContext();
  if (!c || !master) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, from), start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  amp.gain.setValueAtTime(Math.max(0.001, gain), start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(start: number, duration: number, gain = 0.1) {
  const c = audioContext();
  if (!c || !master) return;
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let bit = 0x4001;
    for (let i = 0; i < data.length; i += 1) {
      const feedback = ((bit >> 0) ^ (bit >> 1)) & 1;
      bit = (bit >> 1) | (feedback << 14);
      data[i] = (bit & 1) ? 0.8 : -0.8;
    }
  }
  const src = c.createBufferSource();
  const amp = c.createGain();
  src.buffer = noiseBuffer;
  amp.gain.setValueAtTime(Math.max(0.001, gain), start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(amp);
  amp.connect(master);
  src.start(start);
  src.stop(start + duration);
}

function arp(notes: number[], step = 0.045, gain = 0.08, type: OscillatorType = "square") {
  const c = audioContext();
  if (!c) return;
  const t = c.currentTime;
  notes.forEach((n, i) => tone(n, t + i * step, step * 1.12, gain, type));
}

function synth(name: GameSfx) {
  const c = audioContext();
  if (!c) return;
  const t = c.currentTime;
  switch (name) {
    case "uiSelect": tone(760, t, 0.035, 0.045); break;
    case "uiConfirm": tone(640, t, 0.04, 0.055); tone(960, t + 0.04, 0.055, 0.05); break;
    case "swap": sweep(330, 650, t, 0.08, 0.075); break;
    case "drop": sweep(220, 105, t, 0.065, 0.025, "triangle"); break;

    case "match":
    case "matchLight": arp([659, 988, 1319], 0.032, 0.07); break;
    case "matchFire": sweep(260, 720, t, 0.075, 0.075); noise(t + 0.035, 0.045, 0.035); break;
    case "matchWater": tone(440, t, 0.045, 0.05, "triangle"); sweep(720, 360, t + 0.025, 0.085, 0.055, "triangle"); break;
    case "matchHeart": arp([523, 659, 784], 0.05, 0.06, "triangle"); break;
    case "matchGuard": tone(196, t, 0.065, 0.075); tone(392, t + 0.025, 0.08, 0.055); noise(t, 0.035, 0.035); break;
    case "cascade": arp([784, 988, 1175, 1568], 0.025, 0.065); break;

    case "playerAttack":
    case "attackLight": sweep(520, 1760, t, 0.13, 0.11); tone(1760, t + 0.105, 0.06, 0.08); break;
    case "attackFire": sweep(180, 980, t, 0.14, 0.12); noise(t + 0.075, 0.09, 0.095); tone(110, t + 0.12, 0.07, 0.08, "triangle"); break;
    case "attackWater": sweep(880, 220, t, 0.13, 0.09, "triangle"); sweep(330, 760, t + 0.07, 0.11, 0.075, "triangle"); break;

    case "block": tone(160, t, 0.075, 0.09); noise(t, 0.04, 0.055); break;
    case "plateBlock": tone(110, t, 0.09, 0.12); tone(165, t + 0.035, 0.1, 0.085); noise(t, 0.07, 0.08); break;
    case "armor": tone(247, t, 0.045, 0.05); tone(185, t + 0.03, 0.06, 0.045); break;
    case "heal": arp([392, 523, 659, 784, 1047], 0.048, 0.055, "triangle"); break;
    case "shield": arp([196, 294, 392, 588], 0.038, 0.065); noise(t + 0.09, 0.025, 0.02); break;
    case "setup": tone(330, t, 0.06, 0.045, "triangle"); tone(494, t + 0.065, 0.08, 0.05, "triangle"); break;

    case "damage": noise(t, 0.12, 0.125); sweep(210, 65, t, 0.14, 0.105); break;
    case "enemyAttack": sweep(500, 125, t, 0.11, 0.095); noise(t + 0.055, 0.055, 0.06); break;
    case "enemyHeavy": tone(82, t, 0.12, 0.12, "triangle"); noise(t + 0.04, 0.16, 0.13); tone(55, t + 0.12, 0.12, 0.09, "triangle"); break;
    case "enemyDrain": tone(294, t, 0.08, 0.06, "triangle"); tone(220, t + 0.06, 0.08, 0.06, "triangle"); tone(147, t + 0.12, 0.12, 0.075, "triangle"); break;
    case "pierce": sweep(1500, 180, t, 0.15, 0.12); noise(t + 0.04, 0.07, 0.065); break;
    case "enemyDisrupt": tone(370, t, 0.055, 0.065); tone(554, t + 0.04, 0.055, 0.065); tone(277, t + 0.08, 0.08, 0.07); break;

    case "skill": arp([330, 494, 659, 988, 1319], 0.04, 0.07); break;
    case "prismRecycle": arp([262, 392, 523, 784], 0.035, 0.055, "triangle"); break;
    case "enemyBreak": sweep(540, 75, t, 0.23, 0.12); noise(t + 0.035, 0.18, 0.135); break;
    case "stageClear": arp([523, 659, 784, 1047, 1319], 0.075, 0.075); break;
    case "gameOver": [392, 330, 262, 196].forEach((n, i) => tone(n, t + i * 0.13, 0.17, 0.07)); break;
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
    audio.volume = 0.5;
    void audio.play().catch(() => synth(name));
    return;
  }
  synth(name);
}
