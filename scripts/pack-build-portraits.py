"""Package military portraits for the build UI without changing character animation assets.

Run from any directory: python scripts/pack-build-portraits.py
Original PNGs remain in output/art-generation/source-assets; only the compact atlas ships.
"""
from hashlib import sha256
from pathlib import Path
import json

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'output/art-generation/source-assets/ally'
DESTINATION = ROOT / 'public/assets/ui/build'
UNITS = ('clubGoblin', 'oneLegGoblin', 'sumoGoblin', 'foxfireArcher', 'gumiho',
         'bulgasari', 'haetae', 'samjokgo', 'magpieFlock', 'yeongdeungWind')
SIZE, PADDING, COLUMNS = 96, 2, 5


def main():
    step = SIZE + PADDING * 2
    atlas = Image.new('RGBA', (COLUMNS * step, 2 * step))
    frames, sources = {}, {}
    for index, ident in enumerate(UNITS):
        path = SOURCES / ident / 'military/icon.png'
        raw = path.read_bytes()
        with Image.open(path) as source:
            image = source.convert('RGBA')
            if image.width != image.height or not image.getchannel('A').getbbox():
                raise ValueError(f'Expected a nonempty square portrait: {ident}')
            image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        x, y = index % COLUMNS * step + PADDING, index // COLUMNS * step + PADDING
        atlas.alpha_composite(image, (x, y))
        frames[ident] = {
            'frame': {'x': x, 'y': y, 'w': SIZE, 'h': SIZE}, 'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': SIZE, 'h': SIZE},
            'sourceSize': {'w': SIZE, 'h': SIZE},
        }
        sources[ident] = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha256(raw).hexdigest()}
    DESTINATION.mkdir(parents=True, exist_ok=True)
    atlas.save(DESTINATION / 'military-portraits.png', optimize=True)
    data = {'frames': frames, 'meta': {
        'image': 'military-portraits.png', 'format': 'RGBA8888', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1',
        'skinId': 'military', 'scope': 'build-ui-only', 'sources': sources,
    }}
    (DESTINATION / 'military-portraits.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    print(f'Packed {len(frames)} military portraits: {(DESTINATION / "military-portraits.png").stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
