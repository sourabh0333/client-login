"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Ground } from "./ground";
import { Trees } from "./trees";
import { Sky } from "./sky";
import { Bench, Easel, PaintTable, Scenery, Slide, SwingFrame } from "./props";
import { SketchBoard } from "./sketch-board";
import { WindClock } from "./wind";
import { CAMERA } from "./layout";
import { Actors, createWorld } from "./actors";
import { FocusController, createFocus } from "./focus";

// How far the form card reaches into the screen from the left (0 if there is none).
function useCardEdge(selector) {
  const [edge, setEdge] = useState(0);
  useEffect(() => {
    const el = selector && document.querySelector(selector);
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // Only a card sitting on the left, over the scene, pushes the framing across.
      setEdge(r.left < window.innerWidth / 3 && r.right < window.innerWidth * 0.6 ? r.right : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selector]);
  return edge;
}

// A slow, hand-held drift plus a little parallax towards the pointer. When a form card
// covers the left of the screen, the projection centre moves right by half the card's
// width, so the park is framed in the open area and only lawn and trees sit behind it.
function CameraRig({ avoid, focusRef }) {
  const size = useThree((s) => s.size);
  const pointer = useRef([0, 0]);
  const edge = useCardEdge(avoid);
  // ?cam=x,y,z,tx,ty,tz overrides the framing while composing the scene.
  const [base, target] = useMemo(() => {
    const q = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("cam");
    const v = q ? q.split(",").map(Number) : [...CAMERA.position, ...CAMERA.target];
    return [new THREE.Vector3(v[0], v[1], v[2]), new THREE.Vector3(v[3], v[4], v[5])];
  }, []);

  const framed = useRef("");
  const applyFraming = (cam) => {
    const { width: w, height: h } = size;
    const key = `${w}x${h}:${edge}`;
    if (framed.current === key) return;
    framed.current = key;
    const shift = edge / 2;
    if (shift > 0) {
      cam.aspect = (w + 2 * shift) / h;
      cam.setViewOffset(w + 2 * shift, h, 0, 0, w, h);
    } else {
      cam.aspect = w / h;
      cam.clearViewOffset();
    }
    cam.updateProjectionMatrix();
  };

  useEffect(() => {
    const onMove = (e) => {
      pointer.current = [e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5];
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const look = useRef(null);

  useFrame(({ clock, camera }, dt) => {
    applyFraming(camera);
    const t = clock.elapsedTime;
    const [px, py] = pointer.current;
    const focus = focusRef.current;
    const w = focus.weight;
    // Parallax fades out while focused, so the pointer can rest on a group steadily.
    const goal = base
      .clone()
      .add(new THREE.Vector3(Math.sin(t * 0.13) * 0.12 + px * 0.35 * (1 - w), Math.sin(t * 0.21) * 0.04 - py * 0.12 * (1 - w), 0));
    // Focus pull: move in along the line towards the group, rising a little so the camera
    // looks over anyone nearer (the artist is often between the camera and the others).
    if (w > 0.001) {
      const flatDir = new THREE.Vector3(goal.x - focus.center.x, 0, goal.z - focus.center.z);
      const dist = flatDir.length();
      const want = Math.min(dist, focus.radius * 2.6 + 2.4);
      const vantage = focus.center.clone().addScaledVector(flatDir.normalize(), want);
      vantage.y = Math.max(base.y, focus.center.y + 0.9 + want * 0.16);
      goal.lerp(vantage, w * 0.85);
    }
    camera.position.lerp(goal, 1 - Math.exp(-dt * 1.6));
    const aim = target.clone().lerp(focus.center, 0.9 * w);
    look.current = (look.current ?? aim.clone()).lerp(aim, 1 - Math.exp(-dt * 2.2));
    camera.lookAt(look.current);
  });
  return null;
}

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

function World({ board, avoid, labelRef }) {
  const canvasRef = useRef();
  const [world] = useState(createWorld);
  const focusRef = useRef(createFocus());
  return (
    <>
      <WindClock />
      <CameraRig avoid={avoid} focusRef={focusRef} />
      <FocusController world={world} focusRef={focusRef} labelRef={labelRef} />
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

export default function ParkScene({ onReady, avoid, labelRef }) {
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
        // Manual: CameraRig owns the aspect so it can offset the view.
        camera={{ position: CAMERA.position, fov: CAMERA.fov, near: 0.1, far: 200, manual: true }}
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
        <World board={board} avoid={avoid} labelRef={labelRef} />
      </Canvas>
    </div>
  );
}
