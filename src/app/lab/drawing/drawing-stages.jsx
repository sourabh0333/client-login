"use client";

import { useEffect, useRef } from "react";
import { SketchBoard } from "@/components/park/sketch-board";

const STAGES = [
  ["Sketch halfway", (b) => b.sketch(Math.floor(b.strokes.reduce((n, s) => n + s.points.length, 0) / 2))],
  ["Sketch done", (b) => b.sketch(1e6)],
  ["Painted", (b) => (b.sketch(1e6), b.paint(1e6))],
];

export default function DrawingStages() {
  const refs = useRef([]);
  useEffect(() => {
    STAGES.forEach(([, run], i) => {
      const board = new SketchBoard();
      run(board);
      const target = refs.current[i];
      target.getContext("2d").drawImage(board.canvas, 0, 0);
    });
  }, []);
  return (
    <div style={{ display: "flex", gap: 16, padding: 16, background: "#888" }}>
      {STAGES.map(([label], i) => (
        <figure key={label} style={{ margin: 0 }}>
          <canvas ref={(el) => (refs.current[i] = el)} width={512} height={640} />
          <figcaption style={{ color: "#fff" }}>{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
