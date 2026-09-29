# Client login

A Next.js login page with a live 3D park on the right: a girl sketching and painting at an easel, children on the swings, playing catch and playing tag, and a parent watching from a bench. Everything is rendered in the browser with Three.js (React Three Fiber). There is no video.

```bash
npm install
npm run dev
```
hi

Open http://localhost:3000.

## Exploring the park

The page is split 30 / 70: sign-in on the left, the park on the right.

| Input | Does |
| --- | --- |
| Move the mouse | The view glances towards the cursor |
| Drag | Look around |
| Scroll, or + / − (also the on-screen buttons) | Zoom |
| W A S D or arrow keys | Move through the park |
| Q / E | Turn |
| Click a group of people | Follow them (caption says what they are doing) |
| R, Esc, or the reset button | Back to the starting view |

Effects: the page opens with a short fly-in from an aerial shot; a glowing ring marks the people under the cursor (pulsing) or being followed (steady); the hint bar lights up the control in use. Keys are ignored while typing in the form. Movement is kept inside the park and eases smoothly. The camera controller is `src/components/park/camera-rig.jsx`; hover and caption logic is `src/components/park/focus.jsx`.

## How the park works

| Piece | Where |
| --- | --- |
| Page layout, form | `src/app/page.js`, `src/components/login-form.jsx` |
| Scene loader (poster first, 3D after load, still image for reduced motion / phones) | `src/components/park/park-panel.jsx` |
| Scene, camera, light | `src/components/park/park-scene.jsx` |
| Ground, grass, trees, sky, props | `ground.jsx`, `trees.jsx`, `sky.jsx`, `props.jsx` |
| Positions of everything | `src/components/park/layout.js` |
| Characters and retargeting | `use-actor.js`, `clips.js`, `rig-tools.js`, `mover.js` |
| Behaviour | `src/components/park/actors/*.jsx` |
| The drawing on the easel | `sketch-board.js` |

- **Characters** are MakeHuman people generated in Blender with the MPFB add-on (`scripts/make_humans.py`): real child proportions, clothes, hair and a game-engine rig.
- **Motion** comes from the Quaternius Universal Animation Library (motion capture style clips). `clips.js` retargets it onto each character in world space, so different rest poses and bone rolls still line up.
- **Procedural layers** on top of the clips: arm IK (the artist's hand follows the actual pencil lines as they're drawn; catchers reach for the ball; the swinger holds the chains), head look-at, a real pendulum for the swing and a ballistic arc for the ball.
- The artist's routine loops without repeating: sketching, stepping back, wandering, fetching paint, painting and starting a new sheet.

## Rebuilding the assets

The large source files are not committed (`/assets-src`, `/tools`). To regenerate `public/models`:

1. Blender 4.5 LTS (portable zip) in `tools/`, with the MPFB 2 extension installed.
2. MakeHuman CC0 asset packs (system assets, shirts01, pants01, shoes01, dress01, skirts01) unzipped into MPFB's user data folder.
3. Quaternius Universal Animation Library 1 and 2 (Standard, free) unzipped into `assets-src/ual1` and `assets-src/ual2`.

```bash
tools/blender-4.5.14-windows-x64/blender.exe --background --python scripts/make_humans.py
```

```bash
npm run assets
```

## Dev helpers (not available in production builds)

- `/lab?clip=Walk_Loop&who=artist,parent` previews characters and clips.
- `/?cam=x,y,z,tx,ty,tz` overrides the camera; `/?stage=paint` skips ahead to painting.
- `node scripts/shot.mjs <url> <out.png>` screenshots the page with local Chrome.

## Licences

- MakeHuman base mesh, skins, hair and the clothes packs used: CC0.
- MPFB (Blender add-on used at build time only): GPL-3.0; it is not shipped with the site.
- Quaternius Universal Animation Library: CC0.
- Three.js, React Three Fiber, drei: MIT.

## To do before going live

- Connect the form to your real authentication service (`src/components/login-form.jsx`, marked in `submit`).
- Replace "Client portal" and the leaf mark with your brand.
