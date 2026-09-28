"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { useActor } from "../use-actor";
import { Mover } from "../mover";
import { chance, damp, lookAt, rand, solveArmIK, wait } from "../rig-tools";
import { EASEL_BACK, EASEL_SPOT, TABLE_SPOT, VIEW_SPOT } from "../layout";
import { EASEL_CANVAS, EASEL_TRAY, TABLE_JAR } from "../props";

const SKETCH_RATE = 36; // pencil points per second (~15 cm/s on the sheet)
const PAINT_RATE = 7; // brush dabs per second

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function makeProps() {
  const pencil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#e2b53c", roughness: 0.6 })
  );
  const brush = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.005, 0.2, 6).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#8a5a34", roughness: 0.5 })
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.007, 0.03, 8).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: "#3f7fc4", roughness: 0.4 })
  );
  tip.position.z = 0.11;
  brush.add(tip);
  const jar = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: "#3f7fc4", roughness: 0.35 })
  );
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.014, 16),
    new THREE.MeshStandardMaterial({ color: "#e8e2d6", roughness: 0.6 })
  );
  lid.position.y = 0.046;
  jar.add(glass, lid);
  for (const m of [pencil, brush, glass, lid]) m.castShadow = true;
  pencil.visible = false;
  brush.visible = false;
  return { pencil, brush, jar };
}

/**
 * The girl at the easel. She sketches (her hand follows the real pencil lines as they
 * appear on the sheet), steps back to look, wanders off now and then, fetches paint from
 * the table when the drawing is done, paints it in, and starts a fresh sheet.
 */
