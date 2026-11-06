import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Build-time only. Never put procedural pixel rendering in the game loop.
const revision = 'a84159688af3ca37a4be05a0d422b94451b2e24e';
const root = resolve(import.meta.dirname, '..');
const source = resolve(root, process.argv[2] ?? 'output/pixelfx-source');
if (!existsSync(join(source, '.git'))) {
  mkdirSync(resolve(source, '..'), { recursive: true });
  execFileSync('git', ['clone', 'https://github.com/patch-gg/pixelfx.git', source], { stdio: 'inherit' });
  execFileSync('git', ['checkout', revision], { cwd: source, stdio: 'inherit' });
}
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
if (actual !== revision) throw new Error(`Expected pixelfx ${revision}, got ${actual}. Use a separate checkout at the pinned revision.`);
if (execFileSync('git', ['status', '--porcelain', '--', 'src', 'tools'], { cwd: source, encoding: 'utf8' }).trim()) {
  throw new Error('The pixelfx source/tools have local edits. Use a clean checkout for reproducible assets.');
}
const { createFrame, clearFrame, createFx, composite } = await import(pathToFileURL(join(source, 'src/core/index.js')));
const { encodePNG } = await import(pathToFileURL(join(source, 'tools/lib/png.mjs')));

// source start/end trim wind-ups and long tails; duration is game playback time.
// anchor is the effect's contact point, in upstream local coordinates.
const clips = {
  slash: { id: 'melee/sword-slash', start: .055, end: .61, count: 14, duration: .3, anchor: [6, -26], ramp: 'blade' },
  bullet: { id: 'impacts/bullet-impact', start: 0, end: .62, count: 12, duration: .28, anchor: [0, -24], ramp: 'gold' },
  blunt: { id: 'impacts/blunt-hit', start: 0, end: .76, count: 12, duration: .28, anchor: [0, -22], ramp: 'gold' },
  explosion: { id: 'explosions/plasma-explosion', start: .55, end: 1.65, count: 22, duration: .62, anchor: [0, 0], ramp: 'energy' },
  muzzle: { id: 'projectiles/muzzle-pistol', start: 0, end: .28, count: 8, duration: .16, anchor: [0, -26], ramp: 'gold' },
  wind: { id: 'melee/spear-sweep', start: .045, end: .95, count: 18, duration: .48, anchor: [2, -12], ramp: 'wind' },
  heal: { id: 'holy/heal-aoe', start: .31, end: 2.7, count: 28, duration: 1, anchor: [0, 0], ramp: 'heal' },
  blades: { id: 'melee/double-slash', start: .055, end: .75, count: 20, duration: .52, anchor: [24, -25], ramp: 'blade' },
  slam: { id: 'impacts/ground-slam', start: .025, end: 1.7, count: 26, duration: .8, anchor: [0, 0], ramp: 'gold' },
  rune: { id: 'arcane/rune-circle', start: 0, end: 4, count: 32, duration: 4, anchor: [0, 0], ramp: 'heal', loop: true },
  flame: { id: 'fire/spirit-flame', start: 0, end: 3, count: 24, duration: 3, anchor: [0, 0], ramp: 'fire', loop: true },
  stun: { id: 'status/stunned', start: 0, end: 2, count: 24, duration: 2, anchor: [0, -44], ramp: 'gold', loop: true },
  sparkle: { id: 'pickups/collect-burst', start: 0, end: 1.25, count: 20, duration: .7, anchor: [0, -30], ramp: 'heal' },
  poof: { id: 'spawn/poof', start: 0, end: 1.5, count: 20, duration: .65, anchor: [0, -17], ramp: 'smoke' },
};
const ramps = {
  default: {
    blade: ['#202950', '#345582', '#4b8eb3', '#8bd7d0', '#c9eee1', '#ffefc7', '#ffffff'],
    gold: ['#38212a', '#7e4031', '#b96c38', '#e5a657', '#f7d989', '#fff1c7', '#ffffff'],
    energy: ['#271b48', '#493d87', '#7160c1', '#a297ef', '#d0c7ff', '#f4e6ff', '#ffffff'],
    wind: ['#173b39', '#27665a', '#3f9a7e', '#77cfa2', '#c2ebbf', '#f1f8d7', '#ffffff'],
    heal: ['#163e39', '#226b54', '#39a576', '#76d99d', '#b7efbd', '#e5fbd8', '#ffffff'],
    fire: ['#391929', '#78252b', '#b7412b', '#e66c32', '#f6a348', '#ffe593', '#ffffff'],
    smoke: ['#252837', '#485369', '#7b8a9d', '#b5c5ca', '#e1e7df', '#ffffff'],
  },
  military: {
    blade: ['#142f4d', '#24587e', '#328caf', '#62cbd8', '#a4edf1', '#e1fbff', '#ffffff'],
    gold: ['#381f24', '#80422d', '#c57935', '#eda74c', '#ffe18a', '#fff4c9', '#ffffff'],
    energy: ['#152b4c', '#264f82', '#367fc0', '#60b4eb', '#98defb', '#dbf5ff', '#ffffff'],
    wind: ['#153f42', '#246c6a', '#3c9e91', '#6ad6b8', '#acf1d3', '#dfffee', '#ffffff'],
    heal: ['#123b35', '#206b53', '#35a77a', '#65dca9', '#9bf3cb', '#dbffeb', '#ffffff'],
    fire: ['#3e1b23', '#842c29', '#c9492a', '#ed7934', '#ffb957', '#ffecad', '#ffffff'],
    smoke: ['#202838', '#46566e', '#788aa1', '#b3c7d5', '#dfebf1', '#ffffff'],
  },
};
const output = join(root, 'public/assets/effects');
mkdirSync(output, { recursive: true });
mkdirSync(join(root, 'output/pixelfx-previews'), { recursive: true });
const manifest = { revision, seed: 19, clips: {}, pages: [] };
const limit = 2048, padding = 2;
let totalBytes = 0;

