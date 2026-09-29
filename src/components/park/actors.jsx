"use client";

import * as THREE from "three";
import { Artist } from "./actors/artist";
import { Swinger } from "./actors/swinger";
import { BallGame } from "./actors/ball-game";
import { TagGame } from "./actors/tag-game";
import { Parent } from "./actors/parent";
import { Onlookers } from "./actors/onlookers";

// Shared, live state of the park:
// - points of interest, so characters can glance at each other;
// - groups (who is doing what, where, and how big an area), for the hover focus effect.
export function createWorld() {
  const points = new Map();
  const groups = new Map();
  return {
    set(name, v) {
      if (!points.has(name)) points.set(name, new THREE.Vector3());
      points.get(name).copy(v);
    },
    interests() {
      return points.size ? [...points.values()] : [new THREE.Vector3(0, 1, 0)];
    },
    group(id, center, radius, label) {
      let g = groups.get(id);
      if (!g) groups.set(id, (g = { id, center: new THREE.Vector3(), radius, label }));
      g.center.copy(center);
      g.radius = radius;
      g.label = label;
    },
    groups() {
      return [...groups.values()];
    },
  };
}

export function Actors({ board, canvasRef, world }) {
  return (
    <>
      <Artist board={board} canvasRef={canvasRef} world={world} />
      <Swinger world={world} />
      <BallGame world={world} />
      <TagGame world={world} />
      <Parent world={world} />
      <Onlookers canvasRef={canvasRef} world={world} />
    </>
  );
}

