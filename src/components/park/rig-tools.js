"use client";

import * as THREE from "three";

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

function setWorldQuaternion(bone, worldQ) {
  bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q2.invert().multiply(worldQ));
  bone.updateMatrixWorld(true);
}

// Rotates `bone` (in world space) by the rotation taking direction `from` to `to`.
function rotateBoneTowards(bone, from, to, weight) {
  const delta = _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  if (weight < 1) delta.slerp(new THREE.Quaternion(), 1 - weight);
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  setWorldQuaternion(bone, delta.multiply(world));
}

/**
 * Analytic two-bone IK (shoulder → elbow → wrist) that reaches `target` (world space),
 * bending the elbow towards `pole`. Blended by `weight` on top of the animated pose.
 */
export function solveArmIK(upper, lower, hand, target, pole, weight = 1) {
  if (weight <= 0.001) return;
  upper.updateMatrixWorld(true);
  const a = upper.getWorldPosition(_a);
  const b = lower.getWorldPosition(_b);
  const c = hand.getWorldPosition(_c);
  const lab = a.distanceTo(b);
  const lcb = b.distanceTo(c);
  const t = _t.copy(target);
  const lat = THREE.MathUtils.clamp(a.distanceTo(t), 0.01, (lab + lcb) * 0.999);

  // Current and desired interior angles at the shoulder and elbow.
  const acab0 = Math.acos(THREE.MathUtils.clamp(c.clone().sub(a).normalize().dot(b.clone().sub(a).normalize()), -1, 1));
  const baBc0 = Math.acos(THREE.MathUtils.clamp(a.clone().sub(b).normalize().dot(c.clone().sub(b).normalize()), -1, 1));
  const acab1 = Math.acos(THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const baBc1 = Math.acos(THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));

  // Bend plane: contains the shoulder, the target and the pole.
  const axis0 = c.clone().sub(a).cross(b.clone().sub(a));
  if (axis0.lengthSq() < 1e-8) axis0.copy(pole.clone().sub(a).cross(t.clone().sub(a)));
  axis0.normalize();

  const upperWorld = upper.getWorldQuaternion(new THREE.Quaternion());
  const lowerWorld = lower.getWorldQuaternion(new THREE.Quaternion());
  const r0 = new THREE.Quaternion().setFromAxisAngle(axis0, acab1 - acab0);
  const r1 = new THREE.Quaternion().setFromAxisAngle(axis0, baBc1 - baBc0);
  const blend = (q) => (weight < 1 ? q.slerp(new THREE.Quaternion(), 1 - weight) : q);
  setWorldQuaternion(upper, blend(r0).multiply(upperWorld));
  setWorldQuaternion(lower, blend(r1).multiply(lowerWorld));

  // Swing the whole chain so the wrist lands on the target, then twist the elbow to the pole.
  const c2 = hand.getWorldPosition(new THREE.Vector3());
  rotateBoneTowards(upper, c2.clone().sub(a), t.clone().sub(a), weight);
  const b2 = lower.getWorldPosition(new THREE.Vector3());
  const c3 = hand.getWorldPosition(new THREE.Vector3());
  const armDir = c3.clone().sub(a).normalize();
  const elbowOff = b2.clone().sub(a).projectOnPlane(armDir);
  const poleOff = pole.clone().sub(a).projectOnPlane(armDir);
  if (elbowOff.lengthSq() > 1e-8 && poleOff.lengthSq() > 1e-8) {
    const twist = new THREE.Quaternion().setFromUnitVectors(elbowOff.normalize(), poleOff.normalize());
    if (weight < 1) twist.slerp(new THREE.Quaternion(), 1 - weight);
    const w = upper.getWorldQuaternion(new THREE.Quaternion());
    setWorldQuaternion(upper, twist.multiply(w));
  }
}

/**
 * Turns the neck and head towards a world point, clamped to a comfortable range
 * and shared between the two bones so it reads as a natural glance.
 */
