// Dev helper: captures a burst of frames of the scene (form hidden) and tiles them.
// node scripts/frames.mjs <url> <out.png> <count> <intervalMs> [warmupMs] [cols]
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const [url, out, count = "8", interval = "250", warmup = "12000", cols = "4"] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 700 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
await page.addStyleTag({ content: "#auth-card{display:none} nextjs-portal{display:none}" });
await new Promise((r) => setTimeout(r, Number(warmup)));
const shots = [];
for (let i = 0; i < Number(count); i++) {
  shots.push(await page.screenshot());
  await new Promise((r) => setTimeout(r, Number(interval)));
}
await browser.close();
const w = 450;
const h = 350;
const c = Number(cols);
const rows = Math.ceil(shots.length / c);
const tiles = await Promise.all(shots.map((b) => sharp(b).resize(w, h).toBuffer()));
await sharp({ create: { width: w * c, height: h * rows, channels: 3, background: "#000" } })
  .composite(tiles.map((input, i) => ({ input, left: (i % c) * w, top: Math.floor(i / c) * h })))
  .png()
  .toFile(out);
console.log("done", errors.join("\n"));
