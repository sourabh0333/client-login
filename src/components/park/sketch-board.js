"use client";

import * as THREE from "three";
import { mulberry32 } from "./ground";

const W = 512;
const H = 640;
const HORIZON = 372;

// The drawing on the easel. The artist's actions advance it: pencil lines appear while
// they sketch (construction lines first, then shapes, details and hatching, the order
// a person draws in), and watercolour washes go on light to dark after they fetch paint.
export class SketchBoard {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.sheet = 0;
    this.reset();
  }

  reset() {
    this.sheet += 1;
    const rand = mulberry32(this.sheet * 131);
    this.rand = rand;
    paper(this.ctx, rand);
    // The crowns are shared so the paint follows the pencil shapes exactly.
    const crowns = { big: crownClumps(rand, 152, 212, 150, 7), small: crownClumps(rand, 444, 296, 58, 4) };
    this.strokes = buildDrawing(rand, crowns);
    this.strokeIndex = 0;
    this.pointIndex = 0;
    this.washes = buildWashes(rand, crowns);
    this.washIndex = 0;
    this.texture.needsUpdate = true;
  }

  get sketchDone() {
    return this.strokeIndex >= this.strokes.length;
  }

  get paintDone() {
    return this.washIndex >= this.washes.length;
  }

  // Draws roughly `points` more pencil points. Returns the pen position (0..1).
  sketch(points) {
    const ctx = this.ctx;
    let pen = null;
    while (points > 0 && !this.sketchDone) {
      const stroke = this.strokes[this.strokeIndex];
      if (this.pointIndex === 0) this.pointIndex = 1;
      const i = this.pointIndex;
      const a = stroke.points[i - 1];
      const b = stroke.points[i];
      // Pressure rises into the stroke and lifts off at the end.
      const t = i / (stroke.points.length - 1);
      const pressure = Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) * 0.6 + 0.4;
      ctx.strokeStyle = `rgba(58,55,54,${stroke.alpha * pressure})`;
      ctx.lineWidth = stroke.width * (0.7 + 0.5 * pressure);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      // Graphite catches on the paper's tooth.
      if (this.rand() < 0.35) {
        ctx.fillStyle = `rgba(40,38,38,${0.12 * pressure})`;
        ctx.fillRect(b[0] + (this.rand() - 0.5) * 2, b[1] + (this.rand() - 0.5) * 2, 1, 1);
      }
      pen = [b[0] / W, b[1] / H];
      this.pointIndex++;
      points--;
      if (this.pointIndex >= stroke.points.length) {
        this.strokeIndex++;
        this.pointIndex = 0;
      }
    }
    this.texture.needsUpdate = true;
    return pen;
  }

  // Lays down roughly `dabs` more watercolour dabs. Returns the brush position (0..1).
  paint(dabs) {
    const ctx = this.ctx;
    let brush = null;
    while (dabs > 0 && !this.paintDone) {
      const wash = this.washes[this.washIndex];
      const [x, y, r] = wash.dabs[wash.done];
      ctx.save();
      ctx.clip(wash.region);
      ctx.globalCompositeOperation = "multiply";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(wash.color, wash.strength));
      g.addColorStop(0.7, rgba(wash.color, wash.strength * 0.7));
      g.addColorStop(1, rgba(wash.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      brush = [x / W, y / H];
      wash.done++;
      dabs--;
      if (wash.done >= wash.dabs.length) {
        // Shapes made of several overlapping parts would show their seams, so no rim there.
        if (wash.edge) wetEdge(ctx, wash);
        this.washIndex++;
      }
    }
    this.texture.needsUpdate = true;
    return brush;
  }

  dispose() {
    this.texture.dispose();
  }
}

const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

