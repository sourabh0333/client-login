"use client";

import * as THREE from "three";
import { angleDamp } from "./rig-tools";

const up = new THREE.Vector3(0, 1, 0);

/**
 * Moves an actor over the ground like a person: turns towards where it is going while
 * it starts off, slows for sharp turns and on arrival, and scales the walk cycle with
 * the actual ground speed so the feet don't skate.
 */
export class Mover {
  constructor(actor, { position, heading = 0, gait = { clip: "Walk_Loop", speed: 0.8 }, idle = "Stand" }) {
    this.actor = actor;
    this.position = new THREE.Vector3(...position);
    this.heading = heading;
    this.gait = gait;
    this.idle = idle;
    this.speed = 0;
    this.goal = null;
    this.turnGoal = null;
    this.apply();
  }

  apply() {
    this.actor.root.position.copy(this.position);
    this.actor.root.quaternion.setFromAxisAngle(up, this.heading);
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  walkTo(point, { gait = this.gait, face, arriveClip } = {}) {
    this.gait = gait;
    this.actor.play(gait.clip, { fade: 0.4 });
    return new Promise((resolve) => {
      this.goal = { point: new THREE.Vector3(...point), resolve, face, arriveClip };
    });
  }

  turnTo(heading) {
    return new Promise((resolve) => {
      let diff = heading - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < 0.08) {
        resolve();
        return;
      }
      // Big turns take a couple of small steps; small ones are a shift of weight.
      if (Math.abs(diff) > 0.6) this.actor.play(this.gait.clip, { fade: 0.3, timeScale: 0.55 });
      this.turnGoal = { heading, resolve, stepping: Math.abs(diff) > 0.6 };
    });
  }

  update(dt) {
    if (this.goal) {
      const to = this.goal.point.clone().sub(this.position).setY(0);
      const dist = to.length();
      const desired = Math.atan2(to.x, to.z);
      this.heading = angleDamp(this.heading, desired, dist > 0.3 ? 5 : 2, dt);
      let diff = desired - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const align = THREE.MathUtils.clamp(Math.cos(diff), 0, 1);
      const arrive = THREE.MathUtils.smoothstep(dist, 0.02, 0.7);
      const target = this.gait.speed * (0.25 + 0.75 * align) * Math.max(arrive, 0.25);
      this.speed = THREE.MathUtils.damp(this.speed, target, 3.5, dt);
      const step = Math.min(this.speed * dt, dist);
      this.position.addScaledVector(this.forward, step * Math.max(align, 0.2));
      this.actor.setSpeed(THREE.MathUtils.clamp(this.speed / this.gait.speed, 0.45, 1.25));

      if (dist < 0.06) {
        const goal = this.goal;
        this.goal = null;
        this.speed = 0;
        this.actor.play(goal.arriveClip ?? this.idle, { fade: 0.45 });
        if (goal.face !== undefined) this.turnTo(goal.face).then(goal.resolve);
        else goal.resolve();
      }
    } else if (this.turnGoal) {
      const rate = this.turnGoal.stepping ? 2.2 : 1.6;
      const before = this.heading;
      this.heading = angleDamp(this.heading, this.turnGoal.heading, rate, dt);
      let diff = this.turnGoal.heading - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < 0.03 || Math.abs(this.heading - before) < 1e-4) {
        this.heading = this.turnGoal.heading;
        const goal = this.turnGoal;
        this.turnGoal = null;
        if (goal.stepping) this.actor.play(this.idle, { fade: 0.35 });
        goal.resolve();
      }
    }
    this.apply();
  }
}

/** Attaches a prop to a bone, cancelling the bone's world scale so the prop keeps real size. */
export function attachToBone(bone, object, position = [0, 0, 0], rotation = [0, 0, 0]) {
  bone.updateMatrixWorld(true);
  const s = new THREE.Vector3();
  bone.getWorldScale(s);
  object.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
  object.position.set(position[0] / s.x, position[1] / s.y, position[2] / s.z);
  object.rotation.set(...rotation);
  bone.add(object);
  return object;
}
