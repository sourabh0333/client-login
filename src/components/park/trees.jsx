"use client";

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useMemo } from "react";
import { TREES } from "./layout";
import { mulberry32 } from "./ground";
import { windGLSL, windUniforms } from "./wind";

// ---------------------------------------------------------------------------------------
// Textures, drawn once on canvases: a sprig of leaves (with alpha) and a strip of bark.

function leafTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const rand = mulberry32(11);
  // Leaves radiate from a few twig points so a card reads as a sprig, not confetti.
  const hubs = Array.from({ length: 5 }, () => [size * (0.3 + rand() * 0.4), size * (0.3 + rand() * 0.4)]);
  for (let i = 0; i < 70; i++) {
    const [hx, hy] = hubs[i % hubs.length];
    const ang = rand() * Math.PI * 2;
    const dist = 30 + rand() * 170;
    const x = hx + Math.cos(ang) * dist;
    const y = hy + Math.sin(ang) * dist;
    if (x < 30 || y < 30 || x > size - 30 || y > size - 30) continue;
    const len = 34 + rand() * 26;
    const wid = len * (0.42 + rand() * 0.12);
    g.save();
    g.translate(x, y);
    g.rotate(ang + (rand() - 0.5) * 0.8);
    const light = 0.35 + rand() * 0.3;
    g.fillStyle = `hsl(${88 + rand() * 20}, ${38 + rand() * 18}%, ${Math.round(light * 60)}%)`;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.quadraticCurveTo(0, -wid, len / 2, 0);
    g.quadraticCurveTo(0, wid, -len / 2, 0);
    g.fill();
    // Midrib and a lighter upper half give each leaf some form.
    g.strokeStyle = "rgba(230,240,190,0.25)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.lineTo(len / 2, 0);
    g.stroke();
    g.fillStyle = "rgba(255,255,220,0.07)";
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.quadraticCurveTo(0, -wid, len / 2, 0);
    g.closePath();
    g.fill();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function barkTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  const rand = mulberry32(5);
  g.fillStyle = "#5a4a3c";
  g.fillRect(0, 0, 128, 256);
  // Vertical furrows and ridges.
  for (let i = 0; i < 90; i++) {
    const x = rand() * 128;
    const w = 1 + rand() * 4;
    g.fillStyle = rand() < 0.5 ? `rgba(30,22,16,${0.25 + rand() * 0.35})` : `rgba(150,135,115,${0.12 + rand() * 0.2})`;
    let y = rand() * 40 - 40;
    while (y < 256) {
      const h = 20 + rand() * 60;
      g.fillRect(x + (rand() - 0.5) * 3, y, w, h);
      y += h + rand() * 12;
    }
  }
  // Lichen flecks.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(140,150,110,${0.15 + rand() * 0.2})`;
    g.fillRect(rand() * 128, rand() * 256, 2 + rand() * 4, 2 + rand() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------------------------------------------------------------------------------------
// Geometry: a recursive branching skeleton, bark tubes, and leaf cards on the twigs.

function tube(points, r0, r1, radial) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = Math.max(3, points.length * 2);
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const v = new THREE.Vector3();
  const ring = radial + 1;
  const length = curve.getLength();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / ring) / segs;
    const center = curve.getPointAt(Math.min(t, 1));
    v.fromBufferAttribute(pos, i).sub(center);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    v.multiplyScalar(r);
    pos.setXYZ(i, center.x + v.x, center.y + v.y, center.z + v.z);
    // Bark tiles around the girth and along the length at a constant scale.
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(r0 * 12)), t * length * 1.5);
  }
  g.computeVertexNormals();
  return g;
}

