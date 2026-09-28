"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useActor } from "../use-actor";
import { Mover } from "../mover";
import { chance, curlHand, damp, lookAt, rand, solveArmIK, swingToward, wait } from "../rig-tools";
import { BALL_A, BALL_B } from "../layout";

const G = new THREE.Vector3(0, -9.81, 0);
const BALL_R = 0.1;
// Measured on the retargeted OverhandThrow: the hand is high and driving forward here.
const RELEASE_AT = 0.34;
// Skip the clip's arm-down start, and ease out of its full-effort lunge soon after release.
const THROW_FROM = 0.12;
const RECOVER_AT = 0.5;
const DRIBBLE_PERIOD = 0.62;
const HOMES = [BALL_A.position, BALL_B.position];

const facingTowards = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);
const flat = (v) => new THREE.Vector3(v.x, 0, v.z);

/**
 * Two boys playing catch, never quite the same twice. Each exchange picks an overarm
 * throw or a two-handed chest pass, and an accuracy: on target, wide (the catcher leans
 * and reaches; now and then it bounces off his hands) or short (it bounces and rolls, and
 * he goes and fetches it). Sometimes they bounce the ball before throwing; the one
 * waiting folds his arms while the other fetches.
 */
export function BallGame({ world }) {
  const a = useActor("thrower_a");
  const b = useActor("thrower_b");
  const actors = useMemo(() => [a, b], [a, b]);
  const movers = useMemo(
    () => [
      new Mover(a, { position: HOMES[0], heading: facingTowards(HOMES[0], HOMES[1]), gait: { clip: "Walk_Loop", speed: 0.8 } }),
      new Mover(b, { position: HOMES[1], heading: facingTowards(HOMES[1], HOMES[0]), gait: { clip: "Walk_Loop", speed: 0.8 } }),
    ],
    [a, b]
  );
  const ballRef = useRef(null);
  const stateRef = useRef({
    mode: "held", // held | hand | pass | flight | loose | dribble | crouch
    holder: 0,
    flight: null,
    vel: new THREE.Vector3(),
    grip: [1, 0],
    reachTarget: [null, null],
    passT: 0,
    dribbleT: 0,
    onFlightEnd: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const s = stateRef.current;
    a.play("Stand", { fade: 0 });
    b.play("Stand", { fade: 0, from: 1.1 });

    const chest = (i) => {
      const { upperarm_l: l, upperarm_r: r } = actors[i].bones;
      const p = l.getWorldPosition(new THREE.Vector3()).lerp(r.getWorldPosition(new THREE.Vector3()), 0.5);
      return p.addScaledVector(movers[i].forward, 0.27).add(new THREE.Vector3(0, -0.11, 0));
    };
    const faceHome = (i) => facingTowards(HOMES[i], HOMES[1 - i]);

    // Where the ball is aimed, by quality of throw.
    const aim = (thrower, catcher, quality) => {
      const target = chest(catcher);
      const across = new THREE.Vector3().crossVectors(movers[catcher].forward, new THREE.Vector3(0, 1, 0));
      if (quality === "good") {
        target.addScaledVector(across, rand(-0.12, 0.12)).add(new THREE.Vector3(0, rand(-0.08, 0.08), 0));
      } else if (quality === "wide") {
        target.addScaledVector(across, (chance(0.5) ? 1 : -1) * rand(0.26, 0.42)).add(new THREE.Vector3(0, rand(-0.12, 0.3), 0));
      } else {
        // Short: lands on the grass 1–1.8 m in front of the catcher.
        const toCatcher = flat(movers[catcher].position.clone().sub(movers[thrower].position)).normalize();
        target.copy(movers[catcher].position).addScaledVector(toCatcher, -rand(1, 1.8)).setY(BALL_R);
      }
      return target;
    };

    const launch = (from, to, speed, catcher, quality) =>
      new Promise((resolve) => {
        const T = from.distanceTo(to) / speed + (quality === "short" ? 0.25 : 0.1);
        const v = to.clone().sub(from).addScaledVector(G, -0.5 * T * T).divideScalar(T);
        s.flight = { from: from.clone(), to, v, t: 0, T, catcher, quality, fumble: quality === "wide" && chance(0.25) };
        s.mode = "flight";
        s.onFlightEnd = resolve;
      });

    const overhand = async (h, c, quality) => {
      const actor = actors[h];
      s.mode = "hand";
      // Layered over the standing pose: the library throw is a full-effort pitch, and
      // mixed about two-to-one it reads as an easy throw between kids.
      const th = actor.action("OverhandThrow");
      th.reset();
      th.setLoop(THREE.LoopOnce, 1);
      th.clampWhenFinished = true;
      th.time = THROW_FROM;
      th.setEffectiveTimeScale(1);
      th.play();
      th.fadeIn(0.22);
      actor.action("Stand").setEffectiveWeight(0.55);
      while (th.time < RELEASE_AT) await wait(16, signal);
      setTimeout(() => {
        th.fadeOut(0.45);
        actor.action("Stand").setEffectiveWeight(1);
      }, (RECOVER_AT - RELEASE_AT) * 1000);
      return launch(ballRef.current.position, aim(h, c, quality), 7, c, quality);
    };

    const chestPass = async (h, c, quality) => {
      // Arms draw the ball in, then push it out from the chest.
      s.mode = "pass";
      s.passT = 0;
      while (s.passT < 0.42) await wait(16, signal);
      return launch(ballRef.current.position, aim(h, c, quality), 5.5, c, quality);
    };

    const dribble = async (count) => {
      s.mode = "dribble";
      s.dribbleT = 0;
      await wait(count * DRIBBLE_PERIOD * 1000, signal);
      s.mode = "held";
    };

    const fetch = async (i) => {
      const other = 1 - i;
      actors[other].play("Idle_FoldArms_Loop", { fade: 0.5 });
      // Let it settle a little, then go and get it.
      await wait(rand(500, 900), signal);
      const ball = ballRef.current.position;
      const from = movers[i].position;
      const to = flat(ball.clone().sub(from));
      const dist = to.length();
      const stop = from.clone().addScaledVector(to.normalize(), Math.max(0, dist - 0.4));
      const gait = dist > 2 ? { clip: "Jog_Fwd_Loop", speed: 1.8 } : { clip: "Walk_Loop", speed: 0.8 };
      await movers[i].walkTo([stop.x, 0, stop.z], { gait });
      actors[i].play("Crouch_Idle_Loop", { fade: 0.3 });
      s.holder = i;
      s.mode = "crouch";
      await wait(700, signal);
      s.mode = "held";
      await wait(250, signal);
      actors[i].play("Stand", { fade: 0.4 });
      await wait(350, signal);
      await movers[i].walkTo(HOMES[i], { gait: { clip: "Walk_Loop", speed: 0.8 }, face: faceHome(i) });
      actors[other].play("Stand", { fade: 0.5 });
    };

    const life = async () => {
      await wait(rand(800, 1600), signal);
      for (;;) {
        const h = s.holder;
        const c = 1 - h;
        await wait(rand(900, 2200), signal);
        if (chance(0.3)) await dribble(chance(0.5) ? 1 : 2);
        const r = Math.random();
        const quality = r < 0.12 ? "short" : r < 0.34 ? "wide" : "good";
        const outcome = chance(0.35) ? await chestPass(h, c, quality) : await overhand(h, c, quality);
        if (outcome === "caught") {
          s.holder = c;
          if (chance(0.25)) {
            await wait(400, signal);
            actors[h].play("Yes", { loop: false, fade: 0.3 }).then(() => actors[h].play("Stand", { fade: 0.4 }));
          }
        } else {
          await fetch(c);
        }
      }
    };
    life().catch((e) => {
      if (e.name !== "AbortError") throw e;
    });
    return () => controller.abort();
  }, [a, b, actors, movers]);

  useFrame((_, dt) => {
    const s = stateRef.current;
    const ball = ballRef.current;
    if (!ball) return;
    movers[0].update(dt);
    movers[1].update(dt);

    const chest = (i) => {
      const { upperarm_l: l, upperarm_r: r } = actors[i].bones;
      const p = l.getWorldPosition(new THREE.Vector3()).lerp(r.getWorldPosition(new THREE.Vector3()), 0.5);
      return p.addScaledVector(movers[i].forward, 0.27).add(new THREE.Vector3(0, -0.11, 0));
    };

    // --- Ball in the air or on the ground ------------------------------------------------
    if (s.mode === "flight") {
      const f = s.flight;
      f.t += dt;
      ball.position.copy(f.from).addScaledVector(f.v, f.t).addScaledVector(G, 0.5 * f.t * f.t);
      ball.rotation.x += dt * 9;
      const arriving = f.quality !== "short" && f.t >= f.T;
      if (arriving && f.fumble) {
        // Off his fingertips: it pops up and drops beside him.
        s.vel.copy(f.v).addScaledVector(G, f.t).multiplyScalar(-0.25).add(new THREE.Vector3(rand(-0.8, 0.8), 1.4, rand(-0.8, 0.8)));
        s.mode = "loose";
        s.flight = null;
        s.onFlightEnd?.("ground");
      } else if (arriving) {
        s.mode = "held";
        s.holder = f.catcher;
        s.grip[f.catcher] = 1;
        s.flight = null;
        s.onFlightEnd?.("caught");
      } else if (ball.position.y <= BALL_R) {
        s.vel.copy(f.v).addScaledVector(G, f.t);
        s.mode = "loose";
        s.flight = null;
        s.onFlightEnd?.("ground");
      }
    } else if (s.mode === "loose") {
      // Bounces, then rolls to a stop on the grass.
      s.vel.addScaledVector(G, dt);
      ball.position.addScaledVector(s.vel, dt);
      if (ball.position.y < BALL_R) {
        ball.position.y = BALL_R;
        if (s.vel.y < -0.6) {
          s.vel.y = -s.vel.y * 0.55;
          s.vel.x *= 0.75;
          s.vel.z *= 0.75;
        } else {
          s.vel.y = 0;
          const k = Math.exp(-2.2 * dt);
          s.vel.x *= k;
          s.vel.z *= k;
        }
      }
      ball.rotation.x += (Math.hypot(s.vel.x, s.vel.z) / BALL_R) * dt;
    }

    // --- Each boy's arms, lean and eyes ---------------------------------------------------
    for (let i = 0; i < 2; i++) {
      const bones = actors[i].bones;
      const fwd = movers[i].forward;
      const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(actors[i].root.quaternion);
      const down = new THREE.Vector3(0, -1, 0);
      const mine = s.holder === i;
      let target = null;
      let want = 0;
      let lean = null;

      if (mine && s.mode === "held") {
        target = chest(i);
        want = 1;
      } else if (mine && s.mode === "pass") {
        s.passT += dt;
        const t = s.passT;
        // Draw in (0–0.15 s), then push out to arm's length (0.15–0.42 s).
        const out = t < 0.15 ? -0.08 * (t / 0.15) : -0.08 + 0.52 * THREE.MathUtils.smoothstep(t, 0.15, 0.42);
        target = chest(i).addScaledVector(fwd, out).add(new THREE.Vector3(0, 0.04, 0));
        want = 1;
        lean = fwd.clone();
      } else if (mine && s.mode === "dribble") {
        s.dribbleT += dt;
        const u = (s.dribbleT % DRIBBLE_PERIOD) / DRIBBLE_PERIOD;
        const top = chest(i).y - 0.08;
        const spot = chest(i).addScaledVector(fwd, 0.08).addScaledVector(right, 0.14);
        ball.position.set(spot.x, BALL_R + (top - BALL_R) * (1 - 2 * u) ** 2, spot.z);
        ball.rotation.x += dt * 4;
        // One hand pats the ball down as it comes up; the other hangs relaxed.
        const hand = ball.position.clone().add(new THREE.Vector3(0, BALL_R + 0.03, 0));
        hand.y = Math.max(hand.y, top - 0.1);
        const pole = chest(i).add(new THREE.Vector3(0, -0.4, 0)).addScaledVector(right, 0.4);
        solveArmIK(bones.upperarm_r, bones.lowerarm_r, bones.hand_r, hand, pole, 1);
      } else if (mine && s.mode === "crouch") {
        target = ball.position.clone();
        want = 1;
      } else if (s.mode === "flight" && s.flight.catcher === i && s.flight.quality !== "short") {
        const left = s.flight.T - s.flight.t;
        target = s.flight.to.clone().lerp(ball.position, 0.25);
        want = THREE.MathUtils.smoothstep(0.55 - left, 0, 0.45);
        lean = flat(s.flight.to.clone().sub(chest(i)));
      }

      // Both hands on the ball (or reaching for it), elbows down and out.
      s.grip[i] = damp(s.grip[i], want, want > s.grip[i] ? 9 : 5, dt);
      if (target) s.reachTarget[i] = target;
      const w = s.grip[i];
      if (w > 0.001 && s.reachTarget[i]) {
        const c = bones.spine_03.getWorldPosition(new THREE.Vector3());
        for (const [side, sign] of [
          ["l", -1],
          ["r", 1],
        ]) {
          const hand = s.reachTarget[i].clone().addScaledVector(right, sign * (BALL_R + 0.03)).addScaledVector(fwd, -0.03);
          const pole = c.clone().addScaledVector(down, 0.45).addScaledVector(right, sign * 0.35).addScaledVector(fwd, -0.1);
          solveArmIK(bones[`upperarm_${side}`], bones[`lowerarm_${side}`], bones[`hand_${side}`], hand, pole, w);
          curlHand(bones, side, 0.35 * w);
        }
      }
      // Lean into a pass, or towards a ball that's off-line.
      if (lean && lean.lengthSq() > 0.01) swingToward(bones.spine_01, bones.spine_02, lean.normalize(), 0.12 * w);

      // Ball between the hands when held, passing or picking it up.
      if (mine && ["held", "pass", "crouch"].includes(s.mode) && w > 0.6) {
        const l = bones.hand_l.getWorldPosition(new THREE.Vector3());
        const r = bones.hand_r.getWorldPosition(new THREE.Vector3());
        ball.position.copy(l).lerp(r, 0.5).addScaledVector(fwd, 0.05);
      } else if (mine && s.mode === "hand") {
        const r = bones.hand_r.getWorldPosition(new THREE.Vector3());
        const tip = bones.middle_01_r.getWorldPosition(new THREE.Vector3());
        ball.position.copy(r).lerp(tip, 0.8);
      }

      lookAt(bones.neck_01, bones.Head, ball.position, 0.85);
    }
    world.set("ball", ball.position);

    // For the hover focus: both boys and the ball, however far it has rolled.
    const pa = actors[0].bones.pelvis.getWorldPosition(new THREE.Vector3());
    const pb = actors[1].bones.pelvis.getWorldPosition(new THREE.Vector3());
    const center = pa.clone().add(pb).add(ball.position).divideScalar(3);
    const radius = Math.max(center.distanceTo(pa), center.distanceTo(pb), center.distanceTo(ball.position)) + 0.55;
    const label =
      s.mode === "loose" || s.mode === "crouch" ? "Fetching the ball" : s.mode === "dribble" ? "Bouncing the ball" : "Playing catch";
    world.group("catch", center, radius, label);
  });

  return (
    <>
      <primitive object={a.root} />
      <primitive object={b.root} />
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[BALL_R, 24, 16]} />
        <meshStandardMaterial color="#d9483b" roughness={0.55} />
      </mesh>
    </>
  );
}
