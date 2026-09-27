"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { windUniforms } from "./wind";

// Late-afternoon sky dome with slow, soft procedural clouds. No textures to download.
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uTime: windUniforms.uTime },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vDir;
          float h(vec2 p) { return fract(sin(dot(p, vec2(12.7, 311.1))) * 43758.55); }
          float n(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
          }
          float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.02; a *= 0.5; } return v; }
          void main() {
            float y = clamp(vDir.y, -0.1, 1.0);
            vec3 horizon = vec3(0.93, 0.90, 0.82);
            vec3 zenith = vec3(0.47, 0.66, 0.86);
            vec3 col = mix(horizon, zenith, pow(smoothstep(0.0, 0.7, y), 0.8));
            vec2 uv = vDir.xz / max(vDir.y + 0.18, 0.05);
            float c = fbm(uv * 0.55 + vec2(uTime * 0.004, 0.0));
            float cloud = smoothstep(0.52, 0.78, c) * smoothstep(0.02, 0.25, y);
            vec3 cloudCol = mix(vec3(0.83, 0.84, 0.86), vec3(1.0, 0.98, 0.94), smoothstep(0.55, 0.85, c));
            col = mix(col, cloudCol, cloud * 0.85);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    []
  );
  return (
    <mesh material={material} scale={80} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}
