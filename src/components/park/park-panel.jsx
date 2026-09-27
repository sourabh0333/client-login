"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import styles from "./park-panel.module.css";

// Three.js and the park only load in the browser, after the form has rendered.
const ParkScene = dynamic(() => import("./park-scene"), { ssr: false });

function useCanAnimate() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 900px)");
    const check = () => {
      const canvas = document.createElement("canvas");
      const webgl = Boolean(canvas.getContext("webgl2"));
      setOk(webgl && !motion.matches && wide.matches);
    };
    check();
    motion.addEventListener("change", check);
    wide.addEventListener("change", check);
    return () => {
      motion.removeEventListener("change", check);
      wide.removeEventListener("change", check);
    };
  }, []);
  return ok;
}

export default function ParkPanel({ avoid }) {
  const canAnimate = useCanAnimate();
  const [ready, setReady] = useState(false);

  return (
    <div className={styles.panel} aria-hidden="true">
      <div className={styles.poster} data-hidden={ready} />
      {canAnimate && (
        <div className={styles.scene} data-ready={ready}>
          <ParkScene avoid={avoid} onReady={() => setTimeout(() => setReady(true), 400)} />
        </div>
      )}
      <div className={styles.shade} />
    </div>
  );
}
