"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useActor } from "../use-actor";
import { curlHand, lookAt, solveArmIK, swingToward } from "../rig-tools";
import { SwingSeat, SWING_SEAT_OFFSETS } from "../props";

const G = 9.81;
const CHAIN = 1.84;
const OMEGA = Math.sqrt(G / CHAIN);
// Where she grips the chains, measured down from the beam (about her shoulder height).
const GRIP_DROP = 1.56;
const GRIP_HALF_WIDTH = 0.215;

/**
 * A girl on the swing. The swing is a real pendulum. She holds the chains with curled
 * hands, and pumps the way children do: legs out and body leaning back while she swings
 * forward, legs tucked under and body forward while she swings back.
 */
export function Swinger({ world }) {
  const actor = useActor("swinger");
  const pivot = useRef();
  const other = useRef();
  const stateRef = useRef({ t: 0, amp: 0.45, goal: 0.45, nextChange: 6, pump: 0 });

  useEffect(() => {
    stateRef.current.t = Math.random() * 10;
    actor.play("Sitting_Idle_Loop", { fade: 0 });
    // Seated with her hips over the middle of the seat, facing along the arc (+Z).
    actor.root.position.set(0, -CHAIN - 0.19, 0.12);
    actor.root.rotation.set(0, 0, 0);
  }, [actor]);

  useFrame((_, dt) => {
    const state = stateRef.current;
    state.t += dt;
    state.nextChange -= dt;
    if (state.nextChange < 0) {
      state.goal = 0.32 + Math.random() * 0.22;
      state.nextChange = 6 + Math.random() * 8;
    }
    state.amp = THREE.MathUtils.damp(state.amp, state.goal, 0.3, dt);
    // rotation.x = θ moves the seat towards -Z, so her forward (+Z) travel is -dθ/dt.
    const phase = OMEGA * state.t;
    const angle = state.amp * Math.sin(phase);
    const forwardSpeed = -Math.cos(phase);
    if (pivot.current) pivot.current.rotation.x = angle;
    if (other.current) other.current.rotation.x = 0.04 * Math.sin(phase * 0.98 + 1.3);

    const seat = pivot.current;
    if (!seat) return;
    const b = actor.bones;
    // The pump leads the motion a little, like a real child anticipating the swing.
    state.pump = THREE.MathUtils.damp(state.pump, forwardSpeed, 6, dt);
    const pump = state.pump;

    const q = seat.getWorldQuaternion(new THREE.Quaternion());
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const back = forward.clone().negate();
    const down = up.clone().negate();

    // Body: lean back going forward, forward going back.
    swingToward(b.spine_01, b.spine_02, back, 0.16 * Math.max(pump, 0) - 0.08 * Math.max(-pump, 0));
    swingToward(b.spine_02, b.spine_03, back, 0.08 * pump);
    // Legs: extend the shins forward, or tuck them back under the seat.
    for (const s of ["l", "r"]) {
      swingToward(b[`thigh_${s}`], b[`calf_${s}`], up, 0.12 * Math.max(pump, 0));
      swingToward(b[`calf_${s}`], b[`foot_${s}`], forward, pump > 0 ? 0.85 * pump : 0.45 * pump);
    }

    // Hands wrap the chains at about shoulder height; elbows hang down and slightly out.
    for (const [s, x] of [
      ["l", GRIP_HALF_WIDTH],
      ["r", -GRIP_HALF_WIDTH],
    ]) {
      const grip = seat.localToWorld(new THREE.Vector3(x, -GRIP_DROP, 0));
      const shoulder = b[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
      const out = grip.clone().sub(shoulder).projectOnPlane(up).normalize();
      const pole = shoulder.clone().addScaledVector(down, 0.5).addScaledVector(out, 0.15).addScaledVector(forward, 0.05);
      solveArmIK(b[`upperarm_${s}`], b[`lowerarm_${s}`], b[`hand_${s}`], grip, pole, 1);
      curlHand(b, s, 1);
    }

    // She watches where she's going.
    const ahead = seat.localToWorld(new THREE.Vector3(0, -CHAIN + 0.9, 3));
    ahead.y -= 0.4 + 0.3 * Math.max(pump, 0);
    lookAt(b.neck_01, b.Head, ahead, 0.6);
    world.set("swinger", b.Head.getWorldPosition(new THREE.Vector3()));
  });

  return (
    <>
      <SwingSeat offset={SWING_SEAT_OFFSETS[0]} pivotRef={pivot}>
        <primitive object={actor.root} />
      </SwingSeat>
      <SwingSeat offset={SWING_SEAT_OFFSETS[1]} pivotRef={other} />
    </>
  );
}
