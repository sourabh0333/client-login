"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { BENCH, EASEL, SLIDE, SWINGS, TABLE } from "./layout";

const wood = new THREE.MeshStandardMaterial({ color: "#9a7452", roughness: 0.8 });
const darkWood = new THREE.MeshStandardMaterial({ color: "#6d4f37", roughness: 0.85 });
const metal = new THREE.MeshStandardMaterial({ color: "#3d4a4f", roughness: 0.45, metalness: 0.6 });
const paintedMetal = new THREE.MeshStandardMaterial({ color: "#2f6b5e", roughness: 0.5, metalness: 0.3 });
const plastic = new THREE.MeshStandardMaterial({ color: "#e0a23a", roughness: 0.4 });

function Box({ size, position, rotation, material = wood }) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Rod({ from, to, radius = 0.02, material = metal }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: a.clone().add(b).multiplyScalar(0.5), quaternion: q, length: dir.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
    </mesh>
  );
}

// Canvas centre sits ~1.0 m up so a child's hand reaches the middle of the sheet.
export const EASEL_CANVAS = { center: [0, 1.02, 0.09], size: [0.52, 0.65], tilt: -0.12 };

// Where the paint jar sits on the easel tray (easel-local) and on the table (world).
export const EASEL_TRAY = [0.2, 0.735, 0.15];
const TABLE_TOP = 0.55;
export const TABLE_JAR = (() => {
  const [x, , z] = TABLE.position;
  const [lx, lz] = [0.22, 0.16];
  const c = Math.cos(TABLE.rotation);
  const s = Math.sin(TABLE.rotation);
  return [x + lx * c + lz * s, TABLE_TOP + 0.065, z - lx * s + lz * c];
})();

export function Easel({ board, canvasRef }) {
  const { center, size, tilt } = EASEL_CANVAS;
  return (
    <group position={EASEL.position} rotation-y={EASEL.rotation}>
      <Rod from={[-0.3, 0, 0.1]} to={[-0.05, 1.5, -0.02]} radius={0.018} material={wood} />
      <Rod from={[0.3, 0, 0.1]} to={[0.05, 1.5, -0.02]} radius={0.018} material={wood} />
      <Rod from={[0, 0, -0.5]} to={[0, 1.42, -0.04]} radius={0.016} material={wood} />
      <Box size={[0.62, 0.035, 0.08]} position={[0, center[1] - size[1] / 2 - 0.02, 0.14]} />
      <group ref={canvasRef} position={center} rotation-x={tilt}>
        <Box size={[size[0] + 0.02, size[1] + 0.02, 0.012]} position={[0, 0, -0.008]} material={darkWood} />
        <mesh castShadow receiveShadow>
          <planeGeometry args={size} />
          <meshStandardMaterial map={board.texture} roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

const JAR_COLORS = ["#d8493b", "#f0c237", "#3f7fc4", "#4fa150", "#f4f1ea"];

export function PaintTable() {
  return (
    <group position={TABLE.position} rotation-y={TABLE.rotation}>
      <Box size={[1.2, 0.04, 0.66]} position={[0, TABLE_TOP - 0.02, 0]} />
      {[
        [-0.55, -0.28],
        [0.55, -0.28],
        [-0.55, 0.28],
        [0.55, 0.28],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.05, TABLE_TOP - 0.04, 0.05]} position={[x, (TABLE_TOP - 0.04) / 2, z]} material={darkWood} />
      ))}
      {/* Paint jars, a palette, brushes in a cup and a pad of paper. */}
      {JAR_COLORS.map((c, i) => (
        <group key={c} position={[-0.42 + i * 0.12, TABLE_TOP + 0.035, -0.1]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.07, 14]} />
            <meshStandardMaterial color={c} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.037, 0.037, 0.012, 14]} />
            <meshStandardMaterial color="#e8e2d6" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.3, TABLE_TOP + 0.001, -0.1]} rotation-x={-Math.PI / 2} castShadow receiveShadow>
        <circleGeometry args={[0.13, 24]} />
        <meshStandardMaterial color="#efe6d4" roughness={0.7} />
      </mesh>
      {JAR_COLORS.slice(0, 4).map((c, i) => (
        <mesh key={c} position={[0.3 + Math.cos(i * 1.4) * 0.07, TABLE_TOP + 0.003, -0.1 + Math.sin(i * 1.4) * 0.07]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.022, 12]} />
          <meshStandardMaterial color={c} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0.45, TABLE_TOP + 0.055, 0.18]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.11, 12]} />
        <meshStandardMaterial color="#c9d6d8" roughness={0.2} transparent opacity={0.75} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <Rod key={i} from={[0.45 + (i - 1) * 0.012, TABLE_TOP + 0.01, 0.18]} to={[0.45 + (i - 1) * 0.04, TABLE_TOP + 0.2, 0.18 + (i - 1) * 0.02]} radius={0.005} material={darkWood} />
      ))}
      <Box size={[0.3, 0.02, 0.22]} position={[-0.2, TABLE_TOP + 0.01, 0.12]} rotation={[0, 0.3, 0]} material={new THREE.MeshStandardMaterial({ color: "#f7f3ea", roughness: 0.9 })} />
    </group>
  );
}

