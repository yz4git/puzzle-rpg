"use client";

export type RPGTrack = "title" | "world" | "village" | "castle" | "dungeon" | "battle" | "boss" | "finalBoss" | "ending";

type TrackData = {
  bpm: number;
  pulseA: number[];
  pulseB: number[];
  bass: number[];
  drums: number[];
};

// Original pulse/pulse/triangle/noise arrangements. 0 is a rest; numbers are MIDI notes.
const TRACKS: Record<RPGTrack, TrackData> = {
  title: {
    bpm: 116,
    pulseA: [69, 0, 72, 76, 74, 0, 72, 69, 67, 0, 69, 72, 64, 0, 67, 69],
    pulseB: [57, 0, 60, 0, 62, 0, 60, 0, 55, 0, 57, 0, 52, 0, 55, 0],
    bass: [45, 0, 45, 0, 43, 0, 40, 0, 41, 0, 41, 0, 40, 0, 43, 0],
    drums: [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 1, 0],
  },
  world: {
    bpm: 126,
    pulseA: [64, 67, 69, 0, 72, 69, 67, 0, 62, 64, 67, 0, 69, 67, 64, 0],
    pulseB: [52, 0, 55, 0, 57, 0, 55, 0, 50, 0, 52, 0, 55, 0, 52, 0],
    bass: [40, 0, 40, 0, 45, 0, 43, 0, 38, 0, 38, 0, 43, 0, 40, 0],
    drums: [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 1, 0],
  },
  village: {
    bpm: 102,
    pulseA: [72, 0, 69, 67, 69, 0, 64, 0, 67, 0, 64, 62, 64, 0, 60, 0],
    pulseB: [60, 0, 57, 0, 55, 0, 52, 0, 55, 0, 52, 0, 50, 0, 48, 0],
    bass: [48, 0, 45, 0, 43, 0, 40, 0, 43, 0, 40, 0, 38, 0, 36, 0],
    drums: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  },
  castle: {
    bpm: 112,
    pulseA: [60, 0, 63, 67, 65, 0, 63, 60, 58, 0, 60, 63, 55, 0, 58, 60],
    pulseB: [48, 0, 51, 0, 53, 0, 51, 0, 46, 0, 48, 0, 43, 0, 46, 0],
    bass: [36, 0, 36, 0, 41, 0, 39, 0, 34, 0, 34, 0, 31, 0, 34, 0],
    drums: [2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 1],
  },
  dungeon: {
    bpm: 94,
    pulseA: [57, 0, 58, 0, 64, 0, 61, 0, 57, 0, 55, 0, 52, 0, 55, 0],
    pulseB: [45, 0, 46, 0, 52, 0, 49, 0, 45, 0, 43, 0, 40, 0, 43, 0],
    bass: [33, 0, 33, 0, 34, 0, 37, 0, 33, 0, 31, 0, 28, 0, 31, 0],
    drums: [2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1, 2, 1, 0, 0],
  },
  battle: {
    bpm: 148,
    pulseA: [69, 72, 76, 72, 74, 77, 81, 77, 67, 70, 74, 70, 72, 76, 79, 76],
    pulseB: [57, 0, 60, 0, 62, 0, 65, 0, 55, 0, 58, 0, 60, 0, 64, 0],
    bass: [45, 45, 40, 40, 41, 41, 45, 45, 43, 43, 38, 38, 40, 40, 43, 43],
    drums: [2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1],
  },
  boss: {
    bpm: 156,
    pulseA: [65, 68, 71, 74, 73, 70, 67, 64, 66, 69, 72, 75, 74, 71, 68, 65],
    pulseB: [53, 0, 56, 0, 59, 0, 56, 0, 54, 0, 57, 0, 60, 0, 57, 0],
    bass: [29, 29, 36, 36, 32, 32, 39, 39, 30, 30, 37, 37, 33, 33, 40, 40],
    drums: [2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2],
  },
  finalBoss: {
    bpm: 168,
    pulseA: [72, 75, 78, 81, 79, 76, 73, 70, 71, 74, 77, 80, 78, 75, 72, 69],
    pulseB: [60, 63, 0, 63, 62, 65, 0, 65, 59, 62, 0, 62, 61, 64, 0, 64],
    bass: [36, 36, 39, 39, 38, 38, 41, 41, 35, 35, 38, 38, 37, 37, 40, 40],
    drums: [2, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1],
  },
  ending: {
    bpm: 88,
    pulseA: [64, 0, 67, 0, 71, 0, 72, 0, 69, 0, 67, 0, 64, 0, 60, 0],
    pulseB: [52, 0, 55, 0, 59, 0, 60, 0, 57, 0, 55, 0, 52, 0, 48, 0],
    bass: [40, 0, 43, 0, 47, 0, 48, 0, 45, 0, 43, 0, 40, 0, 36, 0],
    drums: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  },
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let interval: number | null = null;
let currentTrack: RPGTrack | null = null;
let musicEnabled = true;
let step = 0;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!context) {
    context = new AudioCtx();
    master = context.createGain();
    master.gain.value = 0.09;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

function frequency(midi: number) { return 440 * 2 ** ((midi - 69) / 12); }

function note(midi: number, duration: number, gain: number, type: OscillatorType) {
  const audio = getContext();
  if (!audio || !master || !midi) return;
  const start = audio.currentTime + .012;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency(midi);
  envelope.gain.setValueAtTime(.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + .006);
  envelope.gain.setValueAtTime(gain * .82, start + duration * .62);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + duration * .93);
  oscillator.connect(envelope); envelope.connect(master);
  oscillator.start(start); oscillator.stop(start + duration);
}

function drum(kind: number, duration: number) {
  const audio = getContext();
  if (!audio || !master || !kind) return;
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate / 4, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lfsr = 0x7fff;
    for (let index = 0; index < data.length; index += 1) {
      const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
      lfsr = (lfsr >> 1) | (bit << 14);
      data[index] = lfsr & 1 ? .7 : -.7;
    }
  }
  const source = audio.createBufferSource();
  const envelope = audio.createGain();
  source.buffer = noiseBuffer;
  const start = audio.currentTime + .012;
  envelope.gain.setValueAtTime(kind === 2 ? .035 : .018, start);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + duration * .45);
  source.connect(envelope); envelope.connect(master);
  source.start(start); source.stop(start + duration * .5);
}

function tick() {
  if (!currentTrack || !musicEnabled) return;
  const track = TRACKS[currentTrack];
  const index = step % track.pulseA.length;
  const seconds = 60 / track.bpm / 2;
  note(track.pulseA[index] ?? 0, seconds * .9, .035, "square");
  note(track.pulseB[index] ?? 0, seconds * .82, .021, "square");
  note(track.bass[index] ?? 0, seconds * .94, .046, "triangle");
  drum(track.drums[index] ?? 0, seconds);
  step += 1;
}

export function setRpgMusic(track: RPGTrack, enabled = true) {
  musicEnabled = enabled;
  if (!enabled) { stopRpgMusic(); return; }
  const sameTrack = currentTrack === track && interval !== null;
  currentTrack = track;
  if (sameTrack) return;
  if (interval !== null) window.clearInterval(interval);
  step = 0;
  const audio = getContext();
  if (!audio) return;
  tick();
  const period = 60 / TRACKS[track].bpm / 2 * 1000;
  interval = window.setInterval(tick, period);
}

export function stopRpgMusic() {
  if (interval !== null && typeof window !== "undefined") window.clearInterval(interval);
  interval = null;
  currentTrack = null;
}
