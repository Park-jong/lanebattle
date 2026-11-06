"""Package image_gen whole-character poses for the Shion 2dimg2motion pilot.

No motion is synthesized: only alpha cleanup, cell splitting, one shared scale,
translation, previews and atlas packing. Existing non-attack frames are retained.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import shutil

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REV = ROOT / 'output/art-generation/revisions/shion-2dimg2motion-attack'
OLD = ROOT / 'output/art-generation/revisions/shion-electromagnetic-v2/package'
PUBLIC = ROOT / 'public/assets/characters'
KEY = 'hero-kkomaMudang-military-motion-v1'
PREFIX = 'shion-attack'
KEYS = [2, 5, 8, 11]


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def clean(image):
    a = np.array(image.convert('RGBA'))
    a[a[:, :, 3] < 12] = 0  # Generator's invisible alpha=1 RGB fringe; no repainting.
    return Image.fromarray(a)


def landmarks(image):
    a = np.asarray(image).astype(np.int16)
    r, g, b, alpha = (a[:, :, n] for n in range(4))
    pink = (alpha > 160) & (r > 130) & (r > b + 10) & (b > g + 12)
    crown = int(np.flatnonzero(pink.sum(axis=1) >= 4)[0])
    dark = (alpha > 180) & (r < 125) & (g < 125) & (b < 145) & (b >= r - 3) & (np.abs(r - g) < 22)
    bottom = image.getchannel('A').getbbox()[3]
    dark[:round(crown + (bottom - crown) * .65)] = False
    # Sole is the bottom of actual boot material, excluding the cyan sword core.
    sole = int(np.flatnonzero(dark.sum(axis=1) >= 4)[-1]) + 1
    return crown, sole


def boot_center(image):
    crown, sole = landmarks(image)
    a = np.asarray(image)
    band = a[max(0, sole - round((sole - crown) * .18)):sole]
    mask = (band[:, :, 3] > 48) & (band[:, :, :3].max(axis=2) < 150)
    # A diagonal sword edge can cross this band; require boot-length coverage.
    xs = np.flatnonzero(mask.sum(axis=0) >= max(2, round(band.shape[0] * .22)))
    return float((xs[0] + xs[-1]) / 2)


def cells():
    result = {}
    for file, indices in [('keypose-approved.png', KEYS), ('inbetweens-a.png', [1, 3, 4, 6]),
                          ('inbetweens-b.png', [7, 9, 10, 12])]:
        image = clean(Image.open(REV / file))
        for cell, index in enumerate(indices):
            x, y = cell % 2, cell // 2
            result[index] = image.crop((round(x * image.width / 2), round(y * image.height / 2),
                round((x + 1) * image.width / 2), round((y + 1) * image.height / 2)))
    return result


def prepare():
    REV.mkdir(parents=True, exist_ok=True)
    clean(Image.open(REV.parent / 'shion-electromagnetic-v2/idle_00.png')).save(REV / 'baseline-clean.png')
    for index, cell in sorted(cells().items()):
        print(index, cell.size, landmarks(cell), cell.getbbox(), 'boot-root', boot_center(cell), flush=True)


def comparison(images, old_images, clips):
    """Review one steady combat cycle: anticipation, real contact, then recovery."""
    frames = []
    for step in range(30):
        t = step * .02
        old = old_images[clips['idle']['frames'][0]]
        if .20 <= t < .55:
            order = clips['attack']['frames']
            old = old_images[order[min(len(order) - 1, int(1 + (len(order) - 1) * (t - .20) / .35))]]
        if t < .20:
            index = min(4, int(5 * t / .20))
        elif t < .255:
            index = 5
        elif t < .52:
            index = min(13, int(6 + 8 * (t - .255) / .265))
        else:
            index = 13
        canvas = Image.new('RGB', (960, 440), '#202632')
        draw = ImageDraw.Draw(canvas)
        draw.text((24, 18), 'Previous: 6 separate poses', fill='#d2d9e5')
        draw.text((504, 18), '2dimg2motion: 14 frames', fill='#9be7d5')
        for x, image in [(0, old), (480, images[f'attack_{index:02}'])]:
            visible = image.resize((768, 768), Image.Resampling.LANCZOS)
            # Crop only the review viewport; game cells and originals are intact.
            canvas.paste(visible, (x + 240 - 384, 390 - 672), visible)
            draw.line((x + 15, 390, x + 465, 390), fill='#4d586b')
        draw.text((24, 415), 'Same 0.6s attack interval / same damage timing', fill='#bdc8d8')
        if .20 <= t < .255:
            draw.text((450, 415), 'CONTACT', fill='#ffcf75')
        frames.append(canvas)
    frames[0].save(REV / 'comparison.gif', save_all=True, append_images=frames[1:],
        duration=20, loop=0, optimize=False)


def package():
    source = Image.open(REV / 'baseline.png').convert('RGBA')
    base_crown, base_sole = landmarks(source)
    raw = cells()
    ref_crown, ref_sole = landmarks(raw[11])
    scale = (base_sole - base_crown) / (ref_sole - ref_crown)
    size = (1000, 1000)
    ground = 800
    # Preserve the baseline's exact pixels. All generated cells share ONE scale.
    base_x = round(size[0] / 2 - boot_center(source))
    frames = {}
    zero = Image.new('RGBA', size)
    zero.alpha_composite(source, (base_x, ground - source.getbbox()[3]))
    frames[0] = zero
    alignment = {}
    for index, cell in sorted(raw.items()):
        crown, sole = landmarks(cell)
        resized = cell.resize(tuple(round(v * scale) for v in cell.size), Image.Resampling.LANCZOS)
        # Register the support between both boots by translation only. Centering
        # the complete silhouette would make the body slide as the sword swings.
        offset = (round(size[0] / 2 - boot_center(cell) * scale), ground - resized.getbbox()[3])
        frame = Image.new('RGBA', size)
        frame.alpha_composite(resized, offset)
        frames[index] = frame
        alignment[index] = dict(sourceCrown=crown, sourceSole=sole, bootRoot=boot_center(cell), scale=scale, offset=offset)
    frames[13] = zero.copy()
    full = REV / 'delivery/fullframe'
    keys = REV / 'delivery/keyframe'
    full.mkdir(parents=True, exist_ok=True)
    keys.mkdir(parents=True, exist_ok=True)
    for index in range(14):
        frames[index].save(full / f'{PREFIX}_{index:02}.png')
        if index in KEYS:
            shutil.copyfile(full / f'{PREFIX}_{index:02}.png', keys / f'{PREFIX}_{index:02}.png')
    shutil.copyfile(full / f'{PREFIX}_00.png', full / f'{PREFIX}_13.png')
    strip = Image.new('RGBA', (size[0] * 14, size[1]))
    contact = Image.new('RGB', (1400, 440), '#f5f4f1')
    for index in range(14):
        strip.alpha_composite(frames[index], (size[0] * index, 0))
        thumb = frames[index].resize((200, 200), Image.Resampling.LANCZOS)
        x, y = (index % 7) * 200, (index // 7) * 220
        contact.paste(thumb, (x, y + 20), thumb)
        ImageDraw.Draw(contact).text((x + 8, y + 5), f'{index:02}' + (' KEY' if index in KEYS else ''), fill='#30343b')
    strip.save(REV / 'delivery/spritesheet.png')
    contact.save(REV / 'delivery/contact-sheet.png')
    pictures = []
    for index in range(14):
        bg = Image.new('RGB', size, 'white')
        bg.paste(frames[index], mask=frames[index].getchannel('A'))
        pictures.append(bg)
    pictures[0].save(REV / 'delivery/preview.gif', save_all=True, append_images=pictures[1:],
        duration=[60, 60, 85, 40, 25, 65, 35, 35, 50, 45, 45, 55, 55, 60], loop=0, optimize=False)
    shutil.copyfile(REV / 'keyframe-prompts.md', REV / 'delivery/keyframe-prompts.md')
    write(REV / 'delivery/manifest.json', dict(frameCount=14, keyframeIndices=KEYS,
        anchorIndices=[0, 2, 5, 8, 11, 13], segmentInsertions=[1, 2, 2, 2, 1],
        canvas=size, previewBackground='#FFFFFF', coordinateSpace='screen-space',
        activeLimb='original screen-left sword arm', activeShoulder='screen-left',
        anchorLimb='screen-right gauntlet arm; supports same grip until recovery',
        contactFrame=5, tool='built-in image_gen', sharedScale=scale,
        processing='Alpha<12 cleanup, equal-cell splitting, one common resize and translations only.',
        alignment=alignment))
    # Load every old cell exactly as shipped; replace only attack_* cells.
    manifest_path = PUBLIC / 'military-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    old_manifest = json.loads((OLD / 'manifest.json').read_text(encoding='utf-8'))
    old_art = old_manifest['characters'][0]
    atlas_path = OLD / 'runtime' / (old_art['texture'] + '.json')
    atlas_data = json.loads(atlas_path.read_text(encoding='utf-8'))
    atlas_image = Image.open(atlas_path.with_suffix('.png')).convert('RGBA')
    images = {}
    for name, data in atlas_data['frames'].items():
        if name.startswith('attack_'):
            continue
        r = data['frame']
        images[name] = atlas_image.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
    old_images = dict(images)
    for name in old_art['clips']['attack']['frames']:
        r = atlas_data['frames'][name]['frame']
        old_images[name] = atlas_image.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
    canonical = images['idle_00']
    crown, sole = landmarks(canonical)
    runtime_scale = (sole - crown) / (base_sole - base_crown)
    # Match source root offset against the canonical game's existing idle frame.
    _, runtime_sole = landmarks(canonical)
    source_root = base_x + boot_center(source)
    target_root = boot_center(canonical)
    for index, frame in frames.items():
        if index in (0, 13):
            images[f'attack_{index:02}'] = canonical.copy()
            continue
        result = Image.new('RGBA', canonical.size)
        scaled = frame.resize(tuple(round(v * runtime_scale) for v in frame.size), Image.Resampling.LANCZOS)
        result.alpha_composite(scaled, (round(target_root - source_root * runtime_scale),
            runtime_sole - round(ground * runtime_scale)))
        bbox = result.getbbox()
        assert bbox and min(bbox[0], bbox[1], result.width-bbox[2], result.height-bbox[3]) >= 6, (index, bbox)
        images[f'attack_{index:02}'] = result
    spec = importlib.util.spec_from_file_location('military_packer', ROOT / 'scripts/pack-military-runtime.py')
    packer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packer)
    packer.atlas(KEY, images)
    art = next(a for a in manifest['characters'] if a['subjectKey'] == 'hero:kkomaMudang')
    art.update(texture=KEY, image=f'runtime/military/{KEY}.png', atlas=f'runtime/military/{KEY}.json')
    art['clips'] = {name: dict(clip) for name, clip in old_art['clips'].items()}
    art['clips']['attack'] = dict(frames=[f'attack_{i:02}' for i in range(14)], fps=24, loop=False,
        contactFrame=5, contactHoldSeconds=.055, recoverySeconds=.32, anticipationSeconds=.20)
    write(manifest_path, manifest)
    # Keep a standalone package so the normal military rebuild retains this pilot.
    for ext in ['png', 'json']:
        destination = REV / 'package/runtime' / f'{KEY}.{ext}'
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PUBLIC / 'runtime/military' / f'{KEY}.{ext}', destination)
    packaged_art = dict(art, image=f'runtime/{KEY}.png', atlas=f'runtime/{KEY}.json')
    write(REV / 'package/manifest.json', dict(version=2, characters=[packaged_art]))
    write(REV / 'runtime-alignment.json', dict(scale=runtime_scale, sourceRoot=source_root,
        targetRoot=target_root, sole=runtime_sole, sourceBodyHeight=base_sole-base_crown))
    runtime_dir = REV / 'runtime-frames'
    runtime_dir.mkdir(exist_ok=True)
    for index in range(14):
        images[f'attack_{index:02}'].save(runtime_dir / f'attack_{index:02}.png')
    comparison(images, old_images, old_art['clips'])
    print('Packaged Shion 14-frame attack; retained all non-attack cells.', flush=True)
    # A later walk revision is a layer on this package; keep it after rebuilding attack.
    walk_sources = REV.parent / 'shion-2dimg2motion-walk/sources'
    if all((walk_sources / name).is_file() for name in ['keypose-approved.png', 'inbetweens-a.png', 'inbetweens-b.png']):
        walk_spec = importlib.util.spec_from_file_location('shion_walk_packer', ROOT / 'scripts/package-shion-walk.py')
        walk = importlib.util.module_from_spec(walk_spec)
        walk_spec.loader.exec_module(walk)
        walk.package()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', action='store_true')
    args = parser.parse_args()
    prepare() if args.prepare else package()
