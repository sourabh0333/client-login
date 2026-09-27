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

// A second place the artist likes to wander to and look at the view.
export const VIEW_SPOT = { position: [0.4, 0, 4.9], facing: -0.35 };

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
];
