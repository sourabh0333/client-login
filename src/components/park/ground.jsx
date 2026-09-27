"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { PATH, PATH_WIDTH } from "./layout";
import { windGLSL, windUniforms } from "./wind";

const pathPoints = PATH.map(([x, z]) => new THREE.Vector2(x, z));

function distanceToPath(x, z) {
  const p = new THREE.Vector2(x, z);
  let best = Infinity;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const ab = b.clone().sub(a);
    const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    best = Math.min(best, a.clone().addScaledVector(ab, t).distanceTo(p));
  }
  return best;
}

const noiseGLSL = /* glsl */ `
  float gHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
  float gNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
  }
  float gFbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * gNoise(p); p *= 2.07; a *= 0.5; }
    return v;
  }
`;

function GroundPlane() {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uPath = { value: pathPoints };
      shader.uniforms.uPathWidth = { value: PATH_WIDTH };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWorld;
          uniform vec2 uPath[${pathPoints.length}];
          uniform float uPathWidth;
          ${noiseGLSL}
          float pathDistance(vec2 p) {
            float d = 1e5;
            for (int i = 0; i < ${pathPoints.length - 1}; i++) {
              vec2 a = uPath[i]; vec2 b = uPath[i + 1];
              vec2 ab = b - a;
              float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
              d = min(d, length(a + ab * t - p));
            }
            return d;
          }`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 xz = vWorld.xz;
          float n = gFbm(xz * 0.35);
          float fine = gNoise(xz * 9.0);
          vec3 grassDark = vec3(0.19, 0.29, 0.10);
          vec3 grassLight = vec3(0.39, 0.50, 0.20);
          vec3 dry = vec3(0.50, 0.49, 0.27);
          vec3 grass = mix(grassDark, grassLight, smoothstep(0.25, 0.8, n));
          grass = mix(grass, dry, smoothstep(0.62, 0.9, gFbm(xz * 0.12 + 7.0)) * 0.45);
          grass *= 0.9 + 0.2 * fine;

          float edgeNoise = (gNoise(xz * 2.5) - 0.5) * 0.28;
          float d = pathDistance(xz) + edgeNoise;
          float onPath = 1.0 - smoothstep(uPathWidth * 0.5 - 0.08, uPathWidth * 0.5 + 0.1, d);
          float worn = 1.0 - smoothstep(uPathWidth * 0.5, uPathWidth * 0.5 + 0.55, d);
          vec3 gravel = mix(vec3(0.62, 0.55, 0.44), vec3(0.74, 0.68, 0.57), gNoise(xz * 22.0));
          gravel *= 0.88 + 0.16 * gNoise(xz * 60.0);
          grass = mix(grass, mix(grass, vec3(0.45, 0.43, 0.3), 0.5), worn * 0.6);
          diffuseColor.rgb = mix(grass, gravel, onPath);`
        );
    };
    return m;
  }, []);

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow material={material}>
      <planeGeometry args={[90, 90, 1, 1]} />
    </mesh>
  );
}

// Instanced grass blades close to the camera; the ground shader carries the far field.
function GrassBlades({ count = 26000 }) {
  const { geometry, material } = useMemo(() => {
    const blade = new THREE.PlaneGeometry(0.014, 1, 1, 3);
    blade.translate(0, 0.5, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const y = bp.getY(i);
      bp.setX(i, bp.getX(i) * (1 - y * 0.85));
    }
    blade.computeVertexNormals();

    const offsets = new Float32Array(count * 4);
    const rand = mulberry32(7);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 6) {
      // Denser in the foreground, where the grass is actually readable.
      const z = THREE.MathUtils.lerp(7.6, -7, Math.pow(rand(), 1.35));
      const spread = THREE.MathUtils.mapLinear(z, 7.6, -7, 4.5, 11);
      const x = (rand() * 2 - 1) * spread + 0.4;
      if (distanceToPath(x, z) < PATH_WIDTH * 0.5 + 0.05) continue;
      offsets.set([x, z, 0.06 + rand() * 0.07, rand() * Math.PI * 2], placed * 4);
      placed++;
    }

    const g = new THREE.InstancedBufferGeometry();
    g.index = blade.index;
    g.attributes.position = blade.attributes.position;
    g.attributes.normal = blade.attributes.normal;
    g.attributes.uv = blade.attributes.uv;
    g.setAttribute("aBlade", new THREE.InstancedBufferAttribute(offsets.subarray(0, placed * 4), 4));
    g.instanceCount = placed;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 60);

    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, windUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          attribute vec4 aBlade;
          varying float vTip;
          varying float vShade;
          ${windGLSL}`
        )
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          float ang = aBlade.w;
          mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
          objectNormal.xz = rot * objectNormal.xz;
          objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), 0.85));`
        )
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = vec3(position);
          transformed.y *= aBlade.z;
          transformed.xz = rot * transformed.xz;
          float h = position.y;
          vec2 w = windAt(aBlade.xy);
          transformed.xz += w * h * h * aBlade.z * 0.9;
          transformed.y -= length(w) * h * h * aBlade.z * 0.25;
          transformed.xz += aBlade.xy;
          vTip = h;
          vShade = fract(sin(dot(aBlade.xy, vec2(12.9, 78.2))) * 437.5);`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vTip;\nvarying float vShade;")
        // Thin blades: light both sides from the up-leaning front normal instead of flipping it.
        .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal);")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec3 base = vec3(0.2, 0.3, 0.1);
          vec3 tip = mix(vec3(0.36, 0.48, 0.18), vec3(0.5, 0.55, 0.26), vShade);
          diffuseColor.rgb = mix(base, tip, smoothstep(0.0, 1.0, vTip));`
        );
    };
    return { geometry: g, material: m };
  }, [count]);

  return <mesh geometry={geometry} material={material} receiveShadow frustumCulled={false} />;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Ground({ grass = 48000 }) {
  return (
    <group>
      <GroundPlane />
      {grass > 0 && <GrassBlades count={grass} />}
    </group>
  );
}
