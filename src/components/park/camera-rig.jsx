"use client";

import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CAMERA } from "./layout";

// How far visitors can roam: an orbit around a point that stays inside the park.
const LIMITS = {
  yaw: 0.95, // either side of the starting view (radians)
  pitchMin: 0.04,
  pitchMax: 0.62,
  distMin: 2.6,
  distMax: 13,
  x: [-5.5, 6.5],
  z: [-7.5, 6.5],
};
const MOVE_SPEED = 3.2; // m/s with the keys
const TURN_SPEED = 1.2; // rad/s with Q/E

const clamp = THREE.MathUtils.clamp;

// Starts high and wide of the home view, so the page opens with a short fly-in.
const getRig = (ref, home) =>
  (ref.current ??= {
    target: home.target.clone(),
    goalTarget: home.target.clone(),
    yaw: home.yaw + 0.35,
    goalYaw: home.yaw,
    pitch: home.pitch + 0.45,
    goalPitch: home.pitch,
    dist: home.dist * 1.9,
    goalDist: home.dist,
    keys: new Set(),
    drag: null,
    follow: null,
    pointer: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    age: -INTRO_DELAY,
  });

// Mouse-look: how far the view turns towards the cursor without dragging.
const LOOK_YAW = 0.14;
const LOOK_PITCH = 0.07;
const INTRO = 3.6; // seconds the opening fly-in takes to settle
// The scene fades in 0.4 s + 0.9 s after it is created; start the fly-in once it shows.
const INTRO_DELAY = 1.6;

const isTyping = (el) => el instanceof Element && (el.closest("input, textarea, select, [contenteditable='true']") !== null);

/**
 * Free camera for exploring the park.
 *   Mouse: move to glance around, drag to look around, scroll to zoom, click a group
 *          to follow them.
 *   Keys:  WASD / arrows to move, Q/E to turn, + / − to zoom, R or Esc to reset.
 * Everything eases towards its goal, so movement glides. Keys are ignored while the
 * visitor is typing in the form. `controlsRef` exposes reset/zoom for on-screen buttons.
 */
