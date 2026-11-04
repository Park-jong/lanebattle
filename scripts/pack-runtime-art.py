"""Pack generated character PNGs into small runtime textures; preserve all sources."""
from pathlib import Path
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public/assets/characters'
SOURCES = ROOT / 'output/art-generation/source-assets'


def inside(path, parent):
    path.resolve().relative_to(parent.resolve())
    return path


def main():
    SOURCES.mkdir(parents=True, exist_ok=True)
    saved_manifest = SOURCES / 'manifest.json'
    if not saved_manifest.exists():
        shutil.copyfile(PUBLIC / 'manifest.json', saved_manifest)
    original = json.loads(saved_manifest.read_text(encoding='utf-8'))
    runtime = PUBLIC / 'runtime'
    runtime.mkdir(parents=True, exist_ok=True)
    characters = []
    for entry in original['characters']:
        group, ident = entry['subjectKey'].split(':')
        relative = Path(group) / ident / 'default'
        source = inside(SOURCES / relative, SOURCES)
        if not source.exists():
            current = inside(PUBLIC / relative, PUBLIC)
            source.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(current), str(source))
        skin = json.loads((source / 'skin.json').read_text(encoding='utf-8'))
        images = {}
        body_limit = 192 if group == 'boss' else 128 if group == 'hero' else 96
        for name in [*{f + '.png' for c in skin['clips'].values() for f in c['frames']}, 'icon.png', 'preview.png']:
            im = Image.open(source / name).convert('RGBA')
            limit = 96 if name == 'icon.png' else 192 if name == 'preview.png' else body_limit
            ratio = min(1, limit / max(im.size))
            im = im.resize((max(1, round(im.width * ratio)), max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)
            images[Path(name).stem] = im
        images = dict(sorted(images.items()))
        placements = {}
        x = y = height = 2
        for name, im in images.items():
            if x + im.width + 2 > 1024:
                x, y, height = 2, y + height + 2, 0
            placements[name] = (x, y)
            x += im.width + 2
            height = max(height, im.height)
        atlas_height = y + height + 2
        if atlas_height > 2048:
            raise ValueError(f'Runtime atlas too large: {ident}')
        atlas = Image.new('RGBA', (1024, atlas_height))
        frames = {}
        for name, im in images.items():
            px, py = placements[name]
            atlas.alpha_composite(im, (px, py))
            frames[name] = {'frame': {'x': px, 'y': py, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': False,
                            'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
                            'sourceSize': {'w': im.width, 'h': im.height}}
        key = group + '-' + ident
        atlas.save(runtime / (key + '.png'), optimize=True)
        (runtime / (key + '.json')).write_text(json.dumps({'frames': frames, 'meta': {'image': key + '.png', 'format': 'RGBA8888',
            'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}}, separators=(',', ':')) + '\n', encoding='utf-8')
        reference = images['idle_00']
        box = reference.getchannel('A').point(lambda a: 255 if a >= 48 else 0).getbbox()
        if not box:
            raise ValueError(f'Empty reference: {ident}')
        characters.append({'subjectKey': entry['subjectKey'], 'skinId': 'default', 'texture': key,
            'image': 'runtime/' + key + '.png', 'atlas': 'runtime/' + key + '.json',
            'origin': skin['origin'], 'bodyHeight': box[3] - box[1], 'bodyWidth': box[2] - box[0],
            'canvas': {'width': reference.width, 'height': reference.height}, 'clips': skin['clips']})
    (PUBLIC / 'manifest.json').write_text(json.dumps({'version': 2, 'scope': 'default', 'rendererIntegration': True,
        'characters': characters}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Packed {len(characters)} characters; runtime PNG bytes: {sum(p.stat().st_size for p in runtime.glob("*.png"))}')


if __name__ == '__main__':
    main()