function growTree(seed) {
  const rand = mulberry32(seed * 7919);
  const wood = [];
  const leafSpots = [];
  const trunkH = 1.35 + rand() * 0.5;

  const branch = (start, dir, length, radius, depth) => {
    const pts = [start.clone()];
    const d = dir.clone();
    let p = start.clone();
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      // Branches wander a little and droop towards their tips.
      d.x += (rand() - 0.5) * 0.35;
      d.z += (rand() - 0.5) * 0.35;
      d.y += depth > 1 ? -0.08 : 0.02;
      d.normalize();
      p = p.clone().addScaledVector(d, length / steps);
      pts.push(p);
    }
    wood.push(tube(pts, radius, radius * 0.45, depth === 0 ? 10 : depth === 1 ? 7 : 5));

    // Foliage along the outer branches as well as at the twig tips.
    if (depth >= 2) leafSpots.push({ p: pts[2].clone(), size: 0.9 });
    if (depth >= 4 || radius < 0.008) {
      leafSpots.push({ p: p.clone(), size: 1 });
      leafSpots.push({ p: pts[3].clone(), size: 0.85 });
      return;
    }
    const children = depth === 0 ? 4 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2);
    for (let c = 0; c < children; c++) {
      const at = pts[Math.min(pts.length - 1, 1 + Math.floor(rand() * (pts.length - 1)))];
      const around = (c / children) * Math.PI * 2 + rand() * 0.8;
      const spread = depth === 0 ? 0.75 + rand() * 0.25 : 0.55 + rand() * 0.35;
      // Main limbs reach outwards to make a broad, rounded crown; finer ones turn upwards.
      const rise = depth === 0 ? 0.35 + rand() * 0.35 : 0.45 + rand() * 0.45;
      const nd = new THREE.Vector3(Math.cos(around) * spread, rise, Math.sin(around) * spread)
        .normalize()
        .lerp(d, depth === 0 ? 0.15 : 0.4)
        .normalize();
      branch(at, nd, length * (0.6 + rand() * 0.15), radius * 0.58, depth + 1);
    }
    if (depth > 0) leafSpots.push({ p: p.clone(), size: 1.2 });
  };

  // Trunk, then the crown.
  const trunkTop = new THREE.Vector3((rand() - 0.5) * 0.3, trunkH, (rand() - 0.5) * 0.3);
  wood.push(
    tube(
      [new THREE.Vector3(0, -0.15, 0), new THREE.Vector3((rand() - 0.5) * 0.1, trunkH * 0.5, (rand() - 0.5) * 0.1), trunkTop],
      0.24,
      0.15,
      12
    )
  );
  branch(trunkTop, new THREE.Vector3(0, 1, 0), 2.3 + rand() * 0.5, 0.15, 0);

  // Canopy centre, for soft "volume" normals and inner shading.
  const center = new THREE.Vector3();
  leafSpots.forEach((l) => center.add(l.p));
  center.divideScalar(leafSpots.length);
  let radius = 0;
  leafSpots.forEach((l) => (radius = Math.max(radius, l.p.distanceTo(center))));

  // Leaf cards: a few randomly turned quads per spot, sized to the spot.
  const cards = [];
  const color = new THREE.Color();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  for (const spot of leafSpots) {
    const n = 3 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const s = (0.85 + rand() * 0.6) * spot.size;
      const g = new THREE.PlaneGeometry(s, s);
      e.set(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI);
      q.setFromEuler(e);
      g.applyQuaternion(q);
      g.translate(spot.p.x + (rand() - 0.5) * 0.5, spot.p.y + (rand() - 0.3) * 0.4, spot.p.z + (rand() - 0.5) * 0.5);
      const pos = g.attributes.position;
      const normals = new Float32Array(pos.count * 3);
      const colors = new Float32Array(pos.count * 3);
      const tint = 0.85 + rand() * 0.3;
      const hue = rand() * 0.04;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        const out = v.clone().sub(center);
        const depth = out.length() / radius;
        out.normalize().lerp(up, 0.25).normalize();
        normals.set([out.x, out.y, out.z], i * 3);
        // Darker deep inside the crown, where less light reaches.
        const inner = THREE.MathUtils.smoothstep(depth, 0.25, 0.95);
        color.setRGB(1, 1, 1).multiplyScalar(tint * (0.45 + 0.55 * inner));
        color.offsetHSL(hue, 0, 0);
        colors.set([color.r, color.g, color.b], i * 3);
      }
      g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      cards.push(g);
    }
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(cards) };
}

function makeLeafMaterial(map) {
  const m = new THREE.MeshStandardMaterial({
    map,
    vertexColors: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${windGLSL}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec2 w = windAt(wp.xz);
        // The crown sways as a whole; each card flutters on its own.
        float sway = smoothstep(1.5, 6.0, position.y);
        transformed.xz += w * sway * 0.1;
        float flutter = sin(uTime * 4.7 + wp.x * 3.1 + wp.y * 2.3 + wp.z * 1.7);
        transformed += normal * flutter * 0.03 * length(w);`
      );
    shader.fragmentShader = shader.fragmentShader
      // Leaves are thin: light both faces from the canopy normal, never the flipped one.
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal);")
      // A little light comes through the leaves on the shadow side.
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.08;"
      );
  };
  return m;
}

export function Trees() {
  const trees = useMemo(() => {
    const leafMaterial = makeLeafMaterial(leafTexture());
    const barkMaterial = new THREE.MeshStandardMaterial({ map: barkTexture(), color: "#d2c4b2", roughness: 0.95 });
    return TREES.map((t) => ({ ...t, ...growTree(t.seed), leafMaterial, barkMaterial }));
  }, []);

  return (
    <group>
      {trees.map((t) => (
        <group key={t.seed} position={t.position} scale={t.scale} rotation-y={t.seed}>
          <mesh geometry={t.wood} material={t.barkMaterial} castShadow receiveShadow />
          <mesh geometry={t.leaves} material={t.leafMaterial} castShadow receiveShadow />
        </group>
      ))}
    </group>
  );
}
