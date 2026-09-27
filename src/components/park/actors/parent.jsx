"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { useActor } from "../use-actor";
import { damp, lookAt, rand, solveArmIK, swingToward, wait } from "../rig-tools";
import { BENCH } from "../layout";

// The sitting clip puts the hips 0.28 m behind the character's origin and a little low for
// this bench, so she is placed forward and up until her hips rest on the middle of the seat.
const SEAT_FORWARD = 0.19;
const SEAT_LIFT = 0.07;
// Where her ankles rest, in her own frame (+Z forward): flat on the grass in front of the bench.
const FEET = [
  [0.12, 0.08 - SEAT_LIFT, 0.3],
  [-0.13, 0.08 - SEAT_LIFT, 0.27],
];

/**
 * A parent on the bench keeping an eye on the children: sitting back against the backrest,
 * feet on the ground, mostly watching the swing and glancing at the others.
 */
export function Parent({ world }) {
  const actor = useActor("parent");
  const s = useMemo(() => ({ target: new THREE.Vector3(-3.6, 1, -3.4), look: 0, smooth: null }), []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const [x, , z] = BENCH.position;
    const forward = new THREE.Vector3(Math.sin(BENCH.rotation), 0, Math.cos(BENCH.rotation));
    actor.root.position.set(x, SEAT_LIFT, z).addScaledVector(forward, SEAT_FORWARD);
    actor.root.rotation.set(0, BENCH.rotation, 0);
    actor.play("Sitting_Idle_Loop", { fade: 0 });

    const life = async () => {
      for (;;) {
        const options = world.interests();
        s.target.copy(options[Math.floor(Math.random() * options.length)]);
        await wait(rand(2500, 6000), signal);
        if (Math.random() < 0.12) {
          actor.play("Sitting_Talking_Loop", { fade: 0.8 });
          await wait(rand(3000, 5000), signal);
          actor.play("Sitting_Idle_Loop", { fade: 0.8 });
        }
      }
    };
    life().catch((e) => {
      if (e.name !== "AbortError") throw e;
    });
    return () => controller.abort();
  }, [actor, s, world]);

  useFrame((_, dt) => {
    const b = actor.bones;
    const root = actor.root;
    const back = new THREE.Vector3(0, 0, -1).applyQuaternion(root.quaternion);

    // The clip leans forward, elbows to knees; sit her back against the backrest instead.
    swingToward(b.spine_01, b.spine_02, back, 0.2);
    swingToward(b.spine_02, b.spine_03, back, 0.1);

    // Feet planted on the grass, knees forward.
    FEET.forEach(([x, y, z], i) => {
      const side = i === 0 ? "l" : "r";
      const foot = root.localToWorld(new THREE.Vector3(x, y, z));
      const pole = root.localToWorld(new THREE.Vector3(x * 1.2, 0.5, 1));
      solveArmIK(b[`thigh_${side}`], b[`calf_${side}`], b[`foot_${side}`], foot, pole, 1);
    });

    // Hands resting on her lap, elbows relaxed at her sides.
    for (const side of ["l", "r"]) {
      const lap = b[`thigh_${side}`].getWorldPosition(new THREE.Vector3()).lerp(b[`calf_${side}`].getWorldPosition(new THREE.Vector3()), 0.55);
      lap.y += 0.09;
      const x = side === "l" ? 0.35 : -0.35;
      const pole = root.localToWorld(new THREE.Vector3(x, 0.55, -0.3));
      solveArmIK(b[`upperarm_${side}`], b[`lowerarm_${side}`], b[`hand_${side}`], lap, pole, 1);
    }

    s.look = damp(s.look, 1, 1, dt);
    s.smooth = (s.smooth ?? s.target.clone()).lerp(s.target, 1 - Math.exp(-dt * 2.5));
    lookAt(b.neck_01, b.Head, s.smooth, 0.8 * s.look);
  });

  return <primitive object={actor.root} />;
}
