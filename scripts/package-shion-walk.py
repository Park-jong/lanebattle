"""Package model-redrawn Shion walking poses, retaining the approved attack.

Only alpha cleanup, splitting, common rescaling, translation and packing happen
here. No drawing, limb transforms, pose interpolation or motion synthesis.
"""
from pathlib import Path
import importlib.util
import json
import shutil

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REV = ROOT / 'output/art-generation/revisions/shion-2dimg2motion-walk'
ATTACK = ROOT / 'output/art-generation/revisions/shion-2dimg2motion-attack/package'
PUBLIC = ROOT / 'public/assets/characters'
KEY = 'hero-kkomaMudang-military-motion-v2'
KEYS = [0, 3, 6, 9]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


helpers = module('shion_pose_helpers', 'package-shion-motion.py')


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def waist_anchor(image):
    """Track the cyan waist module, excluding the lower sword and far gauntlet."""
    crown, sole = helpers.landmarks(image)
    a = np.asarray(image).astype(np.int16)
    r, g, b, alpha = (a[:, :, i] for i in range(4))
    mask = (alpha > 120) & (g > 110) & (b > 110) & (g > r + 30) & (b > r + 35)
    y0, y1 = round(crown + (sole - crown) * .32), round(crown + (sole - crown) * .47)
    mask[:y0] = False
    mask[y1:] = False
    # The waist module is the leftmost cyan component in the torso band.
    counts = mask.sum(axis=0)
    columns = np.flatnonzero(counts >= max(1, round(image.width / 400)))
    if not len(columns):
        raise ValueError('No waist module landmark')
    left = columns[0]
    group = columns[columns < left + max(8, (sole-crown) * .075)]
    return float(np.average(group, weights=counts[group]))


def read_cells(art, folder):
    atlas = json.loads((folder / (art['texture'] + '.json')).read_text(encoding='utf-8'))
    sheet = Image.open(folder / (art['texture'] + '.png')).convert('RGBA')
    result = {}
    for name, value in atlas['frames'].items():
        r = value['frame']
        image = sheet.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        if value.get('trimmed'):
            original = Image.new('RGBA', (value['sourceSize']['w'], value['sourceSize']['h']))
            original.alpha_composite(image, (value['spriteSourceSize']['x'], value['spriteSourceSize']['y']))
            image = original
        result[name] = image
    return result


def source_cells():
    result = {}
    for file, indices in [('keypose-approved.png', KEYS), ('inbetweens-a.png', [1, 2, 4, 5]),
                          ('inbetweens-b.png', [7, 8, 10, 11])]:
        sheet = helpers.clean(Image.open(REV / 'sources' / file))
        for i, frame in enumerate(indices):
            x, y = i % 2, i // 2
            result[frame] = sheet.crop((round(x * sheet.width / 2), round(y * sheet.height / 2),
                round((x + 1) * sheet.width / 2), round((y + 1) * sheet.height / 2)))
    return result


