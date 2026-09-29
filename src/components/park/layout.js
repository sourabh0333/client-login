// Where everything stands in the park (metres; +z towards the camera, y up).
// Props and the characters' routes both read from here so they always line up.

export const CAMERA = { position: [0.4, 1.5, 9.4], target: [0.0, 1.0, 0.0], fov: 40 };

// The easel's sheet faces towards the front-left, so the artist works in profile to the camera.
export const EASEL = { position: [1.55, 0, 3.05], rotation: -0.93 };
// Where the artist stands to work at the easel, and the direction they face.
export const EASEL_SPOT = { position: [1.2, 0, 3.32], facing: 2.214 };
// A step back from the easel to look at the drawing.
export const EASEL_BACK = { position: [0.78, 0, 3.66], facing: 2.214 };

export const TABLE = { position: [-1.35, 0, 2.6], rotation: 0.25 };
export const TABLE_SPOT = { position: [-1.2, 0, 3.25], facing: Math.PI + 0.25 };

// A second place the artist likes to wander to and look at the view (clear of the onlookers).
export const VIEW_SPOT = { position: [1.8, 0, 5.1], facing: -0.35 };

// Two passers-by watching the artist from behind her, looking over her shoulder at the sheet.
const toEasel = (x, z) => Math.atan2(EASEL.position[0] - x, EASEL.position[2] - z);
export const ONLOOKERS = [
  { name: "onlooker_a", position: [-0.45, 0, 3.72], facing: toEasel(-0.45, 3.72) },
  { name: "onlooker_b", position: [-0.02, 0, 4.2], facing: toEasel(-0.02, 4.2) },
];

export const SWINGS = { position: [-3.4, 0, -3.6], rotation: 1.25 };
export const SLIDE = { position: [-5.4, 0, -8.5], rotation: 0.6 };
export const BENCH = { position: [-0.6, 0, -0.6], rotation: -2.39 };

export const BALL_A = { position: [3.0, 0, -1.6] };
export const BALL_B = { position: [4.6, 0, -4.6] };

// Loop the two chasing children run around (behind the artist, in front of the swings).
export const CHASE_LOOP = [
  [-0.8, 0, -1.9],
  [1.2, 0, -2.4],
  [1.8, 0, -4.4],
  [1.0, 0, -7.2],
  [-0.8, 0, -7.4],
  [-1.5, 0, -4.6],
];

// The gravel path: a gentle S from the front left to the back right.
export const PATH = [
  [-6.5, 9.0],
  [-3.6, 6.4],
  [-0.9, 5.9],
  [1.0, 4.3],
  [1.2, 1.6],
  [2.4, -1.0],
  [5.0, -2.2],
  [8.0, -4.8],
  [11.0, -9.0],
];
export const PATH_WIDTH = 1.35;

export const TREES = [
  { position: [-8.2, 0, -4.5], scale: 1.25, seed: 1 },
  { position: [-9.5, 0, 1.5], scale: 1.4, seed: 2 },
  { position: [-7.5, 0, -12.5], scale: 1.5, seed: 3 },
  { position: [8.6, 0, -2.6], scale: 1.2, seed: 4 },
  { position: [9.8, 0, -7.5], scale: 1.6, seed: 5 },
  { position: [2.5, 0, -18.5], scale: 1.7, seed: 6 },
  { position: [-2.8, 0, -20.5], scale: 1.6, seed: 7 },
  { position: [8.2, 0, -16.5], scale: 1.5, seed: 8 },
  { position: [-11.5, 0, -8.5], scale: 1.6, seed: 9 },
  { position: [7.8, 0, 3.4], scale: 1.05, seed: 10 },
  { position: [-12.5, 0, 6.5], scale: 1.5, seed: 11 },
  // A fuller line of trees across the back of the park…
  { position: [-6.2, 0, -15.8], scale: 1.45, seed: 12 },
  { position: [-10.4, 0, -14.6], scale: 1.55, seed: 13 },
  { position: [5.6, 0, -14.2], scale: 1.4, seed: 14 },
  { position: [12.2, 0, -12.4], scale: 1.6, seed: 15 },
  { position: [-14.4, 0, -12.2], scale: 1.5, seed: 16 },
  { position: [0.2, 0, -15.6], scale: 1.35, seed: 17 },
  // …and more beyond the hedges, their crowns showing above them.
  { position: [-12.0, 0, -27.0], scale: 1.8, seed: 18 },
  { position: [-4.2, 0, -28.5], scale: 1.9, seed: 19 },
  { position: [3.4, 0, -27.2], scale: 1.75, seed: 20 },
  { position: [10.2, 0, -26.0], scale: 1.85, seed: 21 },
  { position: [16.4, 0, -23.5], scale: 1.7, seed: 22 },
  { position: [-18.5, 0, -22.0], scale: 1.8, seed: 23 },
];
