"use client";

import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// What the camera and overlay are focused on right now (shared with CameraRig via a ref).
export function createFocus() {
  return { weight: 0, center: new THREE.Vector3(0, 1, 0), radius: 1, id: null };
}

const DWELL = 140; // ms the pointer must rest on a group before focusing
const RELEASE = 380; // ms after leaving before letting go (so passing jitter doesn't flicker)

/**
 * Hover focus. Each group of characters reports where it is and how big an area it
 * covers; this projects them onto the screen and, when the pointer rests on one, eases
 * the focus there. CameraRig moves the camera in, and a caption under the group says
 * what they're doing, updating live.
 */
export function FocusController({ world, focusRef, labelRef }) {
  const { camera, gl, size } = useThree();
  const pointer = useRef(null);
  const hover = useRef({ candidate: null, since: 0, active: null, lostAt: 0, label: "" });

  useEffect(() => {
    const move = (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      const overCard = e.target instanceof Element && e.target.closest("#auth-card");
      pointer.current = overCard ? null : { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const leave = () => {
      pointer.current = null;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const focus = focusRef.current;
    const h = hover.current;
    const now = performance.now();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const toScreen = (v) => {
      const p = v.clone().project(camera);
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, behind: p.z > 1 };
    };
    const screenCircle = (center, radius) => {
      const c = toScreen(center);
      const e = toScreen(center.clone().addScaledVector(right, radius));
      return { ...c, r: Math.max(46, Math.hypot(e.x - c.x, e.y - c.y)) };
    };

    // Which group is under the pointer? Among the groups whose area contains it, the one
    // whose centre is nearest — so a big, spread-out group doesn't swallow its neighbours.
    let best = null;
    let bestDist = Infinity;
    const p = pointer.current;
    if (p) {
      for (const g of world.groups()) {
        const c = screenCircle(g.center, g.radius);
        if (c.behind) continue;
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < c.r * 1.1 && d < bestDist) {
          best = g;
          bestDist = d;
        }
      }
    }

    // Dwell before focusing, and a grace period before letting go.
    if (best && best.id !== h.candidate) {
      h.candidate = best.id;
      h.since = now;
    }
    if (best) {
      h.lostAt = 0;
      if (h.active !== best.id && now - h.since > DWELL) h.active = best.id;
    } else {
      h.candidate = null;
      if (h.active && !h.lostAt) h.lostAt = now;
      if (h.active && now - h.lostAt > RELEASE) h.active = null;
    }

    const group = h.active ? world.groups().find((g) => g.id === h.active) : null;
    focus.id = h.active;
    focus.weight = THREE.MathUtils.damp(focus.weight, group ? 1 : 0, group ? 3 : 2.4, dt);
    if (group) {
      focus.center.lerp(group.center, 1 - Math.exp(-dt * 6));
      focus.radius = THREE.MathUtils.damp(focus.radius, group.radius, 4, dt);
    }

    // Caption under the focused group.
    const label = labelRef.current;
    if (!label) return;
    const w = focus.weight;
    if (w < 0.01) {
      label.style.visibility = "hidden";
      return;
    }
    const c = screenCircle(focus.center, focus.radius);
    const r = Math.min(c.r * 1.15 + 20, size.height * 0.3);

    if (group && group.label !== h.label) {
      h.label = group.label;
      label.textContent = group.label;
    }
    label.style.visibility = "visible";
    label.style.opacity = String(THREE.MathUtils.smoothstep(w, 0.4, 1));
    label.style.transform = `translate(${c.x}px, ${Math.min(c.y + r * 0.72, size.height - 56)}px) translate(-50%, 0)`;
  });

  return null;
}
