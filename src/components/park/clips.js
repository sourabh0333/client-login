"use client";

import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";

export const ANIM_FILES = ["/models/anims-1.glb", "/models/anims-2.glb"];
const FPS = 30;

// The animation library: every clip plus the mannequin skeleton it was authored on.
export function useClips() {
  const a = useGLTF(ANIM_FILES[0]);
  const b = useGLTF(ANIM_FILES[1]);
  return useMemo(() => {
    const clips = {};
    for (const clip of [...a.animations, ...b.animations]) clips[clip.name] = clip;
    const skeleton = a.scene;
    const rest = new Map();
    skeleton.traverse((o) => rest.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
    clips.Stand = deriveStand(clips.Idle_Loop, skeleton);
    return { clips, skeleton, rest };
  }, [a, b]);
}

const LEG_BONES = /^(thigh|calf|foot|ball)_/;
const FINGER_BONES = /^(thumb|index|middle|ring|pinky)_/;
// The idle's upper body is a hunched "ready" stance; ease it towards upright.
const POSTURE_BONES = /^(spine_0[123]|neck_01|Head|clavicle_[lr])$/;

/**
 * A relaxed standing clip made from the library's idle, on the mannequin itself so it
 * retargets like any other clip. The game idle stands in a crouched "ready" stance with
 * fists; here the legs return to the mannequin's straight rest stance, the hips rise to
 * match, the back straightens partway and the hands relax halfway open. The upper body
 * keeps the idle's breathing.
 */
function deriveStand(idle, skeleton) {
  const nodes = {};
  skeleton.traverse((o) => (nodes[o.name] = o));
  const q = new THREE.Quaternion();
  const r = new THREE.Quaternion();
  const tracks = idle.tracks.map((track) => {
    const [bone, prop] = track.name.split(".");
    const node = nodes[bone];
    if (prop === "quaternion" && node && LEG_BONES.test(bone)) {
      const v = node.quaternion;
      return new THREE.QuaternionKeyframeTrack(track.name, [0], [v.x, v.y, v.z, v.w]);
    }
    if (prop === "quaternion" && node && POSTURE_BONES.test(bone)) {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).slerp(r.copy(node.quaternion), 0.45).toArray(values, i);
      }
      return new THREE.QuaternionKeyframeTrack(track.name, track.times, values);
    }
    if (prop === "quaternion" && node && FINGER_BONES.test(bone)) {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).slerp(r.copy(node.quaternion), 0.55).toArray(values, i);
      }
      return new THREE.QuaternionKeyframeTrack(track.name, track.times, values);
    }
    if (prop === "position" && bone === "pelvis" && node) {
      const values = track.values.slice();
      const base = values.slice(0, 3);
      for (let i = 0; i < values.length; i += 3) {
        for (let k = 0; k < 3; k++) values[i + k] = node.position.getComponent(k) + (values[i + k] - base[k]) * 0.35;
      }
      return new THREE.VectorKeyframeTrack(track.name, track.times, values);
    }
    return track.clone();
  });
  return new THREE.AnimationClip("Stand", idle.duration, tracks);
}

function restore(rest) {
  for (const [o, [p, q, s]] of rest) {
    o.position.copy(p);
    o.quaternion.copy(q);
    o.scale.copy(s);
  }
}

function worldRelativeTo(root, node, outQ, outP) {
  const m = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(node.matrixWorld);
  const s = new THREE.Vector3();
  m.decompose(outP ?? new THREE.Vector3(), outQ, s);
}

function namedNodes(root) {
  const map = {};
  root.traverse((o) => {
    if (o.isBone || o.type === "Object3D" || o.type === "Bone") map[o.name] = o;
  });
  return map;
}

/**
 * Retargets every library clip onto a character skeleton.
 *
 * Works in world space so it survives different bone rolls and rest poses (the
 * MakeHuman rig rests in an A-pose, the mannequin in a T-pose): each target bone
 * is first rotated so it points the same way as the mannequin bone at rest, then
 * follows the mannequin bone's world-space rotation away from rest frame by frame.
 * The hips follow the mannequin's hip travel, scaled by leg length.
 */
