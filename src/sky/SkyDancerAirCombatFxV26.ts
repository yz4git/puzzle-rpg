import * as THREE from "three";
import type { CartArenaSessionSnapshot } from "../cart/CartArenaSession";
import type { SkyDancerMissileState } from "./SkyDancerFlightCombat";
import { SkyDancerAirCombatFxV25 } from "./SkyDancerAirCombatFxV25";
import type { SkyDancerFxRuntime } from "./SkyDancerAirCombatFxV2";
import { getSkyDancerTurboState } from "./SkyDancerTurboModel";

/**
 * V26 concentrates Turbo feedback at the moment thrust is released: physical
 * acceleration is paired with a short radial compression field, a bright
 * launch pulse and a restrained camera impulse. The overlay is allocated once
 * and only uniform values change during play.
 */
export class SkyDancerAirCombatFxV26 extends SkyDancerAirCombatFxV25 {
  private readonly runtimeV26: SkyDancerFxRuntime;
  private readonly turboWarp: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private elapsedV26 = 0;
  private burstEnvelope = 0;
  private lastReleaseSerial = 0;

  constructor(runtime: SkyDancerFxRuntime) {
    super(runtime);
    this.runtimeV26 = runtime;
    this.turboWarp = this.createTurboWarp();
    runtime.camera.add(this.turboWarp);
  }

  override update(snapshot: CartArenaSessionSnapshot, missiles: SkyDancerMissileState, delta: number): void {
    super.update(snapshot, missiles, delta);
    const frameDelta = THREE.MathUtils.clamp(delta, 0.001, 0.05);
    this.elapsedV26 += frameDelta;
    const turbo = getSkyDancerTurboState(this.runtimeV26.session);

    if (turbo.releaseSerial > this.lastReleaseSerial) {
      this.lastReleaseSerial = turbo.releaseSerial;
      this.burstEnvelope = 1;
      this.runtimeV26.cameraShake = Math.max(
        this.runtimeV26.cameraShake,
        0.62 + turbo.releaseCharge * 0.48,
      );
      this.runtimeV26.impactFlash = Math.max(this.runtimeV26.impactFlash, 0.2 + turbo.releaseCharge * 0.16);
    }

    const release = turbo.releaseAgeSeconds < 0.95
      ? 1 - THREE.MathUtils.clamp(turbo.releaseAgeSeconds / 0.95, 0, 1)
      : 0;
    this.burstEnvelope = Math.max(release, this.burstEnvelope - frameDelta * 1.55);
    const speed = THREE.MathUtils.clamp(snapshot.speed / 36, 0, 1);
    const uniforms = this.turboWarp.material.uniforms;
    uniforms.uBurst.value = this.burstEnvelope;
    uniforms.uSpeed.value = speed;
    uniforms.uCharge.value = turbo.releaseCharge;
    uniforms.uTime.value = this.elapsedV26;
    this.turboWarp.visible = this.burstEnvelope > 0.01 || snapshot.boostActive;
  }

  private createTurboWarp(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    const material = new THREE.ShaderMaterial({
      name: "sky-dancer-v26-turbo-warp-material",
      uniforms: {
        uBurst: { value: 0 },
        uSpeed: { value: 0 },
        uCharge: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uBurst;
        uniform float uSpeed;
        uniform float uCharge;
        uniform float uTime;

        float hash(float value) {
          return fract(sin(value * 91.173) * 43758.5453);
        }

        void main() {
          vec2 point = vUv - 0.5;
          point.x *= 1.78;
          float radius = length(point);
          float angle = atan(point.y, point.x);
          float spokeCell = floor((angle + 3.14159265) / 6.2831853 * 52.0);
          float spoke = pow(max(0.0, sin(angle * 52.0 + hash(spokeCell) * 5.0)), 18.0);
          float travel = fract(radius * (15.0 + uSpeed * 5.0) - uTime * (7.0 + uBurst * 15.0) + hash(spokeCell));
          float streak = smoothstep(0.72, 0.98, travel) * spoke;
          float tunnel = smoothstep(0.16, 0.88, radius) * (1.0 - smoothstep(0.88, 1.18, radius));
          float launch = (1.0 - smoothstep(0.0, 0.76, radius)) * uBurst * uBurst;
          float alpha = streak * tunnel * (0.08 + uBurst * 0.28 + uCharge * 0.08);
          alpha += launch * 0.075;
          vec3 color = mix(vec3(0.30, 0.78, 1.0), vec3(0.92, 0.99, 1.0), uBurst);
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.34));
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    overlay.name = "sky-dancer-v26-turbo-warp";
    overlay.frustumCulled = false;
    overlay.renderOrder = 1340;
    overlay.visible = false;
    return overlay;
  }
}

export { SkyDancerAirCombatFxV26 as SkyDancerAirCombatFx };
