import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generatePwaIcons } from '../scripts/lib/pwa-icons.mjs';

test('PWA manifest references installable icons and stays within the Pages subpath', () => {
  const manifest = JSON.parse(readFileSync('web/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.display, 'standalone');
  for (const size of [192, 512]) {
    for (const purpose of ['any', 'maskable']) {
      assert.ok(manifest.icons.some(icon =>
        icon.src === './icons/icon-' + size + (purpose === 'maskable' ? '-maskable' : '') + '.png' &&
        icon.sizes === size + 'x' + size &&
        icon.purpose === purpose &&
        icon.type === 'image/png'
      ));
    }
  }
});

test('build icon generator emits valid PNG dimensions for every installation target', () => {
  const dir = mkdtempSync(join(tmpdir(), 'azure-ai-200-pwa-'));
  try {
    generatePwaIcons(dir);
    for (const size of [192, 512]) {
      for (const maskable of ['', '-maskable']) {
        const path = join(dir, 'icons', 'icon-' + size + maskable + '.png');
        const png = readFileSync(path);
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(png.readUInt32BE(16), size);
        assert.equal(png.readUInt32BE(20), size);
      }
    }
    const apple = readFileSync(join(dir, 'apple-touch-icon.png'));
    assert.equal(apple.readUInt32BE(16), 180);
    assert.equal(apple.readUInt32BE(20), 180);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('published HTML and service worker reference generated PWA assets', () => {
  const build = readFileSync('scripts/build-site.mjs', 'utf8');
  const sw = readFileSync('web/sw.js', 'utf8');
  assert.match(build, /generatePwaIcons\(DIST_DIR\)/);
  assert.match(build, /apple-touch-icon\.png/);
  assert.match(build, /data-install-app/);
  assert.match(sw, /icon-192\.png/);
  assert.match(sw, /icon-512-maskable\.png/);
  assert.ok(existsSync('web/favicon.svg'));
});
