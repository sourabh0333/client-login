"use client";

import { useFrame } from "@react-three/fiber";

// One shared clock uniform for every wind-driven shader (grass, leaves, canopies).
export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

export function WindClock() {
  useFrame((_, dt) => {
    windUniforms.uTime.value += Math.min(dt, 0.1);
  });
  return null;
}

// GLSL helpers shared by the wind shaders.
export const windGLSL = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
  float windHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float windNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(windHash(i), windHash(i + vec2(1.0, 0.0)), u.x),
               mix(windHash(i + vec2(0.0, 1.0)), windHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // Gusts roll across the park as slow travelling noise, with a fast flutter on top.
  vec2 windAt(vec2 xz) {
    float gust = windNoise(xz * 0.08 + vec2(uTime * 0.18, uTime * 0.05));
    float flutter = sin(uTime * 2.3 + xz.x * 0.9 + xz.y * 0.6) * 0.5 + 0.5;
    float strength = (0.35 + gust * 0.9) * uWind;
    return vec2(0.8, 0.35) * strength * (0.75 + 0.25 * flutter);
  }
`;