def preview_gif(images, destination, scale=2):
    pictures = []
    for index in range(12):
        cell = images[f'walk_{index:02}'].resize((256*scale, 256*scale), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', cell.size, 'white')
        canvas.paste(cell, mask=cell.getchannel('A'))
        pictures.append(canvas)
    pictures[0].save(destination, save_all=True, append_images=pictures[1:], duration=70, loop=0, optimize=False)


def package():
    old_art = json.loads((ATTACK / 'manifest.json').read_text(encoding='utf-8'))['characters'][0]
    old_images = read_cells(old_art, ATTACK / 'runtime')
    canonical = old_images['idle_00']
    crown, sole = helpers.landmarks(canonical)
    anchor = waist_anchor(canonical)
    raw = source_cells()
    # One shared scale. Keep the small pose-driven rise/fall in passing poses.
    height = float(np.median([helpers.landmarks(raw[i])[1] - helpers.landmarks(raw[i])[0] for i in KEYS]))
    scale = (sole - crown) / height
    images = {n: im for n, im in old_images.items() if not n.startswith('walk_')}
    alignment = {}
    for index, source in sorted(raw.items()):
        c, s = helpers.landmarks(source)
        root = waist_anchor(source)
        resized = source.resize(tuple(round(v * scale) for v in source.size), Image.Resampling.LANCZOS)
        offset = (round(anchor - root * scale), sole - round(s * scale))
        cell = Image.new('RGBA', (256, 256))
        cell.alpha_composite(resized, offset)
        bbox = cell.getbbox()
        assert bbox and min(bbox[0], bbox[1], 256-bbox[2], 256-bbox[3]) >= 6, (index, bbox)
        images[f'walk_{index:02}'] = cell
        alignment[index] = dict(crown=c, sole=s, waistX=root, scale=scale, offset=offset)
    # Contact foot separation is ~.4 body heights; two steps complete one cycle.
    stride = round(old_art['bodyHeight'] * .8)
    delivery = REV / 'delivery'
    (delivery / 'fullframe').mkdir(parents=True, exist_ok=True)
    (delivery / 'keyframe').mkdir(exist_ok=True)
    sheet = Image.new('RGBA', (256 * 12, 256))
    contact = Image.new('RGB', (1536, 560), '#f5f4f1')
    for i in range(12):
        cell = images[f'walk_{i:02}']
        cell.save(delivery / 'fullframe' / f'walk_{i:02}.png')
        if i in KEYS:
            cell.save(delivery / 'keyframe' / f'walk_{i:02}.png')
        sheet.alpha_composite(cell, (i*256, 0))
        x, y = (i % 6) * 256, (i // 6) * 280
        contact.paste(cell, (x, y+22), cell)
        ImageDraw.Draw(contact).text((x+10, y+5), f'{i:02}' + (' KEY' if i in KEYS else ''), fill='#333b48')
    sheet.save(delivery / 'spritesheet.png')
    contact.save(delivery / 'contact-sheet.png')
    preview_gif(images, delivery / 'preview.gif')
    shutil.copyfile(REV / 'keyframe-prompts.md', delivery / 'keyframe-prompts.md')
    write(delivery / 'manifest.json', dict(frameCount=12, keyframeIndices=KEYS, loop=True,
        canvas=[256, 256], coordinateSpace='screen-space', sharedScale=scale, strideLength=stride,
        anchor='cyan waist power module and boot ground line; translation only',
        nearLeg='original screen-left holster thigh', farLeg='original screen-right plain thigh',
        weaponHand='original screen-left near hand; sword carried down/back-left',
        tool='built-in image_gen', alignment=alignment))
    packer = module('military_atlas', 'pack-military-runtime.py')
    packer.atlas(KEY, images)
    manifest_path = PUBLIC / 'military-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    art = next(a for a in manifest['characters'] if a['subjectKey'] == 'hero:kkomaMudang')
    art.update(texture=KEY, image=f'runtime/military/{KEY}.png', atlas=f'runtime/military/{KEY}.json')
    art['clips']['walk'] = dict(frames=[f'walk_{i:02}' for i in range(12)], fps=14, loop=True, strideLength=stride)
    write(manifest_path, manifest)
    for ext in ['png', 'json']:
        dst = REV / 'package/runtime' / f'{KEY}.{ext}'
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PUBLIC / 'runtime/military' / f'{KEY}.{ext}', dst)
    write(REV / 'package/manifest.json', dict(version=2, characters=[dict(art,
        image=f'runtime/{KEY}.png', atlas=f'runtime/{KEY}.json')]))
    # Verify every retained frame, including all attack poses and UI, is identical.
    for name, image in old_images.items():
        if not name.startswith('walk_'):
            assert np.array_equal(np.asarray(images[name]), np.asarray(image)), name
    validate(images)
    comparison(images, old_images, old_art)
    print('Packaged Shion 12-frame alternating walk; attack and other cells retained.', flush=True)


def validate(images):
    frames = [images[f'walk_{i:02}'] for i in range(12)]
    assert all(im.size == (256, 256) and im.mode == 'RGBA' for im in frames)
    assert all(all(im.getpixel(p)[3] == 0 for p in [(0,0), (255,0), (0,255), (255,255)]) for im in frames)
    assert all(not np.array_equal(np.asarray(frames[i]), np.asarray(frames[(i+1)%12])) for i in range(12))
    animation = Image.open(REV / 'delivery/preview.gif')
    assert animation.n_frames == 12
    for index in range(12):
        animation.seek(index)
        assert animation.convert('RGB').getpixel((0, 0)) == (255, 255, 255)


def comparison(images, old_images, old_art):
    pictures = []
    for step in range(48):
        canvas = Image.new('RGB', (960, 440), '#202632')
        draw = ImageDraw.Draw(canvas)
        draw.text((24, 18), 'Previous: 8 frames', fill='#d2d9e5')
        draw.text((504, 18), '2dimg2motion: 12 alternating frames', fill='#9be7d5')
        old_order = old_art['clips']['walk']['frames']
        old = old_images[old_order[int(step / 3) % len(old_order)]]
        new = images[f'walk_{int(step / 2) % 12:02}']
        for x, cell in [(0, old), (480, new)]:
            scaled = cell.resize((768,768), Image.Resampling.LANCZOS)
            canvas.paste(scaled, (x+240-384, 390-672), scaled)
            draw.line((x+15,390,x+465,390), fill='#4d586b')
        draw.text((24,415), 'Equal cycle duration / actual game cadence follows ground distance', fill='#bdc8d8')
        pictures.append(canvas)
    pictures[0].save(REV / 'comparison.gif', save_all=True, append_images=pictures[1:], duration=40, loop=0, optimize=False)


if __name__ == '__main__':
    package()
