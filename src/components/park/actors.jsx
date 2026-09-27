"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { Artist } from "./actors/artist";
import { Swinger } from "./actors/swinger";
import { BallGame } from "./actors/ball-game";
import { TagGame } from "./actors/tag-game";
import { Parent } from "./actors/parent";

// Shared, live points of interest so characters can glance at each other.
function createWorld() {
  const points = new Map();
  return {
    set(name, v) {
      if (!points.has(name)) points.set(name, new THREE.Vector3());
      points.get(name).copy(v);
    },
    interests() {
      return points.size ? [...points.values()] : [new THREE.Vector3(0, 1, 0)];
    },
  };
}

export function Actors({ board, canvasRef }) {
  const world = useMemo(() => createWorld(), []);
  return (
    <>
      <Artist board={board} canvasRef={canvasRef} world={world} />
      <Swinger world={world} />
      <BallGame world={world} />
      <TagGame world={world} />
      <Parent world={world} />
    </>
  );
}
