import type { CartArenaSession, CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import { CartRogueCanvasPreview } from "../cart/CartRogueCanvasPreview";
import type { CartRogueSnapshotHandler } from "../cart/CartRogueDemo";
import { getSkyDancerMissileState, installSkyDancerFlightCombat } from "./SkyDancerFlightCombat";

interface CanvasRuntimeView {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  session: CartArenaSession;
  draw: () => void;
}

interface TrailPoint {
  x: number;
  z: number;
  age: number;
}

interface AircraftTrail {
  left: TrailPoint[];
  right: TrailPoint[];
  lastHeading: number;
  sampleClock: number;
  strength: number;
}

interface MissileTrail {
  points: TrailPoint[];
  sampleClock: number;
  seen: boolean;
}

interface Burst2D {
  x: number;
  z: number;
  life: number;
  maxLife: number;
  scale: number;
  color: string;
}

function normalizeAngle(value: number): number {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function localPoint(x: number, z: number, heading: number, localX: number, localZ: number): { x: number; z: number } {
  return {
    x: x + Math.cos(heading) * localX + Math.sin(heading) * localZ,
    z: z - Math.sin(heading) * localX + Math.cos(heading) * localZ,
  };
}

export class SkyDancerCanvasPreviewV2 extends CartRogueCanvasPreview {
  private readonly aircraftTrails = new Map<string, AircraftTrail>();
  private readonly missileTrails = new Map<number, MissileTrail>();
  private readonly enemyAlive = new Map<string, boolean>();
  private readonly bursts: Burst2D[] = [];
  private lastFrameMs = performance.now();
  private missileHitSerial = 0;
  private damageStartMs = 0;
  private damageUntilMs = 0;

  constructor(mount: HTMLElement, onSnapshot: CartRogueSnapshotHandler) {
    super(mount, onSnapshot);
    installSkyDancerFlightCombat();
    const runtime = this as unknown as CanvasRuntimeView;
    runtime.canvas.setAttribute("aria-label", "Sky Dancer Canvas aerial combat fallback");
    runtime.draw = () => this.drawSkyFrame(runtime);
  }

  private drawSkyFrame(runtime: CanvasRuntimeView): void {
    const canvas = runtime.canvas;
    const ctx = runtime.context;
    const snapshot = runtime.session.snapshot();
    const missileState = getSkyDancerMissileState(runtime.session);
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    const now = performance.now();
    const delta = Math.min(0.05, Math.max(0.001, (now - this.lastFrameMs) / 1000));
    this.lastFrameMs = now;

    if (missileState.hitSerial > this.missileHitSerial) {
      this.missileHitSerial = missileState.hitSerial;
      this.damageStartMs = now;
      this.damageUntilMs = now + 1750;
      this.bursts.push({
        x: missileState.lastHitX,
        z: missileState.lastHitZ,
        life: 0.72,
        maxLife: 0.72,
        scale: 1.55,
        color: "#ff6b31",
      });
    }

    this.updateTrails(snapshot, missileState.missiles, delta);
    this.updateBursts(snapshot, delta);

    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#3d98d3");
    sky.addColorStop(0.46, "#83c8ed");
    sky.addColorStop(0.68, "#c0e4f2");
    sky.addColorStop(1, "#809a75");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const scale = Math.min(width / 82, height / 68);
    const centerX = width * 0.5;
    const centerZ = height * 0.62;
    const worldToScreen = (x: number, z: number) => ({
      x: centerX + (x - snapshot.x) * scale,
      y: centerZ - (z - snapshot.z) * scale,
    });

    const damageActive = now < this.damageUntilMs;
    if (damageActive) {
      const age = Math.max(0, (now - this.damageStartMs) / 1000);
      const shake = Math.max(0, 1 - age / 0.5);
      ctx.save();
      ctx.translate(Math.sin(now * 0.105) * shake * 8, Math.cos(now * 0.139) * shake * 5.5);
    }

    this.drawTerrain(ctx, width, height, snapshot.x, snapshot.z);
    this.drawCloudBands(ctx, width, height, snapshot.x, snapshot.z);
    this.drawAircraftTrails(ctx, worldToScreen);
    this.drawMissileTrails(ctx, worldToScreen);

    for (const resource of snapshot.resources) {
      if (resource.collected) continue;
      const p = worldToScreen(resource.x, resource.z);
      this.drawAirPickup(ctx, p.x, p.y, scale, resource.kind === "turbo", now + resource.x * 13);
    }

    for (const obstacle of snapshot.obstacles) {
      if (obstacle.destroyed) continue;
      const p = worldToScreen(obstacle.x, obstacle.z);
      this.drawAirMine(ctx, p.x, p.y, obstacle.scale * scale, now + obstacle.x * 17);
    }

    for (const enemy of snapshot.enemies) {
      if (!enemy.alive) continue;
      const p = worldToScreen(enemy.x, enemy.z);
      const primary = enemy.kind === "boss" ? "#313846" : enemy.kind === "heavy" ? "#8f5f80" : enemy.kind === "chaser" ? "#5ca8cf" : "#d59d45";
      const accent = enemy.kind === "boss" ? "#ff5367" : enemy.kind === "heavy" ? "#efbdd8" : enemy.kind === "chaser" ? "#dbf6ff" : "#fff0b0";
      this.drawFighter(ctx, p.x, p.y, enemy.heading, enemy.radius * scale, primary, accent, enemy.kind === "boss", true, now);
      const ratio = Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp)));
      const barWidth = enemy.radius * 2.1 * scale;
      ctx.fillStyle = "rgba(15,28,42,.76)";
      ctx.fillRect(p.x - barWidth * 0.5, p.y - enemy.radius * 1.75 * scale, barWidth, Math.max(2, 0.15 * scale));
      ctx.fillStyle = enemy.kind === "boss" ? "#ff5f70" : "#8cecff";
      ctx.fillRect(p.x - barWidth * 0.5, p.y - enemy.radius * 1.75 * scale, barWidth * ratio, Math.max(2, 0.15 * scale));
    }

    for (const missile of missileState.missiles) {
      const p = worldToScreen(missile.x, missile.z);
      this.drawMissile(ctx, p.x, p.y, missile.heading, scale, missile.distanceToPlayer, missile.sourceKind === "boss", now + missile.id * 31);
    }

    this.drawAerialGate(ctx, worldToScreen(0, 52), snapshot.arena1GateLocked, scale, now);
    this.drawAerialGate(ctx, worldToScreen(0, 140), snapshot.arena2GateLocked, scale, now + 410);

    this.drawFighter(
      ctx,
      centerX,
      centerZ,
      snapshot.heading,
      1.48 * scale,
      snapshot.boostActive ? "#43c7e7" : "#36a9c9",
      "#effcff",
      false,
      false,
      now,
    );

    if (damageActive) {
      this.drawDamageSmoke(ctx, centerX, centerZ, snapshot.heading, scale, now);
      ctx.restore();
    }

    this.drawBursts(ctx, worldToScreen);
    if (missileState.incomingCount > 0) this.drawMissileWarning(ctx, width, height, missileState.incomingCount, now);
    if (damageActive) this.drawDamageOverlay(ctx, width, height, centerX, centerZ, scale, now);
  }

  private updateTrails(
    snapshot: CartArenaSessionSnapshot,
    missiles: ReturnType<typeof getSkyDancerMissileState>["missiles"],
    delta: number,
  ): void {
    this.updateAircraftTrail("player", snapshot.x, snapshot.z, snapshot.heading, 2.46, snapshot.boostActive, true, delta);
    for (const enemy of snapshot.enemies) {
      if (!enemy.alive) continue;
      this.updateAircraftTrail(enemy.id, enemy.x, enemy.z, enemy.heading, enemy.kind === "boss" ? 2.55 : 2.46, false, false, delta);
    }

    for (const trail of this.aircraftTrails.values()) {
      for (const point of [...trail.left, ...trail.right]) point.age += delta;
      trail.left = trail.left.filter((point) => point.age < 1.25);
      trail.right = trail.right.filter((point) => point.age < 1.25);
    }

    for (const trail of this.missileTrails.values()) trail.seen = false;
    for (const missile of missiles) {
      let trail = this.missileTrails.get(missile.id);
      if (!trail) {
        trail = { points: [], sampleClock: 0, seen: true };
        this.missileTrails.set(missile.id, trail);
      }
      trail.seen = true;
      trail.sampleClock -= delta;
      if (trail.sampleClock <= 0) {
        trail.sampleClock = 0.026;
        trail.points.push({ x: missile.x, z: missile.z, age: 0 });
        if (trail.points.length > 34) trail.points.shift();
      }
    }
    for (const [id, trail] of this.missileTrails) {
      for (const point of trail.points) point.age += delta;
      trail.points = trail.points.filter((point) => point.age < 0.82);
      if (!trail.seen && trail.points.length < 2) this.missileTrails.delete(id);
    }
  }

  private updateAircraftTrail(
    id: string,
    x: number,
    z: number,
    heading: number,
    wingSpan: number,
    boost: boolean,
    player: boolean,
    delta: number,
  ): void {
    let trail = this.aircraftTrails.get(id);
    if (!trail) {
      trail = { left: [], right: [], lastHeading: heading, sampleClock: 0, strength: 0 };
      this.aircraftTrails.set(id, trail);
    }
    const turnRate = Math.abs(normalizeAngle(heading - trail.lastHeading)) / Math.max(0.001, delta);
    trail.lastHeading = heading;
    trail.strength = Math.max(0, Math.min(1, (turnRate - 0.16) * (player ? 0.9 : 0.65) + (boost ? 0.48 : 0)));
    if (trail.strength < 0.08) return;
    trail.sampleClock -= delta;
    if (trail.sampleClock > 0) return;
    trail.sampleClock = player ? 0.038 : 0.055;
    const left = localPoint(x, z, heading, -wingSpan, -0.58);
    const right = localPoint(x, z, heading, wingSpan, -0.58);
    trail.left.push({ ...left, age: 0 });
    trail.right.push({ ...right, age: 0 });
    if (trail.left.length > 30) trail.left.shift();
    if (trail.right.length > 30) trail.right.shift();
  }

  private updateBursts(snapshot: CartArenaSessionSnapshot, delta: number): void {
    for (const enemy of snapshot.enemies) {
      const previous = this.enemyAlive.get(enemy.id);
      if (previous === true && !enemy.alive) {
        this.bursts.push({
          x: enemy.x,
          z: enemy.z,
          life: enemy.kind === "boss" ? 0.9 : 0.68,
          maxLife: enemy.kind === "boss" ? 0.9 : 0.68,
          scale: enemy.kind === "boss" ? 2.1 : 1.05,
          color: enemy.kind === "boss" ? "#ff445e" : "#ffa13c",
        });
      }
      this.enemyAlive.set(enemy.id, enemy.alive);
    }
    for (const burst of this.bursts) burst.life -= delta;
    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      if (this.bursts[index].life <= 0) this.bursts.splice(index, 1);
    }
  }

  private drawAircraftTrails(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, z: number) => { x: number; y: number },
  ): void {
    for (const trail of this.aircraftTrails.values()) {
      if (trail.strength < 0.05) continue;
      for (const side of [trail.left, trail.right]) {
        for (let index = 1; index < side.length; index += 1) {
          const a = side[index - 1];
          const b = side[index];
          const pa = worldToScreen(a.x, a.z);
          const pb = worldToScreen(b.x, b.z);
          const freshness = Math.max(0, 1 - b.age / 1.25);
          ctx.strokeStyle = `rgba(239,251,255,${freshness * trail.strength * 0.32})`;
          ctx.lineWidth = 1 + freshness * 1.4;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
      }
    }
  }

  private drawMissileTrails(
    ctx: CanvasRenderingContext2D,
    worldToScreen: (x: number, z: number) => { x: number; y: number },
  ): void {
    ctx.lineCap = "round";
    for (const trail of this.missileTrails.values()) {
      for (let index = 1; index < trail.points.length; index += 1) {
        const a = trail.points[index - 1];
        const b = trail.points[index];
        const pa = worldToScreen(a.x, a.z);
        const pb = worldToScreen(b.x, b.z);
        const freshness = Math.max(0, 1 - b.age / 0.82);
        ctx.strokeStyle = `rgba(231,235,237,${freshness * 0.48})`;
        ctx.lineWidth = 1.5 + freshness * 2.5;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
  }

  private drawTerrain(ctx: CanvasRenderingContext2D, width: number, height: number, worldX: number, worldZ: number): void {
    const horizon = height * 0.37;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, width, height - horizon);
    ctx.clip();
    const land = ctx.createLinearGradient(0, horizon, 0, height);
    land.addColorStop(0, "#82966d");
    land.addColorStop(1, "#5f7652");
    ctx.fillStyle = land;
    ctx.fillRect(0, horizon, width, height - horizon);

    const tile = Math.max(32, Math.min(width, height) * 0.105);
    const offsetX = ((worldX * 0.58) % tile + tile) % tile;
    const offsetZ = ((worldZ * 0.44) % tile + tile) % tile;
    const palette = ["#789255", "#9d8d56", "#6c8853", "#a27752", "#819b62"];
    let row = 0;
    for (let y = horizon - tile - offsetZ; y < height + tile; y += tile, row += 1) {
      let col = 0;
      for (let x = -tile - offsetX; x < width + tile; x += tile, col += 1) {
        const perspective = 0.48 + Math.max(0, (y - horizon) / Math.max(1, height - horizon)) * 0.75;
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = palette[(row * 3 + col * 5) % palette.length];
        ctx.fillRect(x, y, tile * perspective + 1, tile * perspective + 1);
      }
    }
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = "#4c8ea6";
    ctx.lineWidth = Math.max(5, width * 0.011);
    ctx.beginPath();
    ctx.moveTo(width * 0.04, height * 0.96);
    ctx.bezierCurveTo(width * 0.26, height * 0.69, width * 0.31, height * 0.53, width * 0.47, horizon - 5);
    ctx.stroke();
    ctx.restore();
  }

  private drawCloudBands(ctx: CanvasRenderingContext2D, width: number, height: number, worldX: number, worldZ: number): void {
    ctx.save();
    const driftX = ((worldX * 1.35) % 150 + 150) % 150;
    const driftY = ((worldZ * 0.31) % 72 + 72) % 72;
    for (let row = 0; row < 2; row += 1) {
      for (let col = -1; col < 7; col += 1) {
        const x = col * 150 - driftX + row * 57;
        const y = height * 0.47 + row * 72 - driftY;
        const gradient = ctx.createRadialGradient(x, y, 4, x, y, 54);
        gradient.addColorStop(0, "rgba(250,254,255,.28)");
        gradient.addColorStop(1, "rgba(250,254,255,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, 62, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawFighter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heading: number,
    radius: number,
    primary: string,
    accent: string,
    boss: boolean,
    enemy: boolean,
    now: number,
  ): void {
    const s = radius / 1.48;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);

    const glow = ctx.createRadialGradient(0, 1.25 * s, 0, 0, 1.25 * s, 2.5 * s);
    glow.addColorStop(0, enemy ? "rgba(255,166,64,.22)" : "rgba(83,220,255,.26)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 1.2 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(0, -2.35 * s);
    ctx.lineTo(0.46 * s, -1.0 * s);
    ctx.lineTo(2.58 * s, 0.18 * s);
    ctx.lineTo(0.72 * s, -0.08 * s);
    ctx.lineTo(0.82 * s, 1.75 * s);
    ctx.lineTo(0, 1.28 * s);
    ctx.lineTo(-0.82 * s, 1.75 * s);
    ctx.lineTo(-0.72 * s, -0.08 * s);
    ctx.lineTo(-2.58 * s, 0.18 * s);
    ctx.lineTo(-0.46 * s, -1.0 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, -2.35 * s);
    ctx.lineTo(0.22 * s, -0.86 * s);
    ctx.lineTo(-0.22 * s, -0.86 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-1.72 * s, 0.02 * s, 3.44 * s, 0.12 * s);

    ctx.fillStyle = "#173b55";
    ctx.beginPath();
    ctx.ellipse(0, -0.34 * s, 0.32 * s, 0.63 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const exhaustAlpha = 0.62 + Math.sin(now * 0.032 + (enemy ? 1.4 : 0)) * 0.12;
    ctx.fillStyle = enemy ? `rgba(255,166,55,${exhaustAlpha})` : `rgba(91,225,255,${exhaustAlpha})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 0.34 * s - 0.16 * s, 1.18 * s);
      ctx.lineTo(side * 0.34 * s, (boss ? 3.2 : 2.75) * s);
      ctx.lineTo(side * 0.34 * s + 0.16 * s, 1.18 * s);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#ff4a57";
    ctx.beginPath();
    ctx.arc(-2.42 * s, 0.18 * s, 0.07 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#65ffb2";
    ctx.beginPath();
    ctx.arc(2.42 * s, 0.18 * s, 0.07 * s, 0, Math.PI * 2);
    ctx.fill();

    if (boss) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, 0.12 * s);
      ctx.strokeRect(-2.1 * s, 0.36 * s, 0.5 * s, 1.3 * s);
      ctx.strokeRect(1.6 * s, 0.36 * s, 0.5 * s, 1.3 * s);
    }
    ctx.restore();
  }

  private drawAirPickup(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, turbo: boolean, now: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(now * 0.0012);
    const color = turbo ? "#69e3ff" : "#ffc066";
    ctx.strokeStyle = color;
    ctx.fillStyle = turbo ? "rgba(105,227,255,.28)" : "rgba(255,192,102,.28)";
    ctx.lineWidth = Math.max(1, scale * 0.08);
    for (const radius of [0.72, 1.08]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, -0.62 * scale);
    ctx.lineTo(0.52 * scale, 0);
    ctx.lineTo(0, 0.62 * scale);
    ctx.lineTo(-0.52 * scale, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawAirMine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(now * 0.0007);
    ctx.fillStyle = "#46515b";
    ctx.strokeStyle = "#67e4ff";
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      const r = index % 2 ? size * 0.55 : size;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(255,104,64,${0.65 + Math.sin(now * 0.01) * 0.2})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMissile(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, scale: number, distance: number, boss: boolean, now: number): void {
    const danger = Math.max(0, Math.min(1, (14 - distance) / 12));
    const s = scale * (0.33 + danger * 0.09);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.strokeStyle = boss ? `rgba(255,68,91,${0.42 + danger * 0.48})` : `rgba(255,196,75,${0.32 + danger * 0.5})`;
    ctx.lineWidth = Math.max(1, 0.14 * s);
    ctx.beginPath();
    ctx.arc(0, -0.65 * s, (1.1 + danger * 0.7 + Math.sin(now * 0.016) * 0.08) * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = boss ? "#ff435a" : "#eae1d2";
    ctx.beginPath();
    ctx.moveTo(0, -2.1 * s);
    ctx.lineTo(0.48 * s, 0.62 * s);
    ctx.lineTo(0, 0.34 * s);
    ctx.lineTo(-0.48 * s, 0.62 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,178,54,${0.68 + danger * 0.28})`;
    ctx.beginPath();
    ctx.moveTo(-0.28 * s, 0.56 * s);
    ctx.lineTo(0, 2.65 * s);
    ctx.lineTo(0.28 * s, 0.56 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawAerialGate(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, locked: boolean, scale: number, now: number): void {
    const radius = 6.2 * scale;
    ctx.save();
    ctx.strokeStyle = locked ? "rgba(255,86,107,.72)" : "rgba(105,231,255,.66)";
    ctx.lineWidth = Math.max(2, 0.14 * scale);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * (1 + Math.sin(now * 0.004) * 0.012), 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth *= 0.45;
    ctx.globalAlpha = 0.48;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBursts(ctx: CanvasRenderingContext2D, worldToScreen: (x: number, z: number) => { x: number; y: number }): void {
    for (const burst of this.bursts) {
      const p = worldToScreen(burst.x, burst.z);
      const ratio = Math.max(0, burst.life / burst.maxLife);
      const progress = 1 - ratio;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,244,202,${ratio * 0.78})`;
      ctx.beginPath();
      ctx.arc(0, 0, (5 + progress * 22) * burst.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = burst.color;
      ctx.globalAlpha = ratio * 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, (9 + progress * 38) * burst.scale, 0, Math.PI * 2);
      ctx.stroke();
      for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 6 * burst.scale, Math.sin(angle) * 6 * burst.scale);
        ctx.lineTo(Math.cos(angle) * (18 + progress * 36) * burst.scale, Math.sin(angle) * (18 + progress * 36) * burst.scale);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawDamageSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, scale: number, now: number): void {
    const age = Math.max(0, (now - this.damageStartMs) / 1000);
    const strength = Math.max(0, 1 - age / 1.75);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    const side = this.missileHitSerial % 2 === 0 ? -0.38 : 0.38;
    for (let index = 0; index < 9; index += 1) {
      const phase = (age * 0.8 + index * 0.13) % 1;
      ctx.fillStyle = `rgba(30,32,36,${strength * (1 - phase) * 0.30})`;
      ctx.beginPath();
      ctx.arc(side * scale + Math.sin(index * 1.7) * phase * scale * 0.35, (1.6 + phase * 5.2) * scale, (0.24 + phase * 0.72) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,94,38,${strength * (0.45 + Math.sin(now * 0.035) * 0.18)})`;
    ctx.beginPath();
    ctx.moveTo((side - 0.18) * scale, 1.25 * scale);
    ctx.lineTo(side * scale, 3.0 * scale);
    ctx.lineTo((side + 0.18) * scale, 1.25 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawMissileWarning(ctx: CanvasRenderingContext2D, width: number, height: number, count: number, now: number): void {
    ctx.save();
    const pulse = 0.68 + Math.sin(now * 0.012) * 0.18;
    const w = Math.min(205, width * 0.4);
    const x = width * 0.5 - w * 0.5;
    const y = height * 0.14;
    ctx.fillStyle = `rgba(82,12,22,${pulse})`;
    ctx.strokeStyle = "rgba(255,216,108,.95)";
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, 29);
    ctx.strokeRect(x, y, w, 29);
    ctx.fillStyle = "#fff1c8";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`MISSILE INBOUND ×${count}`, width * 0.5, y + 19);
    ctx.restore();
  }

  private drawDamageOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, x: number, y: number, scale: number, now: number): void {
    const age = Math.max(0, (now - this.damageStartMs) / 1000);
    const flash = Math.max(0, 1 - age / 0.32);
    const damage = Math.max(0, 1 - age / 1.75);
    ctx.save();
    ctx.strokeStyle = `rgba(255,76,54,${damage * 0.78})`;
    ctx.lineWidth = Math.max(8, Math.min(width, height) * 0.035);
    ctx.strokeRect(ctx.lineWidth * 0.5, ctx.lineWidth * 0.5, width - ctx.lineWidth, height - ctx.lineWidth);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,220,169,${damage * 0.72})`;
    ctx.lineWidth = Math.max(2, 0.16 * scale);
    ctx.beginPath();
    ctx.arc(x, y, (2.1 + age * 4.8) * scale, 0, Math.PI * 2);
    ctx.stroke();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,242,221,${flash * 0.28})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(91,8,16,${damage * 0.72})`;
    const labelWidth = Math.min(184, width * 0.34);
    ctx.fillRect(width * 0.5 - labelWidth * 0.5, height * 0.23, labelWidth, 30);
    ctx.fillStyle = "#fff3df";
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("MISSILE HIT", width * 0.5, height * 0.23 + 20);
    ctx.restore();
  }
}

export { SkyDancerCanvasPreviewV2 as SkyDancerCanvasPreview };