// Cold-press paper: warm white with a fine tooth.
function paper(ctx, rand) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#f5f0e4";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const v = rand();
    ctx.fillStyle = v < 0.5 ? `rgba(120,108,88,${rand() * 0.06})` : `rgba(255,255,250,${rand() * 0.08})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand(), 1 + rand());
  }
}

// When a wash dries, pigment gathers at its edge: a thin darker rim, slightly blurred.
function wetEdge(ctx, wash) {
  ctx.save();
  ctx.clip(wash.region);
  ctx.globalCompositeOperation = "multiply";
  ctx.filter = "blur(1.5px)";
  ctx.strokeStyle = rgba(wash.color, wash.strength * 2.2);
  ctx.lineWidth = 3;
  ctx.stroke(wash.region);
  ctx.restore();
  ctx.filter = "none";
}

// ---------------------------------------------------------------------------------------
// The pencil drawing: a landscape study of the park — a big tree, the swing set with a
// child on it, the path, the lawn and the hedges beyond.

// The big tree's crown is a cluster of overlapping leaf masses (clumps), not one outline.
function crownClumps(rand, cx, cy, spread, count) {
  const clumps = [{ cx, cy, rx: spread * 0.55, ry: spread * 0.42 }];
  for (let i = 1; i < count; i++) {
    const a = (i / (count - 1)) * Math.PI * 2 + rand() * 0.6;
    const d = spread * (0.42 + rand() * 0.2);
    clumps.push({
      cx: cx + Math.cos(a) * d,
      cy: cy + Math.sin(a) * d * 0.62 - spread * 0.05,
      rx: spread * (0.3 + rand() * 0.14),
      ry: spread * (0.24 + rand() * 0.1),
    });
  }
  return clumps;
}

const inside = (clumps, x, y, except) =>
  clumps.some((c, i) => i !== except && ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2 < 0.92);

function buildDrawing(rand, crowns) {
  const strokes = [];
  const jitter = (v, a) => v + (rand() - 0.5) * a;
  const line = (pts, { width = 1.6, alpha = 0.75, wobble = 1.2, step = 5 } = {}) => {
    const points = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let s = i === 0 ? 0 : 1; s <= n; s++) {
        const t = s / n;
        points.push([jitter(x0 + (x1 - x0) * t, wobble), jitter(y0 + (y1 - y0) * t, wobble)]);
      }
    }
    if (points.length > 1) strokes.push({ points, width, alpha });
  };
  const curve = (fn, n, opts) => line(Array.from({ length: n + 1 }, (_, i) => fn(i / n)), opts);

  // A leaf mark: a tiny hooked flick, the unit of texture in the foliage.
  const leaf = (x, y, s, alpha) => {
    const a = rand() * Math.PI * 2;
    const c = Math.cos(a);
    const d = Math.sin(a);
    line(
      [
        [x - c * s, y - d * s],
        [x + (rand() - 0.5) * s * 0.8, y + (rand() - 0.5) * s * 0.8],
        [x + c * s, y + d * s * 0.6],
      ],
      { width: 1, alpha, wobble: 0.6, step: 3 }
    );
  };

  // Crown: a broken, leafy silhouette (only where no other clump covers it), then leaf
  // marks that thicken towards each clump's shaded underside.
  const drawCrown = (clumps, marks, shadeAngle) => {
    clumps.forEach((c, ci) => {
      let run = [];
      const flush = () => {
        if (run.length > 2) line(run, { width: 1.3, alpha: 0.6, wobble: 2.4, step: 3 });
        run = [];
      };
      const n = Math.round((c.rx + c.ry) / 3);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const jag = 1 + (i % 2 ? 0.06 : -0.03) + (rand() - 0.5) * 0.08;
        const x = c.cx + Math.cos(a) * c.rx * jag;
        const y = c.cy + Math.sin(a) * c.ry * jag;
        if (inside(clumps, x, y, ci) || rand() < 0.06) flush();
        else run.push([x, y]);
      }
      flush();
    });
    const sx = Math.cos(shadeAngle);
    const sy = Math.sin(shadeAngle);
    for (let k = 0; k < marks; k++) {
      const c = clumps[Math.floor(rand() * clumps.length)];
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      const x = c.cx + Math.cos(a) * c.rx * r * 0.95;
      const y = c.cy + Math.sin(a) * c.ry * r * 0.95;
      // More marks, and darker, on the side facing away from the light.
      const shade = (Math.cos(a) * sx + Math.sin(a) * sy) * r;
      if (rand() > 0.35 + shade * 0.6) continue;
      leaf(x, y, 3 + rand() * 3, 0.3 + Math.max(0, shade) * 0.35);
    }
  };

  // Hatching inside an ellipse: slightly curved strokes of varying length.
  const hatch = (cx, cy, rx, ry, angle, spacing, alpha = 0.32) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let o = -Math.max(rx, ry); o < Math.max(rx, ry); o += spacing * (0.8 + rand() * 0.4)) {
      const pts = [];
      for (let t = -1.2; t <= 1.2; t += 0.05) {
        const x = cx - dy * o + dx * t * rx;
        const y = cy + dx * o + dy * t * ry;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pts.push([x, y]);
      }
      if (pts.length < 3) continue;
      const trim = Math.floor(rand() * pts.length * 0.2);
      const a = pts[trim];
      const b = pts[pts.length - 1 - Math.floor(rand() * pts.length * 0.2)];
      const mid = [(a[0] + b[0]) / 2 + (rand() - 0.5) * 3, (a[1] + b[1]) / 2 + (rand() - 0.5) * 3];
      line([a, mid, b], { width: 0.9, alpha, wobble: 0.6, step: 4 });
    }
  };

  // 1. Light construction: horizon and the path's curving edges.
  line([[16, HORIZON], [496, HORIZON - 5]], { width: 0.9, alpha: 0.3, wobble: 0.6, step: 8 });
  curve((t) => [150 + t * 150 + Math.sin(t * 3.2) * 36, 636 - t * 262], 22, { width: 1.1, alpha: 0.45, wobble: 1.6 });
  curve((t) => [318 + t * 34 + Math.sin(t * 3.2) * 26, 636 - t * 264], 22, { width: 1.1, alpha: 0.45, wobble: 1.6 });

  // 2. Distant hedges: a scribbled band of rounded shrubs.
  let hx = 16;
  while (hx < 496) {
    const w = 26 + rand() * 30;
    const h = 12 + rand() * 12;
    const base = HORIZON - 1 - ((hx - 16) / 480) * 5;
    curve((t) => [hx + t * w, base - Math.sin(t * Math.PI) * h * (0.85 + rand() * 0.3)], 10, { width: 1.1, alpha: 0.5, wobble: 1.8, step: 3 });
    for (let k = 0; k < 3; k++) leaf(hx + rand() * w, base - rand() * h * 0.7, 3, 0.3);
    hx += w * (0.8 + rand() * 0.15);
  }

  // 3. The big tree: tapering, slightly leaning trunk with root flare and limbs.
  const trunkL = [[124, 506], [134, 470], [138, 420], [140, 360], [138, 318]];
  const trunkR = [[172, 508], [164, 472], [160, 420], [160, 360], [164, 318]];
  line(trunkL, { width: 2.1, alpha: 0.8 });
  line(trunkR, { width: 2.1, alpha: 0.8 });
  line([[124, 506], [110, 512]], { width: 1.6 });
  line([[172, 508], [188, 513]], { width: 1.6 });
  line([[140, 330], [110, 282], [82, 262]], { width: 1.7 });
  line([[160, 326], [192, 280], [226, 258]], { width: 1.7 });
  line([[150, 322], [150, 250]], { width: 1.5 });
  line([[112, 284], [100, 250]], { width: 1.1, alpha: 0.6 });
  line([[194, 278], [210, 244]], { width: 1.1, alpha: 0.6 });
  for (let k = 0; k < 16; k++) {
    // Bark: short vertical marks, denser on the shaded right side.
    const t = rand();
    const y = 330 + t * 170;
    const x = 142 + rand() * 18 + (rand() < 0.6 ? 6 : 0);
    line([[x, y], [x + (rand() - 0.5) * 2, y + 6 + rand() * 8]], { width: 0.9, alpha: 0.45, wobble: 0.4, step: 3 });
  }
  drawCrown(crowns.big, 380, 0.9);

  // 4. A smaller tree further off, right.
  line([[440, HORIZON - 4], [442, 322]], { width: 1.4, alpha: 0.65 });
  line([[449, HORIZON - 4], [447, 322]], { width: 1.4, alpha: 0.65 });
  drawCrown(crowns.small, 70, 0.9);

  // 5. The swing set, with a child on the swing.
  line([[292, 470], [330, 302]], { width: 1.8 });
  line([[350, 470], [330, 302]], { width: 1.8 });
  line([[398, 458], [426, 304]], { width: 1.8 });
  line([[452, 456], [426, 304]], { width: 1.8 });
  line([[324, 303], [434, 300]], { width: 2.1 });
  line([[362, 303], [357, 416]], { width: 0.9, alpha: 0.55, step: 6 });
  line([[392, 302], [398, 416]], { width: 0.9, alpha: 0.55, step: 6 });
  line([[350, 418], [405, 418]], { width: 2.3 });
  // Child: head with hair, body, arms up to the chains, legs swinging forward.
  curve((t) => [377 + Math.cos(t * Math.PI * 2) * 9, 371 + Math.sin(t * Math.PI * 2) * 10], 18, { width: 1.3, wobble: 0.6 });
  curve((t) => [369 + t * 16, 366 - Math.sin(t * Math.PI) * 7], 8, { width: 1.8, alpha: 0.7, wobble: 0.6 });
  curve((t) => [370 + Math.sin(t * Math.PI) * -3, 382 + t * 34], 8, { width: 1.4, wobble: 0.5 });
  curve((t) => [385 + Math.sin(t * Math.PI) * 3, 382 + t * 34], 8, { width: 1.4, wobble: 0.5 });
  line([[371, 388], [362, 392], [358, 378]], { width: 1.2 });
  line([[384, 388], [393, 392], [396, 378]], { width: 1.2 });
  line([[372, 416], [394, 428], [404, 444]], { width: 1.4 });
  line([[383, 416], [402, 426], [414, 440]], { width: 1.4 });

  // 6. Lawn: tufts in the foreground, smaller and sparser with distance.
  for (let i = 0; i < 80; i++) {
    const y = HORIZON + 16 + Math.pow(rand(), 0.6) * 246;
    const x = 16 + rand() * 480;
    const tp = (636 - y) / 262;
    const left = 150 + tp * 150 + Math.sin(tp * 3.2) * 36;
    const right = 318 + tp * 34 + Math.sin(tp * 3.2) * 26;
    if (x > left - 6 && x < right + 6) continue;
    const s = 0.35 + ((y - HORIZON) / 260) * 1.1;
    for (let b = 0; b < 3; b++) {
      const bx = x + b * 3 * s;
      line([[bx, y], [bx + (b - 1) * 2 * s, y - (6 + rand() * 5) * s]], { width: 0.9, alpha: 0.45, wobble: 0.4, step: 3 });
    }
  }

  // 7. Shading: the trunk's shadow side and cast shadows on the lawn.
  hatch(158, 420, 7, 90, 1.5, 4, 0.34);
  hatch(172, 514, 78, 11, 0.06, 4.5, 0.26);
  hatch(372, 466, 66, 7, 0.04, 4.5, 0.22);

  return strokes;
}

// ---------------------------------------------------------------------------------------
// Watercolour: regions (so each wash stays in its area), colours, dab counts. Light first.

function blobPath(clumps, grow = 1.04) {
  const p = new Path2D();
  for (const c of clumps) p.ellipse(c.cx, c.cy, c.rx * grow, c.ry * grow, 0, 0, Math.PI * 2);
  return p;
}

function polyPath(points) {
  const p = new Path2D();
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  return p;
}

function buildWashes(rand, crowns) {
  const crown = blobPath(crowns.big);
  const small = blobPath(crowns.small);
  const dabsIn = (x0, y0, x1, y1, count, size) =>
    Array.from({ length: count }, () => [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), size * (0.7 + rand() * 0.6)]);
  const wash = (region, color, strength, dabs, edge = true) => ({ region, color, strength, dabs, edge, done: 0 });

  const sky = polyPath([[0, 0], [W, 0], [W, HORIZON - 5], [0, HORIZON]]);
  const lawn = polyPath([[0, HORIZON], [W, HORIZON - 5], [W, H], [0, H]]);
  const pathPts = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    pathPts.push([150 + t * 150 + Math.sin(t * 3.2) * 36, 636 - t * 262]);
  }
  for (let i = 22; i >= 0; i--) {
    const t = i / 22;
    pathPts.push([318 + t * 34 + Math.sin(t * 3.2) * 26, 636 - t * 264]);
  }
  const path = polyPath(pathPts);
  const hedges = new Path2D();
  for (let x = 10; x < W; x += 34) hedges.ellipse(x + 17, HORIZON - 10, 24, 16, 0, 0, Math.PI * 2);
  const trunk = polyPath([[122, 508], [134, 470], [140, 360], [138, 316], [164, 316], [160, 420], [164, 472], [174, 510]]);
  const shadow = new Path2D();
  shadow.ellipse(172, 514, 84, 15, 0, 0, Math.PI * 2);
  const shirt = new Path2D();
  shirt.ellipse(377, 400, 8, 14, 0, 0, Math.PI * 2);

  return [
    // Sky: graded, bluer at the top, a few soft clouds left as paper.
    wash(sky, [160, 195, 225], 0.09, dabsIn(0, 0, W, HORIZON, 60, 70)),
    wash(sky, [110, 155, 210], 0.08, dabsIn(0, 0, W, HORIZON * 0.4, 30, 66)),
    wash(lawn, [175, 195, 105], 0.11, dabsIn(0, HORIZON, W, H, 70, 60)),
    wash(path, [220, 196, 158], 0.12, dabsIn(140, 370, 380, 640, 28, 40)),
    wash(hedges, [85, 120, 90], 0.14, dabsIn(0, HORIZON - 30, W, HORIZON + 4, 30, 24), false),
    wash(crown, [130, 170, 85], 0.13, dabsIn(20, 100, 290, 320, 70, 44), false),
    wash(small, [115, 155, 90], 0.13, dabsIn(390, 250, 500, 340, 14, 26), false),
    wash(trunk, [120, 92, 70], 0.2, dabsIn(122, 316, 174, 510, 16, 16)),
    // Second glazes: depth in the foliage and lawn, then cast shadows and the child.
    wash(crown, [70, 110, 62], 0.12, dabsIn(110, 220, 290, 320, 34, 32), false),
    wash(lawn, [125, 160, 75], 0.09, dabsIn(0, 520, W, H, 26, 50)),
    wash(shadow, [85, 105, 75], 0.13, dabsIn(90, 500, 256, 530, 14, 22), false),
    wash(shirt, [205, 85, 72], 0.24, dabsIn(370, 386, 384, 414, 8, 7), false),
  ];
}
