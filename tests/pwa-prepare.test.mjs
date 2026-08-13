import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import test from "node:test";

const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const manifest = await readFile(new URL("../src/app/manifest.ts", import.meta.url), "utf8");

const iconPaths = [
  ["public/icons/ngv-192.png", "/icons/ngv-192.png", 192, 192],
  ["public/icons/ngv-512.png", "/icons/ngv-512.png", 512, 512],
  ["public/icons/ngv-maskable-512.png", "/icons/ngv-maskable-512.png", 512, 512],
  ["src/app/apple-icon.png", "/apple-icon.png", 180, 180],
];

test("PWA metadata preserves the existing app identity and prepares install metadata", () => {
  assert.match(layout, /title:\s*"NGV Digital - Plataforma de Dados"/);
  assert.match(layout, /description:\s*"Painel administrativo da NGV Digital"/);
  assert.match(layout, /applicationName:\s*"NGV Digital"/);
  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest"/);
  assert.match(layout, /icons:\s*\{/);
  assert.match(layout, /url:\s*"\/icons\/ngv-192\.png"/);
  assert.match(layout, /url:\s*"\/icons\/ngv-512\.png"/);
  assert.match(layout, /url:\s*"\/icons\/ngv-maskable-512\.png"/);
  assert.match(layout, /url:\s*"\/apple-icon\.png"/);
  assert.match(layout, /appleWebApp:\s*\{/);
  assert.match(layout, /export const viewport:\s*Viewport/);
  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /initialScale:\s*1/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(layout, /themeColor:\s*"#1048E6"/);
  assert.match(manifest, /MetadataRoute\.Manifest/);
});

test("manifest is standalone and read-only in scope", () => {
  assert.match(manifest, /name:\s*"NGV Digital"/);
  assert.match(manifest, /short_name:\s*"NGV Digital"/);
  assert.match(manifest, /id:\s*"\/dashboard"/);
  assert.match(manifest, /start_url:\s*"\/dashboard"/);
  assert.match(manifest, /scope:\s*"\/"/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /background_color:\s*"#FFFFFF"/);
  assert.match(manifest, /theme_color:\s*"#1048E6"/);
  assert.match(manifest, /lang:\s*"pt-BR"/);
  assert.match(manifest, /orientation:\s*"any"/);
  assert.doesNotMatch(`${layout}\n${manifest}`, /serviceWorker|sw\.js|offline|shortcuts|cache/i);
});

test("manifest declares all install icons and apple icon", async () => {
  for (const [path, publicPath, width, height] of iconPaths) {
    assert.match(`${layout}\n${manifest}`, new RegExp(publicPath.replaceAll("/", "\\/")));
    const metadata = await sharp(fileURLToPath(new URL(`../${path}`, import.meta.url))).metadata();
    assert.equal(metadata.width, width, path);
    assert.equal(metadata.height, height, path);
    assert.equal(metadata.format, "png", path);
  }
  assert.match(manifest, /purpose:\s*"maskable"/);
});
