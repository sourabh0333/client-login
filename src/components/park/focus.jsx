"use client";

import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// Shared between the camera and the caption: what's under the pointer, what's followed.
export function createFocus() {
  return { hover: null, follow: null, groups: [] };
}

/**
 * Finds which group of characters is under the pointer (so a click can follow them),
 * sets the cursor, and shows a caption under the hovered or followed group saying what
 * they're doing, updating live.
 */
export function FocusController({ world, focusRef, labelRef }) {
  const gl = useThree((s) => s.gl);
  const pointer = useRef(null);
  const caption = useRef({ text: "", shown: 0, id: null });

  useEffect(() => {
    const el = gl.domElement;
    const move = (e) => {
      const rect = el.getBoundingClientRect();
      pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const leave = () => {
      pointer.current = null;
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  useFrame(({ camera, size, gl: renderer }, dt) => {
    const focus = focusRef.current;
    const groups = world.groups();
    focus.groups = groups;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const toScreen = (v) => {
      const p = v.clone().project(camera);
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, behind: p.z > 1 };
    };
    const circle = (g) => {
      const c = toScreen(g.center);
      const e = toScreen(g.center.clone().addScaledVector(right, g.radius));
      return { ...c, r: Math.max(40, Math.hypot(e.x - c.x, e.y - c.y)) };
    };

    // Under the pointer: of the groups whose area contains it, the nearest centre.
    let hover = null;
    let best = Infinity;
    const p = pointer.current;
    if (p) {
      for (const g of groups) {
        const c = circle(g);
        if (c.behind) continue;
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < c.r && d < best) {
          hover = g;
          best = d;
        }
      }
    }
    focus.hover = hover;
    const style = renderer.domElement.style;
    if (style.cursor !== "grabbing") style.setProperty("cursor", hover ? "pointer" : "grab");

    // Caption: the hovered group, otherwise the one being followed.
    const label = labelRef.current;
    if (!label) return;
    const shown = hover ?? groups.find((g) => g.id === focus.follow) ?? null;
    const cap = caption.current;
    cap.shown = THREE.MathUtils.damp(cap.shown, shown ? 1 : 0, shown ? 8 : 5, dt);
    if (shown) cap.id = shown.id;
    const g = shown ?? groups.find((x) => x.id === cap.id);
    if (!g || cap.shown < 0.01) {
      label.style.visibility = "hidden";
      return;
    }
    const text = focus.follow === g.id ? `${g.label} · following` : g.label;
    if (text !== cap.text) {
      cap.text = text;
      label.textContent = text;
    }
    const c = circle(g);
    label.style.visibility = "visible";
    label.style.opacity = String(cap.shown);
    label.style.transform = `translate(${c.x}px, ${Math.min(c.y + c.r * 0.85, size.height - 56)}px) translate(-50%, 0)`;
  });

  return null;
}

/**
 * A soft glowing ring on the grass under the people you're pointing at (pulsing) or
 * following (steady), so it's obvious what's clickable and who the camera is on.
 * It pops outwards when you click to follow.
 */
export function HighlightRing({ focusRef }) {
  const ring = useRef(null);
  const state = useRef({ shown: 0, radius: 1, id: null, follow: null, pop: 0, center: new THREE.Vector3() });
  const material = useRef(null);

  useFrame(({ clock }, dt) => {
    const mesh = ring.current;
    if (!mesh) return;
    const s = state.current;
    const focus = focusRef.current;
    const followed = focus.follow ? focus.groups.find((g) => g.id === focus.follow) : null;
    const target = focus.hover ?? followed;
    // A fresh follow makes the ring pop.
    if (focus.follow && focus.follow !== s.follow) s.pop = 1;
    s.follow = focus.follow;
    s.pop = Math.max(0, s.pop - dt * 1.8);

    s.shown = THREE.MathUtils.damp(s.shown, target ? 1 : 0, target ? 7 : 4, dt);
    if (target) {
      if (s.id !== target.id) s.center.copy(target.center);
      s.id = target.id;
      s.center.lerp(target.center, 1 - Math.exp(-dt * 10));
      s.radius = THREE.MathUtils.damp(s.radius, target.radius * 0.85, 8, dt);
    }
    mesh.visible = s.shown > 0.01;
    if (!mesh.visible) return;

    const hoverOnly = target && !followed ? 1 : 0;
    const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.05 * hoverOnly;
    const pop = 1 + 0.35 * s.pop * s.pop;
    mesh.position.set(s.center.x, 0.03, s.center.z);
    mesh.scale.setScalar(s.radius * pulse * pop);
    material.current.opacity = s.shown * (0.55 + 0.25 * s.pop);
  });

  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} renderOrder={2} visible={false}>
      <ringGeometry args={[0.86, 1, 64]} />
      <meshBasicMaterial ref={material} color="#e8ffd9" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
