"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./park-panel.module.css";

// Three.js and the park only load in the browser, after the form has rendered.
const ParkScene = dynamic(() => import("./park-scene"), { ssr: false });

function useCanAnimate() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const check = () => {
      const canvas = document.createElement("canvas");
      const webgl = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
      setOk(webgl && !motion.matches);
    };
    check();
    motion.addEventListener("change", check);
    return () => {
      motion.removeEventListener("change", check);
    };
  }, []);
  return ok;
}

const HINTS = [
  ["drag", "Drag", "look around"],
  ["scroll", "Scroll", "zoom"],
  ["keys", "W A S D", "move"],
  ["click", "Click", "follow someone"],
];

const MOVE_KEYS = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
const isTyping = (el) => el instanceof Element && el.closest("input, textarea, select, [contenteditable='true']") !== null;

// Lights up the matching hint while the visitor is using that control.
function useActiveHints() {
  const [active, setActive] = useState({});
  useEffect(() => {
    const held = new Set();
    const timers = {};
    const flash = (name, ms = 500) => {
      setActive((a) => ({ ...a, [name]: true }));
      clearTimeout(timers[name]);
      timers[name] = setTimeout(() => setActive((a) => ({ ...a, [name]: false })), ms);
    };
    const down = (e) => {
      const key = e.key.toLowerCase();
      if (isTyping(e.target) || !MOVE_KEYS.has(key)) return;
      held.add(key);
      setActive((a) => ({ ...a, keys: true }));
    };
    const up = (e) => {
      held.delete(e.key.toLowerCase());
      if (!held.size) setActive((a) => ({ ...a, keys: false }));
    };
    const wheel = (e) => {
      if (e.target instanceof HTMLCanvasElement) flash("scroll");
    };
    const press = (e) => {
      if (e.target instanceof HTMLCanvasElement) setActive((a) => ({ ...a, drag: true }));
    };
    const release = () => setActive((a) => (a.drag ? { ...a, drag: false } : a));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("wheel", wheel, { passive: true });
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);
  return active;
}

export default function ParkPanel() {
  const canAnimate = useCanAnimate();
  const [ready, setReady] = useState(false);
  const [explored, setExplored] = useState(false);
  const labelRef = useRef(null);
  const controlsRef = useRef(null);
  const onInteract = useCallback(() => setExplored(true), []);
  const active = useActiveHints();

  if (!canAnimate) {
    return (
      <div className={styles.panel} aria-hidden="true">
        <div className={styles.poster} />
        <div className={styles.shade} />
      </div>
    );
  }

  return (
    <section
      className={styles.panel}
      aria-label="Interactive park. Drag or use W A S D and the arrow keys to look around; scroll or + and − to zoom; R to reset."
    >
      <div className={styles.poster} data-hidden={ready} aria-hidden="true" />
      <div className={styles.scene} data-ready={ready}>
        <ParkScene
          labelRef={labelRef}
          controlsRef={controlsRef}
          onInteract={onInteract}
          onReady={() => setTimeout(() => setReady(true), 400)}
        />
      </div>
      <div ref={labelRef} className={styles.caption} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />

      {/* How to explore: prominent at first, then quiet once they've tried it. */}
      <div className={styles.hints} data-quiet={explored} data-ready={ready}>
        {HINTS.map(([id, key, action]) => (
          <span key={id} className={styles.hint} data-active={Boolean(active[id])}>
            <kbd>{key}</kbd>
            {action}
          </span>
        ))}
      </div>

      <div className={styles.controls} data-ready={ready}>
        <button type="button" onClick={() => controlsRef.current?.zoom(0.8)} aria-label="Zoom in">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" onClick={() => controlsRef.current?.zoom(1.25)} aria-label="Zoom out">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button type="button" onClick={() => controlsRef.current?.reset()} aria-label="Reset view">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.3-5.6" />
            <path d="M4 4v4h4" />
          </svg>
        </button>
      </div>
    </section>
  );
}