export function Artist({ board, canvasRef, world }) {
  const actor = useActor("artist");
  const mover = useMemo(
    () =>
      new Mover(actor, {
        position: EASEL_SPOT.position,
        heading: EASEL_SPOT.facing,
        gait: { clip: "Walk_Loop", speed: 0.78 },
      }),
    [actor]
  );
  const props = useMemo(makeProps, []);
  const s = useMemo(
    () => ({
    mode: "idle",
    acc: 0,
    pause: 0,
    pen: null,
    ik: 0,
    ikOn: false,
    look: 0,
    lookOn: false,
    lookTarget: new THREE.Vector3(0, 1, 0),
    jar: "table",
    stroke: 0,
    activity: "Sketching the park",
  }),
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const at = (spot) => mover.walkTo(spot.position, { face: spot.facing });

    const glanceAround = async (ms) => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        const options = world.interests();
        s.lookTarget.copy(options[Math.floor(Math.random() * options.length)]);
        s.lookOn = true;
        await wait(rand(1200, 2600), signal);
        if (chance(0.4)) {
          s.lookOn = false;
          await wait(rand(600, 1400), signal);
        }
      }
      s.lookOn = false;
    };

    const draw = async (mode, seconds) => {
      s.activity = mode === "sketch" ? "Sketching the park" : "Painting in watercolour";
      await at(EASEL_SPOT);
      props.pencil.visible = mode === "sketch";
      props.brush.visible = mode === "paint";
      s.mode = mode;
      s.ikOn = true;
      s.lookOn = true;
      await wait(seconds * 1000, signal);
      s.mode = "idle";
      s.pen = null;
      s.ikOn = false;
      await wait(500, signal);
      props.pencil.visible = false;
      props.brush.visible = false;
      s.lookOn = false;
    };

    const stepBack = async () => {
      s.activity = "Looking at her drawing";
      await at(EASEL_BACK);
      // Head tilt at the drawing, arms folded while she thinks about it.
      if (chance(0.5)) actor.play("Idle_FoldArms_Loop", { fade: 0.5 });
      canvasRef.current.getWorldPosition(s.lookTarget);
      s.lookOn = true;
      await wait(rand(2500, 4500), signal);
      if (chance(0.4)) await actor.play("Yes", { loop: false, fade: 0.3 });
      actor.play("Stand", { fade: 0.5 });
      s.lookOn = false;
    };

    const wander = async () => {
      s.activity = "Taking in the view";
      await at(VIEW_SPOT);
      await glanceAround(rand(4000, 7000));
    };

    const fetchPaint = async () => {
      s.activity = "Fetching paint";
      await at(TABLE_SPOT);
      const pick = actor.play("PickUp_Table", { loop: false, fade: 0.3 });
      await wait(actor.duration("PickUp_Table") * 450, signal);
      s.jar = "hands";
      await pick;
      mover.walkTo(EASEL_SPOT.position, { gait: { clip: "Walk_Carry_Loop", speed: 0.62 }, face: EASEL_SPOT.facing });
      await new Promise((resolve) => {
        const check = () => (mover.goal || mover.turnGoal ? requestAnimationFrame(check) : resolve());
        check();
      });
      mover.gait = { clip: "Walk_Loop", speed: 0.78 };
      await actor.play("Interact", { loop: false, fade: 0.25 });
      s.jar = "tray";
      actor.play("Stand", { fade: 0.4 });
    };

    const returnPaint = async () => {
      s.activity = "Putting the paint back";
      await at(EASEL_SPOT);
      await actor.play("Interact", { loop: false, fade: 0.25 });
      s.jar = "hands";
      actor.play("Stand", { fade: 0.3 });
      await mover.walkTo(TABLE_SPOT.position, { gait: { clip: "Walk_Carry_Loop", speed: 0.62 }, face: TABLE_SPOT.facing });
      mover.gait = { clip: "Walk_Loop", speed: 0.78 };
      await actor.play("Interact", { loop: false, fade: 0.25 });
      s.jar = "table";
      actor.play("Stand", { fade: 0.4 });
    };

    const newSheet = async () => {
      s.activity = "Starting a fresh sheet";
      await at(EASEL_SPOT);
      await actor.play("Interact", { loop: false, fade: 0.25 });
      board.reset();
      actor.play("Stand", { fade: 0.4 });
      await wait(900, signal);
    };

    const life = async () => {
      actor.play("Stand", { fade: 0 });
      await wait(600, signal);
      for (;;) {
        if (!board.sketchDone) {
          await draw("sketch", rand(12, 22));
          if (board.sketchDone) continue;
          const r = Math.random();
          if (r < 0.45) await stepBack();
          else if (r < 0.7) await wander();
          else await glanceAround(rand(1500, 3000));
        } else if (!board.paintDone) {
          if (s.jar !== "tray") await fetchPaint();
          await draw("paint", rand(10, 18));
          if (!board.paintDone && chance(0.5)) await stepBack();
        } else {
          await stepBack();
          await returnPaint();
          if (chance(0.5)) await wander();
          await newSheet();
        }
      }
    };

    life().catch((e) => {
      if (e.name !== "AbortError") throw e;
    });
    return () => controller.abort();
  }, [actor, mover, board, canvasRef, props, s, world]);

  useFrame((_, dt) => {
    mover.update(dt);
    const b = actor.bones;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Advance the drawing and track where the pencil/brush tip is.
    if (s.mode === "sketch" || s.mode === "paint") {
      if (s.pause > 0) {
        s.pause -= dt;
      } else {
        s.acc += dt * (s.mode === "sketch" ? SKETCH_RATE : PAINT_RATE);
        const n = Math.floor(s.acc);
        if (n > 0) {
          s.acc -= n;
          const before = board.strokeIndex;
          const pen = s.mode === "sketch" ? board.sketch(n) : board.paint(n);
          if (pen) s.pen = pen;
          // Lift the pencil between strokes: barely at all between little leaf flicks,
          // a proper pause (and a look) after a long line.
          if (s.mode === "sketch" && board.strokeIndex !== before) {
            const done = board.strokes[board.strokeIndex - 1];
            s.pause = done && done.points.length > 10 ? rand(0.25, 0.7) : rand(0.03, 0.12);
          }
          if (s.mode === "paint" && chance(0.08)) s.pause = rand(0.3, 0.8);
        }
      }
    }

    // Arm IK towards the tip, hovering a little off the sheet during pauses.
    const normal = tmp2.set(0, 0, 1).transformDirection(canvas.matrixWorld);
    if (s.pen) {
      const [u, v] = s.pen;
      const [w, h] = EASEL_CANVAS.size;
      const tipTarget = canvas.localToWorld(tmp.set((u - 0.5) * w, (0.5 - v) * h, 0.004));
      tipTarget.addScaledVector(normal, s.pause > 0 ? 0.05 : 0);
      s.tip = (s.tip ?? tipTarget.clone()).lerp(tipTarget, 1 - Math.exp(-dt * 14));
    }
    s.ik = damp(s.ik, s.ikOn && s.pen ? 1 : 0, 4, dt);
    if (s.ik > 0.001 && s.tip) {
      const shoulder = b.upperarm_r.getWorldPosition(new THREE.Vector3());
      const toolLen = s.mode === "paint" ? 0.15 : 0.1;
      const wrist = s.tip.clone().add(shoulder.clone().sub(s.tip).normalize().multiplyScalar(toolLen));
      const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(actor.root.quaternion);
      const pole = shoulder.clone().add(new THREE.Vector3(0, -0.45, 0)).addScaledVector(right, 0.3).addScaledVector(normal, 0.2);
      solveArmIK(b.upperarm_r, b.lowerarm_r, b.hand_r, wrist, pole, s.ik);
      // The tool runs from the fingers to the tip.
      const tool = s.mode === "paint" ? props.brush : props.pencil;
      const handPos = b.hand_r.getWorldPosition(new THREE.Vector3());
      const dir = s.tip.clone().sub(handPos).normalize();
      tool.position.copy(s.tip).addScaledVector(dir, s.mode === "paint" ? -0.1 : -0.07);
      tool.lookAt(s.tip);
    }

    // Head: watch the tip while working, otherwise whatever caught her eye.
    if (s.ik > 0.3 && s.tip) s.lookTarget.lerp(s.tip, 1 - Math.exp(-dt * 6));
    s.look = damp(s.look, s.lookOn ? 1 : 0, 3, dt);
    lookAt(b.neck_01, b.Head, s.lookTarget, s.look * 0.9);

    // The paint jar: on the table, in her hands, or on the easel's tray.
    if (s.jar === "hands") {
      const l = b.hand_l.getWorldPosition(new THREE.Vector3());
      const r = b.hand_r.getWorldPosition(new THREE.Vector3());
      props.jar.position.copy(l).lerp(r, 0.5).add(new THREE.Vector3(0, -0.03, 0));
    } else if (s.jar === "tray") {
      canvas.parent.localToWorld(props.jar.position.set(...EASEL_TRAY));
    } else {
      props.jar.position.set(...TABLE_JAR);
    }

    // For the hover focus: her and her easel, wherever she has wandered.
    const hips = b.pelvis.getWorldPosition(new THREE.Vector3());
    const easel = canvas.getWorldPosition(new THREE.Vector3());
    const spread = Math.hypot(hips.x - easel.x, hips.z - easel.z);
    world.group("artist", hips.clone().lerp(easel, spread < 1.5 ? 0.4 : 0.1), 0.75 + Math.min(spread, 1.5) * 0.4, s.activity);
  });

  return (
    <>
      <primitive object={actor.root} />
      <primitive object={props.pencil} />
      <primitive object={props.brush} />
      <primitive object={props.jar} />
    </>
  );
}
