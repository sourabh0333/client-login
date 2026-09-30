import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/page.js", import.meta.url);
const layoutPath = new URL("../src/app/layout.js", import.meta.url);
const parkPanelPath = new URL("../src/components/park/park-panel.jsx", import.meta.url);

test("the local page renders the login-form demo", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /import LoginForm/);
  assert.match(page, /<LoginForm/);
  assert.match(page, /Welcome back/);
});

test("local metadata identifies the login preview", async () => {
  const [page, layout] = await Promise.all([readFile(pagePath, "utf8"), readFile(layoutPath, "utf8")]);

  assert.match(page, /title: "Sign in"/);
  assert.match(layout, /title: "Client portal"/);
  assert.match(layout, /Sign in to your client account/);
});

test("the live park remains available on mobile screens", async () => {
  const parkPanel = await readFile(parkPanelPath, "utf8");

  assert.doesNotMatch(parkPanel, /matchMedia\("\(min-width: 900px\)"\)/);
  assert.match(parkPanel, /setOk\(webgl && !motion\.matches\)/);
  assert.match(parkPanel, /getContext\("webgl2"\) \|\| canvas\.getContext\("webgl"\)/);
});
