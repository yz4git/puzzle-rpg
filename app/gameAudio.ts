"use client";

export type GameSfx =
  | "uiSelect" | "uiConfirm" | "swap" | "drop"
  | "step" | "door" | "treasure" | "battleStart" | "escape" | "techAcquire" | "levelUp"
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
let sfxEnabled = true;

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
    case "step": noise(t, 0.025, 0.018); tone(92, t, 0.028, 0.018, "triangle"); break;
    case "door": tone(147, t, 0.055, 0.04, "triangle"); sweep(196, 98, t + 0.045, 0.11, 0.055, "square"); break;
    case "treasure": arp([523, 659, 784, 1047, 1319, 1568], 0.048, 0.06); break;
    case "battleStart": [196, 247, 330, 494].forEach((n, i) => tone(n, t + i * 0.055, 0.085, 0.075)); noise(t + 0.17, 0.08, 0.055); break;
    case "escape": sweep(880, 220, t, 0.16, 0.055, "triangle"); noise(t + 0.08, 0.08, 0.035); break;
    case "techAcquire": arp([392, 523, 659, 784, 1047, 1319], 0.07, 0.075); break;
    case "levelUp": arp([262, 330, 392, 523, 659, 784, 1047], 0.06, 0.075); break;
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

export function setSfxEnabled(enabled: boolean) {
  sfxEnabled = enabled;
}

export type OverdriveSfx = "attack" | "cascade" | "fever" | "jackpot" | "upgrade" | "drop" | "mega" | "final" | "tap" | "rebuild";

/** Dense arcade-style reward sounds used only by PRISM OVERDRIVE. */
export function playOverdriveSfx(name: OverdriveSfx, intensity = 1) {
  if (!sfxEnabled) return;
  const c = audioContext();
  if (!c) return;
  const t = c.currentTime;
  const k = Math.max(0.55, Math.min(1.45, intensity));
  if (name === "tap") {
    tone(520, t, .025, .022 * k, "square");
    tone(1040, t + .012, .018, .012 * k, "triangle");
    return;
  }
  if (name === "rebuild") {
    sweep(1800, 260, t, .12, .038 * k, "triangle");
    arp([392, 523, 659, 988, 1319, 1976], .038, .052 * k, "square");
    tone(98, t + .08, .16, .07 * k, "triangle");
    sweep(260, 1860, t + .13, .2, .05 * k, "sawtooth");
    return;
  }
  if (name === "attack") {
    sweep(140, 1180, t, .105, .09 * k, "sawtooth");
    sweep(1760, 420, t + .045, .12, .065 * k, "square");
    tone(82, t + .085, .12, .09 * k, "triangle");
    noise(t + .07, .085, .075 * k);
    return;
  }
  if (name === "cascade") {
    const pitch = .88 + k * .22;
    arp([659, 784, 988, 1175, 1568, 1976].map((note) => note * pitch), .026, .055 * k, "square");
    sweep(220 * pitch, 1320 * pitch, t + .06, .13, .055 * k, "sawtooth");
    tone(92 * pitch, t + .09, .11, .065 * k, "triangle");
    noise(t + .11, .045, .03 * k);
    return;
  }
  if (name === "drop") {
    const pitch = .9 + k * .12;
    sweep(980 * pitch, 180 * pitch, t, .085, .035 * k, "triangle");
    tone(120 * pitch, t + .07, .055, .055 * k, "triangle");
    noise(t + .065, .035, .022 * k);
    return;
  }
  if (name === "mega") {
    tone(62, t, .22, .13 * k, "triangle");
    sweep(120, 1680, t, .14, .11 * k, "sawtooth");
    sweep(2400, 260, t + .055, .18, .085 * k, "square");
    noise(t + .035, .16, .12 * k);
    arp([659, 988, 1319, 1976], .035, .06 * k, "square");
    return;
  }
  if (name === "final") {
    tone(55, t, .35, .13 * k, "triangle");
    sweep(90, 1760, t, .38, .1 * k, "sawtooth");
    arp([262,392,523,659,784,1047,1319,1568,2093], .042, .07 * k, "square");
    noise(t + .18, .2, .08 * k);
    return;
  }
  if (name === "fever") {
    arp([392, 523, 659, 784, 1047, 1319, 1568], .038, .065 * k, "square");
    sweep(110, 880, t, .22, .07 * k, "sawtooth");
    noise(t + .15, .07, .05 * k);
    return;
  }
  if (name === "jackpot") {
    arp([523, 659, 784, 1047, 1319, 1568, 2093], .042, .078 * k, "square");
    tone(98, t, .25, .12 * k, "triangle");
    tone(196, t + .11, .22, .1 * k, "triangle");
    sweep(240, 2480, t + .08, .28, .075 * k, "sawtooth");
    arp([1047, 1319, 1568, 2093, 2637], .028, .045 * k, "triangle");
    noise(t + .16, .15, .082 * k);
    return;
  }
  arp([330, 494, 659, 988, 1319, 1976], .04, .065 * k, "square");
  sweep(180, 1280, t + .05, .18, .055 * k, "sawtooth");
}

export function playSfx(name: GameSfx) {
  if (!sfxEnabled) return;
  const replacement = SFX_ASSET_OVERRIDES[name];
  if (replacement && typeof window !== "undefined") {
    const audio = new Audio(replacement);
    audio.volume = 0.5;
    void audio.play().catch(() => synth(name));
    return;
  }
  synth(name);
}