export function createRetargeter(library, targetRoot) {
  const { clips, skeleton: src, rest } = library;
  restore(rest);
  src.updateMatrixWorld(true);
  targetRoot.updateMatrixWorld(true);

  const S = namedNodes(src);
  const T = {};
  targetRoot.traverse((o) => {
    if (o.isBone) T[o.name] = o;
  });

  // Bones present on both skeletons, parents before children.
  const order = [];
  targetRoot.traverse((o) => {
    if (o.isBone && S[o.name]) order.push(o.name);
  });

  const info = {};
  for (const name of order) {
    const sQ = new THREE.Quaternion();
    const sP = new THREE.Vector3();
    const tQ = new THREE.Quaternion();
    const tP = new THREE.Vector3();
    worldRelativeTo(src, S[name], sQ, sP);
    worldRelativeTo(targetRoot, T[name], tQ, tP);
    info[name] = { sQ0: sQ, sP0: sP, tQ0: tQ, tP0: tP, align: null };
  }

  // Direction alignment from each bone to its first shared child.
  for (const name of order) {
    const child = T[name].children.find((c) => c.isBone && info[c.name]);
    if (!child) continue;
    const ds = info[child.name].sP0.clone().sub(info[name].sP0).normalize();
    const dt = info[child.name].tP0.clone().sub(info[name].tP0).normalize();
    info[name].align = new THREE.Quaternion().setFromUnitVectors(dt, ds);
  }
  for (const name of order) {
    if (info[name].align) continue;
    const parent = T[name].parent;
    info[name].align = parent && info[parent.name]?.align ? info[parent.name].align.clone() : new THREE.Quaternion();
  }
  for (const name of order) {
    const i = info[name];
    i.tQrest = i.align.clone().multiply(i.tQ0);
    i.sQ0inv = i.sQ0.clone().invert();
  }

  // Static world rotations for target parents that are not driven (e.g. the armature node).
  const staticParentQ = {};
  for (const name of order) {
    const parent = T[name].parent;
    if (parent && !info[parent.name]) {
      const q = new THREE.Quaternion();
      worldRelativeTo(targetRoot, parent, q);
      staticParentQ[name] = q;
    }
  }

  const pelvisRatio = info.pelvis ? info.pelvis.tP0.y / info.pelvis.sP0.y : 1;
  const pelvisParentInv = new THREE.Matrix4();
  if (info.pelvis) {
    pelvisParentInv.copy(targetRoot.matrixWorld).invert().multiply(T.pelvis.parent.matrixWorld).invert();
  }

  const mixer = new THREE.AnimationMixer(src);
  const cache = new Map();
  const sQ = new THREE.Quaternion();
  const sP = new THREE.Vector3();
  const world = {};
  for (const name of order) world[name] = new THREE.Quaternion();

  // Clips are converted on first use, so an actor only pays for the motions it performs.
  return function clipFor(clipName) {
    if (cache.has(clipName)) return cache.get(clipName);
    const clip = clips[clipName];
    restore(rest);
    const action = mixer.clipAction(clip);
    action.reset().play();
    const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
    const times = new Float32Array(frames);
    const quats = {};
    for (const name of order) quats[name] = new Float32Array(frames * 4);
    const hips = new Float32Array(frames * 3);

    for (let f = 0; f < frames; f++) {
      const t = Math.min(clip.duration, f / FPS);
      times[f] = t;
      mixer.setTime(t);
      src.updateMatrixWorld(true);
      for (const name of order) {
        const i = info[name];
        worldRelativeTo(src, S[name], sQ, sP);
        // World rotation away from the mannequin's rest, applied on top of the aligned target rest.
        const w = world[name].copy(sQ).multiply(i.sQ0inv).multiply(i.tQrest);
        const parent = T[name].parent;
        const parentWorld = info[parent?.name] ? world[parent.name] : staticParentQ[name] ?? new THREE.Quaternion();
        const local = parentWorld.clone().invert().multiply(w);
        local.toArray(quats[name], f * 4);
        if (name === "pelvis") {
          const p = i.tP0.clone().add(sP.clone().sub(i.sP0).multiplyScalar(pelvisRatio));
          p.applyMatrix4(pelvisParentInv);
          p.toArray(hips, f * 3);
        }
      }
    }
    action.stop();
    mixer.uncacheAction(clip);

    const tracks = order.map((name) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, quats[name]));
    if (info.pelvis) tracks.push(new THREE.VectorKeyframeTrack("pelvis.position", times, hips));
    const result = new THREE.AnimationClip(clipName, clip.duration, tracks);
    restore(rest);
    cache.set(clipName, result);
    return result;
  };
}

ANIM_FILES.forEach((file) => useGLTF.preload(file));
