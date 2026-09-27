// Converts source assets in assets-src/ into small web-ready GLBs in public/models/.
// Run with: npm run assets
//
//   assets-src/humans/*.glb   characters exported by scripts/make_humans.py (MakeHuman, CC0)
//   assets-src/ual1, ual2     Quaternius Universal Animation Library 1 and 2 (CC0)
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, textureCompress, resample, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";

const SRC = "assets-src";
const OUT = "public/models";
fs.mkdirSync(`${OUT}/humans`, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const compress = () => meshopt({ encoder: MeshoptEncoder, level: "high" });
const report = (file) => console.log("wrote", file, (fs.statSync(file).size / 1024).toFixed(0) + " KB");

// The artist is seen close up; everyone else is further away and gets smaller textures.
const TEXTURE_SIZE = { artist: 1024 };

for (const file of fs.readdirSync(`${SRC}/humans`).filter((f) => f.endsWith(".glb"))) {
  const name = file.replace(".glb", "");
  const size = TEXTURE_SIZE[name] ?? 512;
  const doc = await io.read(`${SRC}/humans/${file}`);
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size], quality: 80 }),
    compress()
  );
  await io.write(`${OUT}/humans/${file}`, doc);
  report(`${OUT}/humans/${file}`);
}

if (process.argv.includes("--humans-only")) process.exit(0);

// Animations: keep only the clips the park uses, strip the mannequin mesh.
const KEEP = new Set([
  "Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "PickUp_Table", "Interact",
  "Sitting_Idle_Loop", "Sitting_Talking_Loop", "Walk_Carry_Loop", "OverhandThrow", "Yes",
  "Idle_FoldArms_Loop", "Crouch_Idle_Loop",
]);

async function animDoc(file) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  for (const anim of root.listAnimations()) {
    if (!KEEP.has(anim.getName())) {
      anim.dispose();
      continue;
    }
    for (const channel of anim.listChannels()) {
      if (channel.getTargetPath() === "scale") channel.dispose();
    }
  }
  for (const node of root.listNodes()) {
    if (node.getMesh()) node.setMesh(null);
    if (node.getSkin()) node.setSkin(null);
  }
  for (const mesh of root.listMeshes()) mesh.dispose();
  await doc.transform(resample(), prune(), dedup());
  // Samplers and accessors of the dropped clips/tracks can survive prune(); remove them.
  const used = new Set();
  for (const anim of root.listAnimations()) {
    const live = new Set(anim.listChannels().map((c) => c.getSampler()));
    for (const sampler of anim.listSamplers()) {
      if (!live.has(sampler)) sampler.dispose();
      else used.add(sampler.getInput()).add(sampler.getOutput());
    }
  }
  for (const accessor of root.listAccessors()) if (!used.has(accessor)) accessor.dispose();
  await doc.transform(compress());
  return doc;
}

const libraries = [
  [`${SRC}/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`, `${OUT}/anims-1.glb`],
  [`${SRC}/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb`, `${OUT}/anims-2.glb`],
];
for (const [src, dest] of libraries) {
  await io.write(dest, await animDoc(src));
  report(dest);
}
