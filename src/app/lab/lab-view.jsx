"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import { useActor } from "@/components/park/use-actor";

function Subject({ name, clip, x }) {
  const actor = useActor(name);
  const probeRef = useRef({ samples: [], done: false, lastT: 0 });
  useEffect(() => {
    if (clip !== "none") actor.play(clip);
  }, [actor, clip]);
  // ?probe=hand_r logs a bone's path (in the actor's frame) through one pass of the clip.
  useFrame(() => {
    const probe = new URLSearchParams(window.location.search).get("probe");
    const action = actor.mixer._actions[0];
    const pr = probeRef.current;
    if (!probe || !action || pr.done) return;
    const p = actor.bones[probe].getWorldPosition(new THREE.Vector3());
    actor.root.worldToLocal(p);
    pr.samples.push([action.time, p.x, p.y, p.z].map((v) => +v.toFixed(3)));
    if (action.time < pr.lastT) {
      pr.done = true;
      console.warn("PROBE", JSON.stringify(pr.samples));
    }
    pr.lastT = action.time;
  });
  return <primitive object={actor.root} position={[x, 0, 0]} />;
}

export default function LabView({ clip, names }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#cfd8d4" }}>
      <Canvas shadows camera={{ position: [0, 1.0, 2.8], fov: 40 }}>
        <hemisphereLight args={["#ffffff", "#667755", 1.3]} />
        <directionalLight
          position={[2, 4, 4]}
          intensity={2.2}
          castShadow
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-mapSize={[2048, 2048]}
        />
        <Suspense fallback={null}>
          {names.map((n, i) => (
            <Subject key={n} name={n} clip={clip} x={(i - (names.length - 1) / 2) * 0.8} />
          ))}
        </Suspense>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#8fa37a" />
        </mesh>
        <OrbitControls target={[0, 0.7, 0]} />
      </Canvas>
    </div>
  );
}
