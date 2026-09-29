"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useActor } from "../use-actor";
import { chance, lookAt, rand, wait } from "../rig-tools";
import { ONLOOKERS } from "../layout";

/**
 * One passer-by who has stopped behind the artist to watch her work. Mostly looks at the
 * sheet as it fills in; now and then folds their arms, nods approvingly, or glances at the
 * girl or at the person beside them.
 */
function Onlooker({ spot, canvasRef, world, index, peerRef, selfRef }) {
  const actor = useActor(spot.name);
  const look = useRef({ mode: "sheet", smooth: null });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    actor.root.position.set(...spot.position);
    actor.root.rotation.set(0, spot.facing, 0);
    // Different starting points in the idle so the two don't breathe in step.
    actor.play("Stand", { fade: 0, from: index * 1.3 });
    selfRef.current = actor;

    const life = async () => {
      await wait(rand(500, 2500), signal);
      for (;;) {
        await wait(rand(3000, 7000), signal);
        const r = Math.random();
        if (r < 0.3) {
          actor.play("Idle_FoldArms_Loop", { fade: 0.7 });
          await wait(rand(4000, 8000), signal);
          actor.play("Stand", { fade: 0.7 });
        } else if (r < 0.5) {
          await actor.play("Yes", { loop: false, fade: 0.35 });
          actor.play("Stand", { fade: 0.5 });
        } else if (r < 0.75) {
          look.current.mode = chance(0.5) ? "artist" : "peer";
          await wait(rand(1500, 3000), signal);
          look.current.mode = "sheet";
        }
      }
    };
    life().catch((e) => {
      if (e.name !== "AbortError") throw e;
    });
    return () => controller.abort();
  }, [actor, spot, index, selfRef]);

  useFrame((_, dt) => {
    const b = actor.bones;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Where they're looking: the sheet by default, else the girl or the person beside them.
    const l = look.current;
    let target = canvas.getWorldPosition(new THREE.Vector3());
    const artist = world.groups().find((g) => g.id === "artist");
    if (l.mode === "artist" && artist) target = artist.center.clone().add(new THREE.Vector3(0, 0.35, 0));
    if (l.mode === "peer" && peerRef.current) target = peerRef.current.bones.Head.getWorldPosition(new THREE.Vector3());
    l.smooth = (l.smooth ?? target.clone()).lerp(target, 1 - Math.exp(-dt * 3));
    lookAt(b.neck_01, b.Head, l.smooth, 0.85);
  });

  return <primitive object={actor.root} />;
}

export function Onlookers({ canvasRef, world }) {
  const a = useRef(null);
  const b = useRef(null);

  useFrame(() => {
    if (!a.current || !b.current) return;
    const pa = a.current.bones.spine_02.getWorldPosition(new THREE.Vector3());
    const pb = b.current.bones.spine_02.getWorldPosition(new THREE.Vector3());
    world.group("onlookers", pa.clone().lerp(pb, 0.5), pa.distanceTo(pb) / 2 + 0.45, "Admiring the painting");
  });

  return (
    <>
      <Onlooker spot={ONLOOKERS[0]} index={0} canvasRef={canvasRef} world={world} selfRef={a} peerRef={b} />
      <Onlooker spot={ONLOOKERS[1]} index={1} canvasRef={canvasRef} world={world} selfRef={b} peerRef={a} />
    </>
  );
}
