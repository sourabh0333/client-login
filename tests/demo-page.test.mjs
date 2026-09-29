import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/page.js", import.meta.url);
const layoutPath = new URL("../src/app/layout.js", import.meta.url);

test("the public page is explicitly a credential-free demo", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /Interactive demo/);
  assert.match(page, /does not collect.*credentials/i);
  assert.doesNotMatch(page, /LoginForm/);
  assert.doesNotMatch(page, /Sign in/);
});

test("page metadata identifies the site as a demo", async () => {
  const [page, layout] = await Promise.all([readFile(pagePath, "utf8"), readFile(layoutPath, "utf8")]);

  assert.match(page, /Client Portal Demo/);
  assert.match(layout, /Client Portal Demo/);
  assert.doesNotMatch(layout, /Sign in to your client account/);
});
