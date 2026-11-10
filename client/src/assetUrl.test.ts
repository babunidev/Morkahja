import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assetUrl, PUBLIC_BASE_PATH, withBasePath } from './assetUrl.js';

// Production subpath (https://www.babuni.dev/Morkahja/).
assert.equal(withBasePath('/Morkahja/', '/UI/09_GAME/im_gems.webp'), '/Morkahja/UI/09_GAME/im_gems.webp');
assert.equal(withBasePath('/Morkahja/', '/game/encounterimages'), '/Morkahja/game/encounterimages');
assert.equal(withBasePath('/Morkahja/', 'UI/04_ACHIEVEMENTS/im_glyph_helper.webp'), '/Morkahja/UI/04_ACHIEVEMENTS/im_glyph_helper.webp');
assert.equal(withBasePath('/Morkahja', '/UI/SFX/sfx_levelup.mp3'), '/Morkahja/UI/SFX/sfx_levelup.mp3');
assert.equal(withBasePath('Morkahja/', '/UI/SFX/sfx_levelup.mp3'), '/Morkahja/UI/SFX/sfx_levelup.mp3');

// Idempotent: an already-prefixed path is not prefixed twice.
const once = withBasePath('/Morkahja/', '/UI/Music/menu_ambient_a.mp3');
assert.equal(withBasePath('/Morkahja/', once), once);

// Root deployment / local development: paths are unchanged.
assert.equal(withBasePath('/', '/UI/09_GAME/im_gems.webp'), '/UI/09_GAME/im_gems.webp');
assert.equal(withBasePath(undefined, '/UI/09_GAME/im_gems.webp'), '/UI/09_GAME/im_gems.webp');
assert.equal(withBasePath('', '/UI/09_GAME/im_gems.webp'), '/UI/09_GAME/im_gems.webp');

// Absolute and inline URLs are never rewritten.
for (const url of [
  'https://checkout.stripe.com/c/pay/cs_test',
  'http://localhost:3000/health',
  '//cdn.example.com/a.webp',
  'data:image/png;base64,AAAA',
  'blob:https://www.babuni.dev/0b8f',
]) {
  assert.equal(withBasePath('/Morkahja/', url), url);
}
assert.equal(withBasePath('/Morkahja/', ''), '');

// Under tsx there is no Vite env, so the runtime helper falls back to `/`.
assert.equal(PUBLIC_BASE_PATH, '/');
assert.equal(assetUrl('/UI/x.webp'), '/UI/x.webp');

// The PWA manifest must stay relative so start_url/scope resolve below the
// directory it is served from: /Morkahja/manifest.webmanifest -> /Morkahja/.
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(path.join(clientDir, 'public', 'manifest.webmanifest'), 'utf8'),
) as { start_url: string; scope: string; icons: Array<{ src: string }> };
const manifestUrl = 'https://www.babuni.dev/Morkahja/manifest.webmanifest';
assert.equal(new URL(manifest.start_url, manifestUrl).href, 'https://www.babuni.dev/Morkahja/');
assert.equal(new URL(manifest.scope, manifestUrl).href, 'https://www.babuni.dev/Morkahja/');
for (const icon of manifest.icons) {
  assert.ok(
    new URL(icon.src, manifestUrl).href.startsWith('https://www.babuni.dev/Morkahja/'),
    `manifest icon escapes the game scope: ${icon.src}`,
  );
}

// Regression guard: client source must not hard-code root-relative public
// asset paths without routing them through assetUrl(), or they would load from
// the main website's root instead of /Morkahja/.
const srcDir = path.join(clientDir, 'src');
const rawAssetLiteral = /(['"`])\/(?:UI|game)\//g;
const offenders: string[] = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|css)$/.test(entry) || entry.endsWith('.test.ts') || entry === 'assetUrl.ts') {
      continue;
    }

    const source = readFileSync(fullPath, 'utf8');
    for (const match of source.matchAll(rawAssetLiteral)) {
      const before = source.slice(Math.max(0, match.index - 'assetUrl('.length), match.index);
      // CSS url('/...') is rewritten with the base by Vite at build time.
      const isCssUrl = entry.endsWith('.css') && before.endsWith('url(');
      if (before !== 'assetUrl(' && !isCssUrl) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${path.relative(clientDir, fullPath)}:${line}`);
      }
    }
  }
}

walk(srcDir);
assert.deepEqual(offenders, [], `Unwrapped root-relative asset paths:\n${offenders.join('\n')}`);

console.log('assetUrl tests passed');