export function CameraRig({ focusRef, controlsRef, onInteract }) {
  const gl = useThree((s) => s.gl);

  const home = useMemo(() => {
    const q = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("cam");
    const v = q ? q.split(",").map(Number) : [...CAMERA.position, ...CAMERA.target];
    const target = new THREE.Vector3(v[3], v[4], v[5]);
    const offset = new THREE.Vector3(v[0], v[1], v[2]).sub(target);
    const dist = offset.length();
    return {
      target,
      dist,
      yaw: Math.atan2(offset.x, offset.z),
      pitch: Math.asin(offset.y / dist),
    };
  }, []);

  // Current (smoothed) and goal values of the orbit, created on first use.
  const rig = useRef(null);

  useEffect(() => {
    const r = getRig(rig, home);
    const el = gl.domElement;
    const interacted = () => onInteract?.();

    const reset = () => {
      r.follow = null;
      r.goalTarget.copy(home.target);
      r.goalYaw = home.yaw;
      r.goalPitch = home.pitch;
      r.goalDist = home.dist;
    };
    const zoom = (factor) => {
      r.goalDist = clamp(r.goalDist * factor, LIMITS.distMin, LIMITS.distMax);
      interacted();
    };
    controlsRef.current = { reset, zoom };

    const onDown = (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      r.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      el.style.setProperty("cursor", "grabbing");
      el.focus({ preventScroll: true });
    };
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      r.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      r.pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      if (!r.drag) return;
      const dx = e.clientX - r.drag.x;
      const dy = e.clientY - r.drag.y;
      r.drag.x = e.clientX;
      r.drag.y = e.clientY;
      r.drag.moved += Math.abs(dx) + Math.abs(dy);
      r.goalYaw -= dx * 0.0045;
      r.goalPitch += dy * 0.0035;
      if (r.drag.moved > 4) interacted();
    };
    const onUp = (e) => {
      if (!r.drag) return;
      const click = r.drag.moved < 5;
      r.drag = null;
      el.style.removeProperty("cursor");
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      // A click (not a drag) on a group follows them; on empty ground it lets go.
      if (click) {
        const hovered = focusRef.current.hover;
        r.follow = hovered ? hovered.id : null;
        interacted();
      }
    };
    const onLeave = () => {
      r.pointer.x = 0;
      r.pointer.y = 0;
    };
    const onWheel = (e) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0012));
    };
    const onKeyDown = (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        r.keys.add(key);
        if (key.startsWith("arrow")) e.preventDefault();
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) r.follow = null;
        interacted();
      } else if (key === "+" || key === "=") {
        zoom(0.85);
      } else if (key === "-" || key === "_") {
        zoom(1.18);
      } else if (key === "r" || key === "escape" || key === "home") {
        reset();
        interacted();
      }
    };
    const onKeyUp = (e) => r.keys.delete(e.key.toLowerCase());
    const onBlur = () => r.keys.clear();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [gl, home, controlsRef, focusRef, onInteract]);

  useFrame(({ clock, camera }, dt) => {
    const r = getRig(rig, home);
    const k = r.keys;

    // Keys: move over the ground relative to where the camera is facing, and turn.
    const fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const side = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    const turn = (k.has("e") ? 1 : 0) - (k.has("q") ? 1 : 0);
    if (fwd || side) {
      const ahead = new THREE.Vector3(-Math.sin(r.yaw), 0, -Math.cos(r.yaw));
      const right = new THREE.Vector3(-ahead.z, 0, ahead.x);
      r.goalTarget.addScaledVector(ahead, fwd * MOVE_SPEED * dt).addScaledVector(right, side * MOVE_SPEED * dt);
    }
    if (turn) r.goalYaw -= turn * TURN_SPEED * dt;

    // Following a group: keep them centred and comfortably framed.
    const followed = r.follow ? focusRef.current.groups?.find((g) => g.id === r.follow) : null;
    if (r.follow && !followed) r.follow = null;
    if (followed) {
      r.goalTarget.copy(followed.center);
      const want = clamp(followed.radius * 2.8 + 2, LIMITS.distMin, 8);
      if (!r.followInit || r.followInit !== r.follow) {
        r.goalDist = want;
        r.goalPitch = Math.max(r.goalPitch, 0.16);
        r.followInit = r.follow;
      }
    } else {
      r.followInit = null;
    }
    focusRef.current.follow = r.follow;

    // Keep everything inside the park.
    r.goalYaw = clamp(r.goalYaw, home.yaw - LIMITS.yaw, home.yaw + LIMITS.yaw);
    r.goalPitch = clamp(r.goalPitch, LIMITS.pitchMin, LIMITS.pitchMax);
    r.goalTarget.x = clamp(r.goalTarget.x, LIMITS.x[0], LIMITS.x[1]);
    r.goalTarget.z = clamp(r.goalTarget.z, LIMITS.z[0], LIMITS.z[1]);
    if (!followed) r.goalTarget.y = THREE.MathUtils.damp(r.goalTarget.y, home.target.y, 2, dt);

    // Glide towards the goals (slowly at first, for the opening fly-in). The fly-in waits
    // until the characters have loaded and the scene has faded in over the still image.
    if (focusRef.current.groups.length) r.age += dt;
    else r.age = -INTRO_DELAY;
    const intro = THREE.MathUtils.smoothstep(r.age, 0, INTRO);
    const hold = r.age < 0 ? 0 : 1; // stay at the starting shot until the fly-in begins
    const ease = (1 - Math.exp(-dt * THREE.MathUtils.lerp(1.1, 5, intro))) * hold;
    r.target.lerp(r.goalTarget, (1 - Math.exp(-dt * (followed ? 3 : 6))) * hold);
    r.yaw += (r.goalYaw - r.yaw) * ease;
    r.pitch += (r.goalPitch - r.pitch) * ease;
    r.dist += (r.goalDist - r.dist) * (1 - Math.exp(-dt * THREE.MathUtils.lerp(1.1, 4, intro))) * hold;

    // Mouse-look: the view leans towards the cursor; it settles while dragging or following.
    const lookWeight = r.drag || followed ? 0 : intro;
    const lk = 1 - Math.exp(-dt * 2.5);
    r.look.x += (r.pointer.x * lookWeight - r.look.x) * lk;
    r.look.y += (r.pointer.y * lookWeight - r.look.y) * lk;
    const yaw = r.yaw - r.look.x * LOOK_YAW;
    const pitch = clamp(r.pitch + r.look.y * LOOK_PITCH, LIMITS.pitchMin, LIMITS.pitchMax + 0.4);

    // A faint hand-held breathing so the view never feels frozen.
    const t = clock.elapsedTime;
    const breathe = new THREE.Vector3(Math.sin(t * 0.13) * 0.06, Math.sin(t * 0.21) * 0.03, 0);
    const cp = Math.cos(pitch);
    camera.position
      .set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp)
      .multiplyScalar(r.dist)
      .add(r.target)
      .add(breathe);
    camera.position.setY(Math.max(camera.position.y, 0.45));
    camera.lookAt(r.target);
  });

  return null;
}