export function lookAt(neck, head, target, weight = 1, maxYaw = 1.1, maxPitch = 0.55) {
  if (weight <= 0.001) return;
  head.updateMatrixWorld(true);
  const headPos = head.getWorldPosition(new THREE.Vector3());
  // Work in the actor's own frame, where the body faces +Z and +Y is up.
  const facing = rootFacing(neck);
  const local = target.clone().sub(headPos).normalize().applyQuaternion(facing.clone().invert());
  const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -maxYaw, maxYaw) * weight;
  const pitch = THREE.MathUtils.clamp(-Math.asin(THREE.MathUtils.clamp(local.y, -1, 1)), -maxPitch, maxPitch) * weight;

  const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  const worldTurn = facing.clone().multiply(turn).multiply(facing.clone().invert());
  for (const [bone, share] of [
    [neck, 0.4],
    [head, 0.6],
  ]) {
    const part = new THREE.Quaternion().slerp(worldTurn, share);
    const w = bone.getWorldQuaternion(new THREE.Quaternion());
    setWorldQuaternion(bone, part.multiply(w));
  }
}

// The character root's world rotation (its facing), found by walking up to the actor group.
function rootFacing(bone) {
  let o = bone;
  while (o.parent && !o.userData.actorRoot) o = o.parent;
  return o.getWorldQuaternion(new THREE.Quaternion());
}

/**
 * Swings `bone` by `angle` radians so the segment from it to `child` moves towards the
 * world direction `toward`. The axis comes from the geometry itself, so it works the same
 * whatever the rig's bone rolls are. Negative angles swing it away.
 */
export function swingToward(bone, child, toward, angle) {
  if (Math.abs(angle) < 1e-4) return;
  const from = bone.getWorldPosition(new THREE.Vector3());
  const dir = child.getWorldPosition(new THREE.Vector3()).sub(from).normalize();
  const axis = new THREE.Vector3().crossVectors(dir, toward);
  if (axis.lengthSq() < 1e-8) return;
  axis.normalize();
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  setWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(world));
}

const FINGERS = ["index", "middle", "ring", "pinky"];

/**
 * Closes a hand into a grip (0 = as animated, 1 = wrapped round a bar). Each finger joint
 * bends towards the palm side, found from the hand's own geometry.
 */
export function curlHand(bones, side, amount) {
  if (amount <= 0.001) return;
  const hand = bones[`hand_${side}`];
  const index = bones[`index_01_${side}`];
  const pinky = bones[`pinky_01_${side}`];
  if (!hand || !index || !pinky) return;
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const along = index.getWorldPosition(new THREE.Vector3()).add(pinky.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).sub(wrist).normalize();
  const across = pinky.getWorldPosition(new THREE.Vector3()).sub(index.getWorldPosition(new THREE.Vector3())).normalize();
  // Palm normal: for the left hand index→pinky runs the other way round.
  const palm = new THREE.Vector3().crossVectors(along, across).multiplyScalar(side === "l" ? -1 : 1).normalize();
  for (const finger of FINGERS) {
    for (let j = 1; j <= 3; j++) {
      const bone = bones[`${finger}_0${j}_${side}`];
      const next = bones[`${finger}_0${j + 1}_${side}`] ?? bone.children.find((c) => c.isBone);
      if (bone && next) swingToward(bone, next, palm, amount * (j === 1 ? 1.1 : 1.3));
    }
  }
  const thumb = bones[`thumb_02_${side}`];
  const thumbNext = bones[`thumb_03_${side}`];
  if (thumb && thumbNext) swingToward(thumb, thumbNext, palm, amount * 0.6);
}

/** Blends selected bones' current (animated) rotations towards target local rotations. */
export function blendBones(bones, targets, weight) {
  if (weight <= 0.001) return;
  for (const [name, q] of Object.entries(targets)) {
    const b = bones[name];
    if (b) b.quaternion.slerp(q, weight);
  }
}

export const damp = (current, target, lambda, dt) => THREE.MathUtils.damp(current, target, lambda, dt);

export function angleDamp(current, target, lambda, dt) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * (1 - Math.exp(-lambda * dt));
}

export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const chance = (p) => Math.random() < p;

