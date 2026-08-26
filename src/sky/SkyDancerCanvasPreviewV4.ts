import type { CartArenaSession } from "../cart/CartArenaSession";
import type { CartRogueSnapshotHandler } from "../cart/CartRogueDemo";
import { installSkyDancerBossCombatV34 } from "./SkyDancerBossCombatV34";
import { installSkyDancerBossDurabilityGuardV34 } from "./SkyDancerBossDurabilityGuardV34";
import { SkyDancerCanvasPreviewV3 } from "./SkyDancerCanvasPreviewV3";
import { installSkyDancerCombatDoctrine } from "./SkyDancerCombatDoctrine";
import { installSkyDancerEnemyPopulation } from "./SkyDancerEnemyPopulation";
import { installSkyDancerFlightDynamics } from "./SkyDancerFlightDynamics";
import { installSkyDancerFlightNaturalMotionV41 } from "./SkyDancerFlightNaturalMotionV41";
import {
  getSkyDancerPlayerWeaponState,
  installSkyDancerPlayerWeapons,
  requestSkyDancerPlayerMissile,
} from "./SkyDancerPlayerWeapons";
import { installSkyDancerReengagementV40 } from "./SkyDancerReengagementV40";
import { bindSkyDancerWeaponSession } from "./SkyDancerWeaponBridge";
import { installSkyDancerInfiniteWorld } from "./SkyDancerInfiniteWorld";

interface CanvasRuntimeView {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  session: CartArenaSession;
  draw: () => void;
}

const GLOBAL_FIRE_KEY = "__skyDancerFireMissile";
const GLOBAL_WEAPON_STATE_KEY = "__skyDancerGetWeaponState";

export class SkyDancerCanvasPreviewV4 extends SkyDancerCanvasPreviewV3 {
  private readonly runtimeV4: CanvasRuntimeView;

  constructor(mount: HTMLElement, onSnapshot: CartRogueSnapshotHandler) {
    super(mount, onSnapshot);
    installSkyDancerCombatDoctrine();
    installSkyDancerEnemyPopulation();
    installSkyDancerPlayerWeapons();
    installSkyDancerFlightDynamics();
    installSkyDancerInfiniteWorld();
    installSkyDancerBossDurabilityGuardV34();
    installSkyDancerBossCombatV34();
    installSkyDancerReengagementV40();
    installSkyDancerFlightNaturalMotionV41();
    this.runtimeV4 = this as unknown as CanvasRuntimeView;
    bindSkyDancerWeaponSession(this.runtimeV4.session);
    if (typeof window !== "undefined") {
      const globals = window as unknown as Record<string, unknown>;
      globals[GLOBAL_FIRE_KEY] = () => requestSkyDancerPlayerMissile(this.runtimeV4.session);
      globals[GLOBAL_WEAPON_STATE_KEY] = () => getSkyDancerPlayerWeaponState(this.runtimeV4.session);
    }
    const previousDraw = this.runtimeV4.draw.bind(this);
    this.runtimeV4.draw = () => {
      previousDraw();
      this.drawPlayerMissiles();
    };
  }

  fireMissile(): void {
    requestSkyDancerPlayerMissile(this.runtimeV4.session);
  }

  private drawPlayerMissiles(): void {
    const { canvas, context: ctx, session } = this.runtimeV4;
    const snapshot = session.snapshot();
    const state = getSkyDancerPlayerWeaponState(session);
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    const scale = Math.min(width / 82, height / 68);
    const centerX = width * 0.5;
    const centerZ = height * 0.62;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const missile of state.missiles) {
      const x = centerX + (missile.x - snapshot.x) * scale;
      const y = centerZ - (missile.z - snapshot.z) * scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(missile.heading);
      const glow = ctx.createRadialGradient(0, 3 * scale, 0, 0, 3 * scale, 2.3 * scale);
      glow.addColorStop(0, "rgba(112,239,255,.78)");
      glow.addColorStop(1, "rgba(112,239,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 3 * scale, 2.3 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(231,253,255,.96)";
      ctx.lineWidth = Math.max(1.2, scale * 0.16);
      ctx.beginPath();
      ctx.moveTo(0, -0.9 * scale);
      ctx.lineTo(0, 1.4 * scale);
      ctx.stroke();
      ctx.strokeStyle = "rgba(87,225,255,.72)";
      ctx.lineWidth = Math.max(1.6, scale * 0.22);
      ctx.beginPath();
      ctx.moveTo(0, 1.1 * scale);
      ctx.lineTo(0, 4.6 * scale);
      ctx.stroke();
      if (missile.targetEnemyId) {
        ctx.strokeStyle = "rgba(133,246,255,.48)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 0.7 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

export { SkyDancerCanvasPreviewV4 as SkyDancerCanvasPreview };
