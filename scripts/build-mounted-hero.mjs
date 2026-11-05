/** Slice and align generated clips; no drawing or image-generation API calls.
 * Setup: npm install --prefix output/art-generation/tooling sharp
 * Run: node scripts/build-mounted-hero.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('../output/art-generation/tooling/node_modules/sharp');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.join(ROOT, 'output/art-generation/revisions/mounted-haetae');
const SOURCE = path.join(OUT, 'hero/kkomaMudang/default');
const PUBLIC = path.join(ROOT, 'public/assets/characters');
const LIVE = path.join(ROOT, 'output/art-generation/source-assets/hero/kkomaMudang/default');
const BACKUP = path.join(OUT, 'original-foot-hero');
const JOBS_PATH = path.join(ROOT, 'scripts/mounted-hero-generation.json');
const jobs = JSON.parse(await fs.readFile(JOBS_PATH, 'utf8'));
await fs.mkdir(SOURCE, { recursive: true });
await fs.mkdir(path.join(OUT, 'generated'), { recursive: true });
try { await fs.access(BACKUP); } catch { await fs.cp(LIVE, BACKUP, { recursive: true }); }

// Keep generation inputs in the workspace; generated_images is never a runtime dependency.
for (const job of jobs.jobs) {
  const destination = path.join(OUT, 'generated', `${job.name}.png`);
  if (path.resolve(ROOT, job.source) !== destination) {
    await fs.copyFile(path.resolve(ROOT, job.source), destination);
    job.source = path.relative(ROOT, destination).replaceAll('\\', '/');
  }
}
await fs.writeFile(JOBS_PATH, JSON.stringify(jobs, null, 2) + '\n');
await fs.writeFile(path.join(SOURCE, 'generation-prompt.txt'), jobs.jobs.map(j => `## ${j.name}\n${j.prompt}`).join('\n\n'));

function clean(data, width, height) {
  // Discard faint alpha noise and tiny disconnected specks, preserving the generated artwork.
  const visited = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) if (data[i * 4 + 3] < 24) data.fill(0, i * 4, i * 4 + 4);
  const queue = new Int32Array(width * height);
  for (let i = 0; i < visited.length; i++) {
    if (visited[i] || !data[i * 4 + 3]) continue;
    let size = 1;
    queue[0] = i; visited[i] = 1;
    for (let head = 0; head < size; head++) {
      const p = queue[head], x = p % width;
      for (const n of [x ? p - 1 : -1, x + 1 < width ? p + 1 : -1, p - width, p + width]) {
        if (n >= 0 && n < visited.length && !visited[n] && data[n * 4 + 3]) {
          visited[n] = 1; queue[size++] = n;
        }
      }
    }
    if (size < 48) for (let k = 0; k < size; k++) data.fill(0, queue[k] * 4, queue[k] * 4 + 4);
  }
  let left = width, right = 0, top = height, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] >= 48) {
      left = Math.min(left, x); right = Math.max(right, x + 1);
      top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top) throw Error('Empty generated cell');
  return { data, width, height, box: { left, top, width: right - left, height: bottom - top } };
}

const alignment = [];
async function sheet(name, columns, rows, frames) {
  const job = jobs.jobs.find(j => j.name === name);
  const image = sharp(path.resolve(ROOT, job.source));
  const meta = await image.metadata();
  const cells = [];
  for (let i = 0; i < columns * rows; i++) {
    const col = i % columns, row = Math.floor(i / columns);
    const left = Math.floor(meta.width * col / columns), top = Math.floor(meta.height * row / rows);
    const width = Math.floor(meta.width * (col + 1) / columns) - left;
    const height = Math.floor(meta.height * (row + 1) / rows) - top;
    const { data, info } = await image.clone().extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    cells.push(clean(data, info.width, info.height));
  }
  const widths = cells.map(c => c.box.width).sort((a, b) => a - b);
  // One uniform scale for the whole clip; poses are never individually stretched to fit.
  const scale = Math.min(418 / widths[Math.floor(widths.length / 2)], 416 / Math.max(...cells.map(c => c.box.height)));
  for (let i = 0; i < frames.length; i++) {
    if (!frames[i]) continue;
    const cell = cells[i], b = cell.box;
    const width = Math.round(b.width * scale), height = Math.round(b.height * scale);
    const sprite = await sharp(cell.data, { raw: { width: cell.width, height: cell.height, channels: 4 } })
      .extract(b).resize(width, height).png().toBuffer();
    const left = Math.round(256 - width / 2), top = 448 - height;
    if (left < 16 || top < 16 || left + width > 496) throw Error(`Clipped ${frames[i]}`);
    await sharp({ create: { width: 512, height: 512, channels: 4, background: '#00000000' } })
      .composite([{ input: sprite, left, top }]).png().toFile(path.join(SOURCE, frames[i] + '.png'));
    alignment.push({ frame: frames[i], sheet: name, sourceBox: b, scale, left, top, ground: 448 });
  }
}

await sheet('combat', 4, 2, ['idle_00', 'idle_01', 'attack_00', 'attack_01', 'attack_02', 'attack_03', 'hit_00', 'hit_01']);
await sheet('walk', 2, 2, ['walk_00', 'walk_01', 'walk_02', 'walk_03']);
await sheet('fan', 2, 2, ['skill_fan_00', 'skill_fan_01', 'skill_fan_02', 'skill_fan_03']);
await sheet('blessing', 2, 2, ['skill_blessing_00', null, 'skill_blessing_01', 'skill_blessing_02']);
await sheet('blade', 2, 2, ['skill_blade_00', 'skill_blade_01', 'skill_blade_02', 'skill_blade_03']);
await sheet('death', 2, 2, ['death_00', 'death_01', 'death_02']);

// Spawn is a synchronized alpha reveal of the generated mounted idle, not a new pose.
for (const [i, alpha] of [0.3, 0.7, 1].entries()) {
  const { data, info } = await sharp(path.join(SOURCE, 'idle_00.png')).raw().toBuffer({ resolveWithObject: true });
  for (let p = 3; p < data.length; p += 4) data[p] = Math.round(data[p] * alpha);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(path.join(SOURCE, `spawn_0${i}.png`));
}
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#00000000' } }).png().toFile(path.join(SOURCE, 'death_03.png'));
await fs.copyFile(path.join(SOURCE, 'idle_00.png'), path.join(SOURCE, 'preview.png'));
await sharp(path.resolve(ROOT, jobs.jobs.find(j => j.name === 'icon').source)).resize(128, 128).png().toFile(path.join(SOURCE, 'icon.png'));

const skin = JSON.parse(await fs.readFile(path.join(BACKUP, 'skin.json'), 'utf8'));
Object.assign(skin, {
  document: 'docs/art/default/hero/kkomaMudang-haetae.md', created: '2026-11-05',
  generator: 'built-in image_gen', postprocessing: 'Node sharp: sheet slicing, alpha cleanup, clip-wide scaling, ground alignment, packaging',
  canvas: { width: 512, height: 512 }, origin: { x: 0.5, y: 0.875 },
  bodyBounds: { x: 48, y: 104, width: 416, height: 344 }, displayHeight: 64, displayTop: 78, runtimeLimit: 192,
  reviewStatus: 'generated; aligned and visually reviewed; runtime checks recorded in generation log',
});
delete skin.sourceGrid; delete skin.bodyScale;
for (const [name, clip] of Object.entries(skin.clips)) {
  if (name.startsWith('fx_')) for (const frame of clip.frames) await fs.copyFile(path.join(BACKUP, frame + '.png'), path.join(SOURCE, frame + '.png'));
}
await fs.writeFile(path.join(SOURCE, 'skin.json'), JSON.stringify(skin, null, 2) + '\n');
await fs.writeFile(path.join(OUT, 'alignment.json'), JSON.stringify(alignment, null, 2) + '\n');

// Pack only this hero. All other characters and the existing ally haetae remain byte-for-byte intact.
const images = [];
const names = [...new Set(Object.values(skin.clips).flatMap(c => c.frames)), 'preview', 'icon'].sort();
for (const name of names) {
  const limit = name === 'icon' ? 96 : 192;
  const { data, info } = await sharp(path.join(SOURCE, name + '.png')).resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  images.push({ name, input: data, width: info.width, height: info.height });
}
let x = 2, y = 2, rowHeight = 0;
const frames = {}, composites = [];
for (const im of images) {
  if (x + im.width + 2 > 1024) { x = 2; y += rowHeight + 2; rowHeight = 0; }
  frames[im.name] = { frame: { x, y, w: im.width, h: im.height }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: im.width, h: im.height }, sourceSize: { w: im.width, h: im.height } };
  composites.push({ input: im.input, left: x, top: y });
  x += im.width + 2; rowHeight = Math.max(rowHeight, im.height);
}
const height = y + rowHeight + 2;
if (height > 2048) throw Error('Atlas exceeds texture limit');
const atlasName = 'hero-kkomaMudang-mounted-haetae';
await sharp({ create: { width: 1024, height, channels: 4, background: '#00000000' } }).composite(composites).png().toFile(path.join(PUBLIC, 'runtime', atlasName + '.png'));
await fs.writeFile(path.join(PUBLIC, 'runtime', atlasName + '.json'), JSON.stringify({ frames,
  meta: { image: atlasName + '.png', format: 'RGBA8888', size: { w: 1024, h: height }, scale: '1' } }) + '\n');
const manifest = JSON.parse(await fs.readFile(path.join(PUBLIC, 'manifest.json'), 'utf8'));
const hero = manifest.characters.find(c => c.subjectKey === 'hero:kkomaMudang');
Object.assign(hero, { image: `runtime/${atlasName}.png`, atlas: `runtime/${atlasName}.json`,
  canvas: { width: 192, height: 192 }, bodyHeight: 344 * 192 / 512, bodyWidth: 416 * 192 / 512,
  displayHeight: 64, displayTop: 78, origin: skin.origin, clips: skin.clips });
await fs.writeFile(path.join(PUBLIC, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await fs.cp(SOURCE, LIVE, { recursive: true });

// A transparent animated preview for the same four runtime walking frames.
const gifPages = [];
for (let i = 0; i < 4; i++) gifPages.push(await sharp(path.join(SOURCE, `walk_0${i}.png`)).raw().toBuffer());
await sharp(Buffer.concat(gifPages), { raw: { width: 512, height: 2048, channels: 4, pageHeight: 512 } })
  .gif({ loop: 0, delay: [120, 130, 120, 130] }).toFile(path.join(OUT, 'walk-preview.gif'));
await sharp({ create: { width: 1024, height: 512, channels: 4, background: '#203133' } })
  .composite(await Promise.all([0, 1, 2, 3].map(async i => ({ input: await sharp(path.join(SOURCE, `walk_0${i}.png`)).resize(256, 256).png().toBuffer(), left: i * 256, top: 128 }))))
  .png().toFile(path.join(OUT, 'walk-contact-sheet.png'));
console.log(`Mounted hero: ${names.length} atlas frames, 32 new PNGs, ${1024}x${height} texture, walk preview saved.`);
