import * as THREE from "three";

interface ReferencePolishRuntime {
  scene: THREE.Scene;
}

/**
 * Final visual-match pass for the V30 high-altitude presentation.
 *
 * V30 already owns ground integrity. This controller only tightens the supplied
 * flight-combat reference match: deeper blue sky, a larger right-front skyline,
 * thinner low cloud cover and stronger readable ground colour. It intentionally
 * runs after SkyDancerWorldPresentationV30 so those choices stay centralized and
 * deterministic instead of reopening older scenery layers.
 */
export class SkyDancerReferencePolishV30 {
  private prepared = false;

  constructor(private readonly runtime: ReferencePolishRuntime) {}

  update(): void {
    if (this.prepared) return;

    const scene = this.runtime.scene;
    const sky = scene.getObjectByName("sky-dancer-v30-sky");
    const skyline = scene.getObjectByName("sky-dancer-v29-reference-skyline");
    const fields = scene.getObjectByName("sky-dancer-v30-patchwork-fields");
    if (!(sky instanceof THREE.Mesh)
      || !(sky.material instanceof THREE.ShaderMaterial)
      || !skyline
      || !(fields instanceof THREE.InstancedMesh)) return;

    // Shader colours are authored in linear space. These values intentionally
    // look much darker numerically than CSS/sRGB colours so the rendered result
    // lands near the saturated blue of the supplied reference instead of cyan.
    sky.material.fragmentShader = `
      precision highp float;
      varying vec3 vDirection;
      void main() {
        float h = normalize(vDirection).y;
        float horizonMix = smoothstep(-0.20, 0.42, h);
        float zenithMix = smoothstep(0.36, 0.98, h);
        vec3 horizon = vec3(0.030, 0.300, 0.650);
        vec3 body = vec3(0.014, 0.220, 0.530);
        vec3 zenith = vec3(0.004, 0.085, 0.285);
        vec3 skyColor = mix(horizon, body, horizonMix);
        skyColor = mix(skyColor, zenith, zenithMix);
        float glow = pow(max(0.0, 1.0 - abs(h)), 13.0);
        skyColor += vec3(0.018, 0.035, 0.040) * glow;
        gl_FragColor = vec4(skyColor, 1.0);
      }
    `;
    sky.material.needsUpdate = true;

    // Keep the city clearly readable in the right-front quadrant without
    // clipping it against the screen edge during the neutral chase view.
    skyline.position.set(-24, 0, 205);
    skyline.scale.setScalar(1.12);

    const lake = scene.getObjectByName("sky-dancer-v28-valley-lake");
    if (lake instanceof THREE.Mesh) {
      lake.position.x = -12;
      lake.position.z = 198;
      lake.scale.set(1.82, 0.82, 1);
    }

    // The original SkyDancerWebGLDemo cloud deck predates named V28/V29 cloud
    // layers. It is an unnamed Dodecahedron InstancedMesh and was the main cause
    // of the giant pale polygons covering the valley in real V30 captures.
    this.tuneBaseCloudDeck();
    this.tuneCloud("sky-dancer-v28-layered-cloud-banks", 0.07, 0.48, 7);
    this.tuneCloud("sky-dancer-v29-reference-cloud-bank", 0.09, 0.52, 6);

    if (fields.material instanceof THREE.MeshBasicMaterial) {
      fields.material.toneMapped = false;
      fields.material.needsUpdate = true;
    }

    const river = scene.getObjectByName("sky-dancer-v30-river");
    river?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshBasicMaterial) {
          material.toneMapped = false;
          material.needsUpdate = true;
        }
      }
    });

    // Keep distance haze, but delay it so fields, water and the skyline survive
    // the 300 m camera view rather than collapsing into one pale cyan plane.
    scene.background = new THREE.Color(0x0f6fad);
    scene.fog = new THREE.Fog(0x4b9fc4, 700, 1650);

    this.prepared = true;
  }

  private tuneBaseCloudDeck(): void {
    for (const object of this.runtime.scene.children) {
      if (!(object instanceof THREE.InstancedMesh) || object.name) continue;
      if (object.geometry.type !== "DodecahedronGeometry") continue;
      if (!(object.material instanceof THREE.MeshLambertMaterial)) continue;
      if (object.material.color.getHex() !== 0xf7fcff) continue;

      object.name = "sky-dancer-v30-base-cloud-deck";
      object.scale.setScalar(0.46);
      object.position.y += 10;
      object.material.opacity = 0.045;
      object.material.color.setHex(0xf7fbff);
      object.material.needsUpdate = true;
      return;
    }
  }

  private tuneCloud(name: string, opacity: number, scale: number, lift: number): void {
    const cloud = this.runtime.scene.getObjectByName(name);
    if (!(cloud instanceof THREE.InstancedMesh)) return;
    cloud.scale.setScalar(scale);
    if (cloud.userData.skyDancerV30ReferenceLift !== true) {
      cloud.position.y += lift;
      cloud.userData.skyDancerV30ReferenceLift = true;
    }
    if (cloud.material instanceof THREE.MeshLambertMaterial) {
      cloud.material.opacity = opacity;
      cloud.material.color.setHex(0xf7fbff);
      cloud.material.needsUpdate = true;
    }
  }
}
