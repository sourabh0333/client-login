// Dev helper: screenshots a page with the local Chrome (GPU on) after it has run a while.
// node scripts/shot.mjs <url> <out.png> [waitMs] [width] [height] [shots] [intervalMs]
import puppeteer from "puppeteer-core";

const [url, out, wait = "12000", width = "1280", height = "800", shots = "1", interval = "3000"] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: Number(width), height: Number(height), deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => {
  if (["error", "warn"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
await new Promise((r) => setTimeout(r, Number(wait)));
for (let i = 0; i < Number(shots); i++) {
  const file = Number(shots) > 1 ? out.replace(".png", `-${i}.png`) : out;
  await page.screenshot({ path: file });
  if (i < Number(shots) - 1) await new Promise((r) => setTimeout(r, Number(interval)));
}
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => {
        n++;
        if (performance.now() - t0 < 2000) requestAnimationFrame(f);
        else resolve(n / 2);
      };
      requestAnimationFrame(f);
    })
);
console.log("fps", fps);
console.log(logs.slice(-15).join("\n"));
await browser.close();
