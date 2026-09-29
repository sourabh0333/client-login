"use client";

import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { createRetargeter, useClips } from "./clips";

export const CAST = ["artist", "swinger", "thrower_a", "thrower_b", "runner_a", "runner_b", "parent", "onlooker_a", "onlooker_b"];
export const modelUrl = (name) => `/models/humans/${name}.glb`;

const CARD_RE = /hair|brow|lash|ponytail|braid|bob0|short0|long0|afro/;

// MakeHuman exports every material as blended with its specular map in the metal/roughness
// slot. Clothes and skin become opaque and matte; hair, brows and lashes become cut-out
// cards so they don't need sorting.
function prepareMaterials(root, tints = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    const m = o.material.clone();
    const name = `${o.name} ${m.name}`.toLowerCase();
    m.metalnessMap = null;
    m.roughnessMap = null;
    m.metalness = 0;
    m.transparent = false;
    m.depthWrite = true;
    if (CARD_RE.test(name)) {
      m.alphaTest = 0.5;
      m.side = THREE.DoubleSide;
      m.roughness = 0.75;
      o.castShadow = !/brow|lash/.test(name);
    } else if (/low-poly|eye/.test(name)) {
      m.roughness = 0.2;
      o.castShadow = false;
    } else {
      m.alphaTest = 0;
      m.roughness = /body|base/.test(name) ? 0.62 : 0.88;
    }
    for (const [key, color] of Object.entries(tints)) {
      if (name.includes(key)) m.color = new THREE.Color(color);
    }
    o.material = m;
  });
}

/**
 * Loads one MakeHuman character and gives back a small animation controller.
 * The mixer updates before any procedural bone tweaks the caller makes in its own useFrame.
 */
export function useActor(name, { tints } = {}) {
  const gltf = useGLTF(modelUrl(name));
  const library = useClips();

  const actor = useMemo(() => {
    // MakeHuman characters rest facing -Z, like the mannequin's rest pose; the clips turn
    // both to face +Z, so after retargeting every actor walks towards its local +Z.
    const body = SkeletonUtils.clone(gltf.scene);
    const root = new THREE.Group();
    root.userData.actorRoot = true;
    root.add(body);
    prepareMaterials(root, tints);
    const bones = {};
    root.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    const restQuats = {};
    for (const [n, b] of Object.entries(bones)) restQuats[n] = b.quaternion.clone();

    const clipFor = createRetargeter(library, root);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    const playing = { current: null };

    const action = (clipName) => {
      if (!actions[clipName]) actions[clipName] = mixer.clipAction(clipFor(clipName));
      return actions[clipName];
    };

    // Cross-fades to a clip. One-shot clips hold their last frame and resolve the promise.
    const play = (clipName, { fade = 0.35, loop = true, timeScale = 1, from = 0 } = {}) => {
      const next = action(clipName);
      next.enabled = true;
      next.setEffectiveTimeScale(timeScale);
      next.setEffectiveWeight(1);
      if (next !== playing.current || !loop || !next.isRunning()) {
        next.reset();
        next.time = from;
        next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        next.clampWhenFinished = !loop;
        next.play();
        if (playing.current && playing.current !== next) playing.current.crossFadeTo(next, fade, true);
        else next.fadeIn(fade);
      }
      playing.current = next;
      if (loop) return Promise.resolve();
      return new Promise((resolve) => {
        const onFinish = (e) => {
          if (e.action !== next) return;
          mixer.removeEventListener("finished", onFinish);
          resolve();
        };
        mixer.addEventListener("finished", onFinish);
      });
    };

    const setSpeed = (timeScale) => playing.current?.setEffectiveTimeScale(timeScale);
    const duration = (clipName) => clipFor(clipName).duration;
    const currentName = () => playing.current?.getClip().name;
    const clipTime = () => playing.current?.time ?? 0;

    // three's mixer only writes a bone when its animated value changes, so on a still clip
    // any IK or look-at applied last frame would stay and build up. Keep the clean animated
    // pose and put it back before each update; procedural layers then always start fresh.
    const boneList = Object.values(bones);
    const cleanPose = new Float32Array(boneList.length * 7);
    const pose = { saved: false };
    const update = (dt) => {
      if (pose.saved) {
        boneList.forEach((b, i) => {
          b.quaternion.fromArray(cleanPose, i * 7);
          b.position.fromArray(cleanPose, i * 7 + 4);
        });
      }
      mixer.update(dt);
      boneList.forEach((b, i) => {
        b.quaternion.toArray(cleanPose, i * 7);
        b.position.toArray(cleanPose, i * 7 + 4);
      });
      pose.saved = true;
    };

    return { root, bones, restQuats, mixer, update, action, play, setSpeed, duration, currentName, clipTime };
    // Tints are fixed for an actor's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, library, name]);

  useEffect(() => () => actor.mixer.stopAllAction(), [actor]);

  useFrame((_, dt) => actor.update(Math.min(dt, 0.1)));

  return actor;
}

CAST.forEach((name) => useGLTF.preload(modelUrl(name)));
