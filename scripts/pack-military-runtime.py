"""Publish existing generated military art; never modify or generate source images.

Run after package-shion-art.py. Only the resulting public assets ship to players.
Body frames use one normalized scale per subject and a shared foot/center pivot.
"""
from pathlib import Path
import json
import re
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public/assets/characters'
THEME = ROOT / 'public/assets/military'
REV = ROOT / 'output/art-generation/revisions/shion-electromagnetic-v2/package'
MOTION_REV = ROOT / 'output/art-generation/revisions/shion-2dimg2motion-attack/package'
WALK_REV = ROOT / 'output/art-generation/revisions/shion-2dimg2motion-walk/package'
HEIGHTS = dict(clubGoblin=153, oneLegGoblin=167, sumoGoblin=174, foxfireArcher=163,
               gumiho=170, bulgasari=169, haetae=176, samjokgo=168,
               magpieFlock=152, yeongdeungWind=165)


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def contain(image, size):
    image = image.copy()
    image.thumbnail(size, Image.Resampling.LANCZOS)
    result = Image.new('RGBA', size)
    result.alpha_composite(image, ((size[0]-image.width)//2, (size[1]-image.height)//2))
    return result


def atlas(key, images):
    placements, frames = {}, {}
    cropped = {}
    boxes = {}
    for name, image in images.items():
        box = image.getchannel('A').getbbox()
        assert box, (key, name)
        boxes[name] = box
        cropped[name] = image.crop(box)
    x = y = row = 2
    for name, image in sorted(cropped.items()):
        if x + image.width + 2 > 1024:
            x, y, row = 2, y + row + 2, 0
        placements[name] = (x, y)
        x += image.width + 2
        row = max(row, image.height)
    sheet = Image.new('RGBA', (1024, y + row + 2))
    assert sheet.height <= 4096, key
    for name, image in cropped.items():
        x, y = placements[name]
        left, top, _, _ = boxes[name]
        sheet.alpha_composite(image, (x, y))
        frames[name] = dict(frame=dict(x=x, y=y, w=image.width, h=image.height),
                            rotated=False, trimmed=True,
                            spriteSourceSize=dict(x=left, y=top, w=image.width, h=image.height),
                            sourceSize=dict(w=images[name].width, h=images[name].height))
    runtime = PUBLIC / 'runtime/military'
    runtime.mkdir(parents=True, exist_ok=True)
    sheet.save(runtime / f'{key}.png', optimize=True)
    write(runtime / f'{key}.json', dict(frames=frames, meta=dict(
        image=f'{key}.png', size=dict(w=sheet.width, h=sheet.height), scale='1')))


def pack_unit(unit, jobs):
    subject = unit['subject_key']
    group, ident = subject.split(':')
    source = {Path(j['output']).stem: j for j in jobs if j['subject_key'] == subject}
    bodies = {n: j for n, j in source.items() if j['kind'] == 'body'}
    flying = subject in ('ally:samjokgo', 'enemy:eodduksini', 'boss:eodduksiniKing')
    # Hibari retains the existing aerial combat rules; ground presentation is cosmetic.
    origin = dict(x=0.5, y=0.5 if flying else 0.875)
    with Image.open(ROOT / source['idle_00']['output']) as im:
        box = im.getchannel('A').point(lambda a: 255 if a >= 48 else 0).getbbox()
        normalized_height = (box[3]-box[1])/im.height
    normalized_scale = 144 / normalized_height
    images = {}
    for name, job in source.items():
        with Image.open(ROOT / job['output']) as raw:
            im = raw.convert('RGBA')
        if name in bodies:
            box = im.getchannel('A').point(lambda a: 255 if a >= 48 else 0).getbbox()
            assert box, (subject, name)
            ratio = normalized_scale / im.height
            crop = im.crop(box)
            # A generous shared canvas holds weapons. Fit only exceptional wide poses.
            ratio = min(ratio, 248/crop.width, (248 if flying else 216)/crop.height)
            size = (max(1, round(crop.width*ratio)), max(1, round(crop.height*ratio)))
            crop = crop.resize(size, Image.Resampling.LANCZOS)
            image = Image.new('RGBA', (256, 256))
            image.alpha_composite(crop, ((256-crop.width)//2,
                (256-crop.height)//2 if flying else 224-crop.height))
        else:
            image = contain(im, (128, 128) if name == 'icon' else (256, 256))
        images[name] = image
    groups = {}
    for name in source:
        match = re.fullmatch(r'(.+)_(\d\d)', name)
        if match:
            groups.setdefault(match[1], []).append(name)
    clips = {}
    for name, frames in sorted(groups.items()):
        proposed = unit.get('clip_order_proposal', {}).get(name)
        order = proposed if proposed and set(proposed) == set(frames) else sorted(frames)
        clips[name] = dict(frames=order, fps=dict(idle=8, walk=12, attack=18, hit=20,
            spawn=9, death=8).get(name, 12), loop=name in ('idle', 'walk', 'ground_idle'))
    key = f'{group}-{ident}-military'
    atlas(key, images)
    display = 110*HEIGHTS[ident]/169 if group == 'ally' else 178 if group == 'boss' else 100
    return dict(subjectKey=subject, skinId='military', texture=key,
        image=f'runtime/military/{key}.png', atlas=f'runtime/military/{key}.json',
        origin=origin, bodyHeight=144, bodyWidth=60 if group == 'boss' else 45,
        displayHeight=round(display, 3), displayTop=round(display*(0.5 if flying else 1), 3),
        canvas=dict(width=256, height=256), clips=clips)


def main():
    jobs = json.loads((ROOT / 'docs/art/military/prompts/jobs.json').read_text(encoding='utf-8'))
    characters = []
    for unit in jobs['units']:
        if unit['subject_key'] == 'hero:kkomaMudang':
            revision = WALK_REV if (WALK_REV / 'manifest.json').is_file() else MOTION_REV if (MOTION_REV / 'manifest.json').is_file() else REV
            art = json.loads((revision / 'manifest.json').read_text(encoding='utf-8'))['characters'][0]
            destination = PUBLIC / 'runtime/military'
            destination.mkdir(parents=True, exist_ok=True)
            for ext in ['png', 'json']:
                shutil.copyfile(revision / f'runtime/{art["texture"]}.{ext}', destination / f'{art["texture"]}.{ext}')
            art.update(image=f'runtime/military/{art["texture"]}.png',
                       atlas=f'runtime/military/{art["texture"]}.json',
                       displayHeight=round(110*172/169, 3), displayTop=round(110*172/169, 3))
        else:
            art = pack_unit(unit, jobs['items'])
        characters.append(art)
        print('Packed', art['subjectKey'], flush=True)
    write(PUBLIC / 'military-manifest.json', dict(version=2, scope='military',
        rendererIntegration=True, characters=characters))
    THEME.mkdir(parents=True, exist_ok=True)
    for chapter in range(1, 6):
        source = ROOT / 'output/art-generation/military-theme/environment'
        with Image.open(source / f'chapter_{chapter:02}_rear.png') as raw:
            background = raw.convert('RGBA')
        with Image.open(source / f'chapter_{chapter:02}_middle.png') as raw:
            background.alpha_composite(raw.convert('RGBA').resize(background.size))
        background.convert('RGB').resize((1280, 720), Image.Resampling.LANCZOS).save(
            THEME / f'chapter-{chapter}.jpg', quality=88)
        for team in ['ally', 'enemy']:
            for phase in range(4):
                path = ROOT / f'output/art-generation/military-theme/bases/chapter_{chapter:02}_{team}_damage_{phase}.png'
                with Image.open(path) as raw:
                    im = raw.convert('RGBA')
                box = im.getchannel('A').point(lambda a: 255 if a >= 48 else 0).getbbox()
                contain(im.crop(box), (320, 256)).save(THEME / f'base-{chapter}-{team}-{phase}.png', optimize=True)
    with Image.open(REV / 'frames/title_shion_keyart.png') as raw:
        contain(raw.convert('RGBA'), (768, 512)).save(THEME / 'shion-title.png', optimize=True)
    print('Published 26 military characters, latest packaged Shion, five chapters and 40 base states.')


if __name__ == '__main__':
    main()
