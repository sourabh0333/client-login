"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { Ground } from "./ground";
import { Trees } from "./trees";
import { Sky } from "./sky";
import { Bench, Easel, PaintTable, Scenery, Slide, SwingFrame } from "./props";
import { SketchBoard } from "./sketch-board";
import { WindClock } from "./wind";
import { CAMERA } from "./layout";
import { Actors, createWorld } from "./actors";
import { FocusController, HighlightRing, createFocus } from "./focus";
import { CameraRig } from "./camera-rig";

function Lights() {
  const sun = useRef();
  useEffect(() => {
    const s = sun.current;
    s.target.position.set(0, 0, 0);
    s.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight args={["#d9e8f2", "#5d6b3c", 1.15]} />
      <directionalLight
        ref={sun}
        position={[-9, 11, 7]}
        intensity={2.6}
        color="#fff1d8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[6, 4, -8]} intensity={0.35} color="#bcd4ff" />
    </>
  );
}

function World({ board, labelRef, controlsRef, onInteract }) {
  const canvasRef = useRef();
  const [world] = useState(createWorld);
  const focusRef = useRef(createFocus());
  return (
    <>
      <WindClock />
      <CameraRig focusRef={focusRef} controlsRef={controlsRef} onInteract={onInteract} />
      <FocusController world={world} focusRef={focusRef} labelRef={labelRef} />
      <HighlightRing focusRef={focusRef} />
      <Lights />
      <Sky />
      <fog attach="fog" args={["#e6e6da", 24, 75]} />
      <Ground />
      <Trees />
      <SwingFrame />
      <Slide />
      <Bench />
      <PaintTable />
      <Easel board={board} canvasRef={canvasRef} />
      <Scenery />
      <Suspense fallback={null}>
        <Actors board={board} canvasRef={canvasRef} world={world} />
      </Suspense>
    </>
  );
}

export default function ParkScene({ onReady, labelRef, controlsRef, onInteract }) {
  const [board] = useState(() => {
    const b = new SketchBoard();
    // ?stage=paint skips ahead to the painting part while developing.
    if (process.env.NODE_ENV !== "production" && window.location.search.includes("stage=paint")) b.sketch(1e6);
    return b;
  });
  const wrap = useRef();
  const [visible, setVisible] = useState(true);
  // Start sharp; drop resolution if this device can't hold a smooth frame rate.
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => () => board.dispose(), [board]);

  // Stop rendering entirely while the scene is scrolled out of view.
  useEffect(() => {
    const el = wrap.current;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        shadows
        dpr={dpr}
        frameloop={visible ? "always" : "never"}
        camera={{ position: CAMERA.position, fov: CAMERA.fov, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          onReady?.();
        }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(1.5)}
          flipflops={3}
          onFallback={() => setDpr(1)}
        />
        <World board={board} labelRef={labelRef} controlsRef={controlsRef} onInteract={onInteract} />
      </Canvas>
    </div>
  );
}