for (const skin of ['default', 'military']) {
  const rendered = [], definitions = {};
  for (const [name, config] of Object.entries(clips)) {
    const mod = await import(pathToFileURL(join(source, `src/fx/${config.id}.js`)));
    const margin = 12, w = mod.meta.size[0] + margin * 2, h = mod.meta.size[1] + margin * 2;
    const [ox, oy] = mod.meta.origin.map(v => v + margin);
    const options = { x: ox, y: oy, seed: 19, palette: ramps[skin][config.ramp], light: .7 };
    const fx = createFx(mod, options), frame = createFrame(w, h), zero = new Uint32Array(w * h);
    const frames = [];
    let previous = 0;
    for (let i = 0; i < config.count; i++) {
      const time = config.start + (config.end - config.start) * i / (config.loop ? config.count : config.count - 1);
      fx.update(time - previous); previous = time;
      clearFrame(frame); fx.draw(frame);
      const color = composite({ ...frame, light: zero }, new Uint8ClampedArray(w * h * 4), null);
      const glow = composite({ ...frame, color: zero }, new Uint8ClampedArray(w * h * 4), null);
      // Remove tiny alpha noise; use real transparency and preserve additive light separately.
      for (const data of [color, glow]) for (let j = 0; j < data.length; j += 4) if (data[j + 3] < 3) data.fill(0, j, j + 4);
      frames.push({ color, glow });
    }
    // A common source canvas keeps the pivot stationary, including individually trimmed frames.
    let left = w, top = h, right = 0, bottom = 0;
    for (const pair of frames) for (const data of Object.values(pair)) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      }
    }
    if (right <= left || bottom <= top) throw new Error(`Empty effect ${name}`);
    const width = right - left, height = bottom - top;
    definitions[name] = { duration: config.duration, loop: !!config.loop, width, height,
      origin: [(ox + config.anchor[0] - left) / width, (oy + config.anchor[1] - top) / height], frames: [] };
    frames.forEach((pair, index) => {
      const refs = {};
      for (const [layer, data] of Object.entries(pair)) {
        let x0 = right, y0 = bottom, x1 = left, y1 = top;
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (data[(y * w + x) * 4 + 3]) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
        }
        if (x1 <= x0) { x0 = left; y0 = top; x1 = left + 1; y1 = top + 1; }
        const key = `${name}-${index}-${layer}`;
        refs[layer] = { texture: '', frame: key };
        rendered.push({ key, data, sourceW: w, x0, y0, w: x1 - x0, h: y1 - y0,
          trim: { x: x0 - left, y: y0 - top, w: x1 - x0, h: y1 - y0 }, sourceSize: { w: width, h: height }, ref: refs[layer] });
      }
      definitions[name].frames.push(refs);
    });
    console.log(`${skin}/${name}: ${width}x${height}, ${config.count} frames`);
  }
  // Shelf packing into shared, bounded textures; deterministic ordering.
  rendered.sort((a, b) => b.h - a.h || b.w - a.w || a.key.localeCompare(b.key, 'en'));
  const pages = [];
  let page;
  for (const item of rendered) {
    if (!page) { page = { index: pages.length, x: padding, y: padding, rowH: 0, usedH: 0, items: [] }; pages.push(page); }
    if (page.x + item.w + padding > limit) { page.x = padding; page.y += page.rowH + padding; page.rowH = 0; }
    if (page.y + item.h + padding > limit) {
      page = { index: pages.length, x: padding, y: padding, rowH: 0, usedH: 0, items: [] }; pages.push(page);
    }
    item.x = page.x; item.y = page.y;
    item.ref.texture = `pixelfx-${skin}-${page.index}`;
    page.items.push(item); page.x += item.w + padding; page.rowH = Math.max(page.rowH, item.h); page.usedH = Math.max(page.usedH, item.y + item.h + padding);
  }
  for (const p of pages) {
    const height = 2 ** Math.ceil(Math.log2(p.usedH)), data = new Uint8ClampedArray(limit * height * 4), atlas = {};
    const texture = `pixelfx-${skin}-${p.index}`;
    for (const item of p.items) {
      for (let y = 0; y < item.h; y++) {
        const start = ((item.y0 + y) * item.sourceW + item.x0) * 4;
        data.set(item.data.subarray(start, start + item.w * 4), ((item.y + y) * limit + item.x) * 4);
      }
      atlas[item.key] = { frame: { x: item.x, y: item.y, w: item.w, h: item.h }, rotated: false, trimmed: true,
        spriteSourceSize: item.trim, sourceSize: item.sourceSize };
    }
    const png = encodePNG(limit, height, data);
    writeFileSync(join(output, `${texture}.png`), png); totalBytes += png.length;
    writeFileSync(join(output, `${texture}.json`), JSON.stringify({ frames: atlas, meta: { image: `${texture}.png`, size: { w: limit, h: height }, scale: '1' } }));
    manifest.pages.push({ skin, texture, image: `${texture}.png`, atlas: `${texture}.json`, width: limit, height });
  }
  manifest.clips[skin] = definitions;
}
const metadata = { ...manifest, recipes: clips, palettes: ramps };
writeFileSync(join(output, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
writeFileSync(join(root, 'src/render/pixelfxManifest.ts'),
  '// Generated by scripts/build-pixelfx.mjs. Do not edit.\nimport type { EffectManifest } from \'./effectPlayback\';\nexport const PIXELFX: EffectManifest = ' + JSON.stringify(manifest) + ';\n');
writeFileSync(join(output, 'LICENSE.txt'), readFileSync(join(source, 'LICENSE')));
writeFileSync(join(output, 'NOTICE.txt'), `Generated from https://github.com/patch-gg/pixelfx at ${revision}.\nCode and effects: MIT.\n\n` + readFileSync(join(source, 'NOTICE.md'), 'utf8') + '\nNo gallery fonts or stock character images are distributed.\n');
console.log(`Wrote ${manifest.pages.length} pages, ${(totalBytes / 1024).toFixed(0)} KiB PNG.`);