export function Bench() {
  return (
    <group position={BENCH.position} rotation-y={BENCH.rotation}>
      {[0, 1, 2].map((i) => (
        <Box key={`s${i}`} size={[1.7, 0.035, 0.1]} position={[0, 0.45, -0.13 + i * 0.13]} />
      ))}
      {[0, 1].map((i) => (
        <Box key={`b${i}`} size={[1.7, 0.1, 0.03]} position={[0, 0.62 + i * 0.14, -0.24]} rotation={[-0.15, 0, 0]} />
      ))}
      {[-0.7, 0.7].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box size={[0.05, 0.45, 0.05]} position={[0, 0.22, 0.12]} material={metal} />
          <Box size={[0.05, 0.85, 0.05]} position={[0, 0.42, -0.2]} rotation={[-0.12, 0, 0]} material={metal} />
          <Box size={[0.05, 0.04, 0.4]} position={[0, 0.43, -0.03]} material={metal} />
        </group>
      ))}
    </group>
  );
}

export const SWING_BEAM_HEIGHT = 2.3;
export const SWING_SEAT_OFFSETS = [-0.55, 0.55];

export function SwingFrame() {
  const h = SWING_BEAM_HEIGHT;
  return (
    <group position={SWINGS.position} rotation-y={SWINGS.rotation}>
      {[-1.3, 1.3].map((x) => (
        <group key={x}>
          <Rod from={[x, 0, -0.75]} to={[x, h, 0]} radius={0.045} material={paintedMetal} />
          <Rod from={[x, 0, 0.75]} to={[x, h, 0]} radius={0.045} material={paintedMetal} />
        </group>
      ))}
      <Rod from={[-1.35, h, 0]} to={[1.35, h, 0]} radius={0.05} material={paintedMetal} />
    </group>
  );
}

// One swing (chains + seat), pivoting on the beam. `angleRef.current` drives it.
export function SwingSeat({ offset, pivotRef, children }) {
  const h = SWING_BEAM_HEIGHT;
  return (
    <group position={SWINGS.position} rotation-y={SWINGS.rotation}>
      <group ref={pivotRef} position={[offset, h, 0]}>
        <Rod from={[-0.22, 0, 0]} to={[-0.22, -1.82, 0]} radius={0.008} material={metal} />
        <Rod from={[0.22, 0, 0]} to={[0.22, -1.82, 0]} radius={0.008} material={metal} />
        <Box size={[0.5, 0.03, 0.2]} position={[0, -1.84, 0]} material={new THREE.MeshStandardMaterial({ color: "#232526", roughness: 0.7 })} />
        {children}
      </group>
    </group>
  );
}

export function Slide() {
  return (
    <group position={SLIDE.position} rotation-y={SLIDE.rotation}>
      {/* Platform and ladder. */}
      <Box size={[0.7, 0.06, 0.7]} position={[0, 1.5, 0]} material={wood} />
      {[
        [-0.33, -0.33],
        [0.33, -0.33],
        [-0.33, 0.33],
        [0.33, 0.33],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.07, 2.1, 0.07]} position={[x, 1.05, z]} material={paintedMetal} />
      ))}
      <Box size={[0.7, 0.3, 0.03]} position={[0, 1.72, -0.34]} material={paintedMetal} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} size={[0.5, 0.03, 0.08]} position={[0, 0.25 + i * 0.28, -0.6 + i * 0.05]} material={wood} />
      ))}
      <Rod from={[-0.27, 0, -0.62]} to={[-0.27, 1.5, -0.38]} radius={0.025} material={paintedMetal} />
      <Rod from={[0.27, 0, -0.62]} to={[0.27, 1.5, -0.38]} radius={0.025} material={paintedMetal} />
      {/* Chute. */}
      <group position={[0, 0.8, 1.35]} rotation-x={0.62}>
        <Box size={[0.55, 0.03, 2.3]} position={[0, 0, 0]} material={plastic} />
        <Box size={[0.03, 0.12, 2.3]} position={[-0.28, 0.06, 0]} material={plastic} />
        <Box size={[0.03, 0.12, 2.3]} position={[0.28, 0.06, 0]} material={plastic} />
      </group>
    </group>
  );
}

// Background furniture: a lamp post, a bin and a low hedge line to close off the park.
export function Scenery() {
  const hedge = useMemo(() => new THREE.MeshStandardMaterial({ color: "#35512a", roughness: 0.95 }), []);
  return (
    <group>
      <group position={[5.4, 0, -0.8]}>
        <Rod from={[0, 0, 0]} to={[0, 3.2, 0]} radius={0.05} material={metal} />
        <mesh position={[0, 3.3, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.16, 0.28, 8]} />
          <meshStandardMaterial color="#2c3538" roughness={0.5} metalness={0.5} />
        </mesh>
      </group>
      <group position={[3.4, 0, 1.2]}>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.22, 0.8, 16]} />
          <meshStandardMaterial color="#3a4b45" roughness={0.6} metalness={0.2} />
        </mesh>
      </group>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[-18 + i * 2.4, 0.55, -23 + Math.sin(i * 1.7) * 0.8]} scale={[1.6, 0.8, 1]} material={hedge} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
      ))}
    </group>
  );
}
