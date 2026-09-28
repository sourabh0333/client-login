"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { useActor } from "../use-actor";
import { angleDamp, lookAt, rand } from "../rig-tools";
import { CHASE_LOOP } from "../layout";

const JOG = 1.9; // ground speed the jog cycle was authored for, at child size
const SPRINT = 3.0;

/**
 * Two children playing tag around the lawn. Whoever is "it" chases; when they catch up,
 * both pull up, the tagged one counts for a moment, and the chase starts again the other
 * way round. Speeds wander so it never settles into a loop you can spot.
 */
export function TagGame({ world }) {
  const a = useActor("runner_a");
  const b = useActor("runner_b");
  const curve = useMemo(() => new THREE.CatmullRomCurve3(CHASE_LOOP.map((p) => new THREE.Vector3(...p)), true, "centripetal"), []);
  const length = useMemo(() => curve.getLength(), [curve]);
  const stateRef = useRef({
    runners: [
      { d: 3.2, speed: 0, goal: 2.1, heading: 0, clip: "", pause: 0 },
      { d: 0, speed: 0, goal: 2.3, heading: 0, clip: "", pause: 0 },
    ],
    it: 1,
    wobble: 0,
  });

  useFrame((_, dt) => {
    const s = stateRef.current;
    s.runners[0].actor = a;
    s.runners[1].actor = b;
    s.wobble += dt;
    const [r0, r1] = s.runners;
    const chaser = s.runners[s.it];
    const runner = s.runners[1 - s.it];
    const gap = (((runner.d - chaser.d) % length) + length) % length;

    // Tagged: both stop; the new "it" waits a moment before chasing.
    if (gap < 0.55 && chaser.pause <= 0 && runner.pause <= 0) {
      runner.pause = rand(1.6, 2.4);
      chaser.pause = 0.6;
      s.it = 1 - s.it;
    }

    for (const r of [r0, r1]) {
      const isIt = r === s.runners[s.it];
      if (r.pause > 0) {
        r.pause -= dt;
        r.goal = 0;
      } else {
        // Speeds drift; "it" is a touch faster so the chase always closes eventually.
        const base = 2.0 + Math.sin(s.wobble * 0.37 + (isIt ? 0 : 2.1)) * 0.35;
        r.goal = base + (isIt ? 0.25 : 0);
      }
      r.speed = THREE.MathUtils.damp(r.speed, r.goal, r.goal > r.speed ? 1.8 : 3.5, dt);
      r.d = (r.d + r.speed * dt) % length;

      const u = r.d / length;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      r.heading = angleDamp(r.heading || Math.atan2(t.x, t.z), Math.atan2(t.x, t.z), 8, dt);
      r.actor.root.position.set(p.x, 0, p.z);
      r.actor.root.rotation.set(0, r.heading, 0);

      const clip = r.speed < 0.25 ? "Stand" : r.speed < 1.2 ? "Walk_Loop" : r.speed < 2.6 ? "Jog_Fwd_Loop" : "Sprint_Loop";
      if (clip !== r.clip) {
        r.actor.play(clip, { fade: 0.35 });
        r.clip = clip;
      }
      const authored = clip === "Walk_Loop" ? 0.8 : clip === "Jog_Fwd_Loop" ? JOG : SPRINT;
      if (clip !== "Stand") r.actor.setSpeed(THREE.MathUtils.clamp(r.speed / authored, 0.6, 1.3));

      // Runners glance at each other: the chased looks back, "it" watches their target.
      const other = r === r0 ? r1 : r0;
      const target = other.actor.bones.Head.getWorldPosition(new THREE.Vector3());
      lookAt(r.actor.bones.neck_01, r.actor.bones.Head, target, r.pause > 0 ? 0.9 : 0.55);
    }
    world.set("runner", r0.actor.root.position.clone().setY(1));

    // For the hover focus: the two of them, wherever the chase has taken them.
    const p0 = r0.actor.root.position.clone().setY(0.7);
    const p1 = r1.actor.root.position.clone().setY(0.7);
    const tagged = r0.pause > 0 || r1.pause > 0;
    world.group("tag", p0.clone().lerp(p1, 0.5), Math.min(p0.distanceTo(p1) / 2 + 0.7, 3), tagged ? "Tagged — you're it!" : "Playing tag");
  });

  return (
    <>
      <primitive object={a.root} />
      <primitive object={b.root} />
    </>
  );
}
