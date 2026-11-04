"""Prepare AI-generated character sheets; source images remain untouched.

Run from the repository root after output/art-generation/jobs.json is saved.
Pillow and NumPy are required. No API calls or gameplay changes are made.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
JOBS = ROOT / "output/art-generation/jobs.json"
OUT = ROOT / "output/art-generation"
FLYING = {"samjokgo", "magpieFlock", "eodduksini", "eodduksiniKing"}
RESAMPLE = Image.Resampling.LANCZOS


def clean_alpha(image: Image.Image) -> Image.Image:
    """Discard almost invisible matte noise without repainting generated art."""
    pixels = np.array(image.convert("RGBA"))
    alpha = pixels[:, :, 3]
    if np.mean(alpha < 24) < 0.08:
        # Some generated sheets have a semiopaque white matte. Keep opaque
        # art, close small line gaps, and fill enclosed costume highlights.
        seed = Image.fromarray(np.where(alpha >= 210, 255, 0).astype("uint8"))
        seed = seed.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
        padded = Image.new("L", (seed.width + 2, seed.height + 2), 0)
        padded.paste(seed, (1, 1))
        ImageDraw.floodfill(padded, (0, 0), 128)
        region = np.asarray(padded.crop((1, 1, seed.width + 1, seed.height + 1))) != 128
        alpha = np.where(region, alpha, 0).astype("uint8")
    mask = Image.fromarray(np.where(alpha >= 24, 255, 0).astype("uint8"))
    mask = mask.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.MaxFilter(3))
    pixels[:, :, 3] = np.where(np.asarray(mask) > 0, alpha, 0)
    pixels[:, :, 3][alpha < 24] = 0
    pixels[pixels[:, :, 3] == 0, :3] = 0
    return Image.fromarray(pixels)


def remove_cell_spill(image: Image.Image) -> Image.Image:
    """Remove small fragments of an adjacent source row, keeping real poses."""
    array = np.array(image)
    coverage = (array[:, :, 3] >= 48).sum(axis=1)
    active = coverage >= max(2, image.width * 0.015)
    ranges = []
    start = None
    for y, occupied in enumerate([*active, False]):
        if occupied and start is None:
            start = y
        elif not occupied and start is not None:
            ranges.append((start, y, int(coverage[start:y].sum())))
            start = None
    if not ranges:
        return image
    largest = max(r[2] for r in ranges)
    keep = [r for r in ranges if r[2] >= largest * 0.35]
    lower, upper = max(0, min(r[0] for r in keep) - 3), min(image.height, max(r[1] for r in keep) + 3)
    array[:lower, :, :] = 0
    array[upper:, :, :] = 0
    return Image.fromarray(array)


def visible_box(image: Image.Image):
    return image.getchannel("A").point(lambda a: 255 if a >= 32 else 0).getbbox()


def fit_center(image: Image.Image, size: tuple[int, int], margin=0.08) -> Image.Image:
    result = Image.new("RGBA", size)
    box = visible_box(image)
    if not box:
        return result
    piece = image.crop(box)
    scale = min(size[0] * (1 - margin * 2) / piece.width,
                size[1] * (1 - margin * 2) / piece.height)
    piece = piece.resize((max(1, round(piece.width * scale)),
                          max(1, round(piece.height * scale))), RESAMPLE)
    result.alpha_composite(piece, ((size[0] - piece.width) // 2,
                                    (size[1] - piece.height) // 2))
    return result


def character_frame(image, size, scale, flying, baseline=0.875):
    result = Image.new("RGBA", size)
    box = visible_box(image)
    if not box:
        return result
    piece = image.crop(box)
    # One shared scale for a character's body frames, including skill poses.
    width, height = max(1, round(piece.width * scale)), max(1, round(piece.height * scale))
    if width > size[0] - 8 or height > size[1] - 8:
        # Avoid silently chopping a weapon or exceptional skill pose.
        correction = min((size[0] - 8) / width, (size[1] - 8) / height)
        width, height = max(1, round(width * correction)), max(1, round(height * correction))
    piece = piece.resize((width, height), RESAMPLE)
    x = (size[0] - width) // 2
    y = (size[1] - height) // 2 if flying else round(size[1] * baseline) - height
    result.alpha_composite(piece, (x, y))
    return result


def parse_dimensions(document):
    text = document.read_text(encoding="utf-8")
    sizes = re.findall(r"\*\*(\d+)\u00d7(\d+)px\*\*", text)
    if len(sizes) < 2:
        raise ValueError(f"Missing source canvas: {document}")
    return tuple(map(int, sizes[1]))


def pack_frames(frames, directory):
    """Write a Phaser-compatible JSON hash atlas with a two-pixel gutter."""
    atlas_width = 4096 if max(im.width for im in frames.values()) >= 640 else 2048
    x = y = row_height = 2
    placements = {}
    for name, im in frames.items():
        if x + im.width + 2 > atlas_width:
            x, y, row_height = 2, y + row_height + 2, 0
        placements[name] = (x, y, im.width, im.height)
        x += im.width + 2
        row_height = max(row_height, im.height)
    atlas_height = y + row_height + 2
    packed = Image.new("RGBA", (atlas_width, atlas_height))
    data = {}
    for name, im in frames.items():
        px, py, width, height = placements[name]
        packed.alpha_composite(im, (px, py))
        data[Path(name).stem] = {
            "frame": {"x": px, "y": py, "w": width, "h": height},
            "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": width, "h": height},
            "sourceSize": {"w": width, "h": height},
        }
    packed.save(directory / "atlas.png", optimize=True)
    atlas = {"frames": data, "meta": {
        "app": "lanebattle character art preparation", "version": "1",
        "image": "atlas.png", "format": "RGBA8888",
        "size": {"w": atlas_width, "h": atlas_height}, "scale": "1",
    }}
    (directory / "atlas.json").write_text(json.dumps(atlas, indent=2) + "\n", encoding="utf-8")
    return atlas_width, atlas_height


def prepare(job, spec):
    directory = ROOT / "output/art-generation/source-assets" / job["group"] / job["id"] / "default"
    directory.mkdir(parents=True, exist_ok=True)
    source = directory / "source-atlas.png"
    if not source.exists():
        source.write_bytes(Path(job["source"]).read_bytes())
    with Image.open(source) as original:
        image = original.convert("RGBA")
    cols, rows = job["columns"], job["rows"]
    crops = {}
    for index, name in enumerate(job["files"]):
        col, row = index % cols, index // cols
        # Generated contact poses can extend slightly below their nominal cell.
        # Include a small lower gutter, then discard unrelated row fragments.
        bottom = row + (1.10 if not name.startswith(("fx_", "projectile_")) else 1)
        rect = (round(col * image.width / cols), round(row * image.height / rows),
                round((col + 1) * image.width / cols), min(image.height, round(bottom * image.height / rows)))
        crop = clean_alpha(image.crop(rect))
        if not name.startswith(("fx_", "projectile_")):
            crop = remove_cell_spill(crop)
        crops[name] = crop
    canvas = parse_dimensions(ROOT / job["document"])
    reference = visible_box(crops["idle_00.png"])
    if not reference:
        raise ValueError(f"Empty idle art: {job['id']}")
    scale = min(canvas[0] * 0.78 / (reference[2] - reference[0]),
                canvas[1] * 0.72 / (reference[3] - reference[1]))
    dimensions = {}
    for entry in spec["rows"]:
        sizes = re.findall(r"(\d+)\u00d7(\d+)", entry["description"])
        if sizes:
            for name in entry["files"]:
                dimensions[name] = tuple(map(int, sizes[0]))
    frames, warnings = {}, []
    flying = job["id"] in FLYING
    for name, crop in crops.items():
        if name in {"preview.png", "icon.png"}:
            size = (512, 512) if name == "preview.png" else (128, 128)
            frame = fit_center(crop, size)
        elif name.startswith(("fx_", "projectile_")):
            size = dimensions.get(name, (256, 256))
            frame = fit_center(crop, size, margin=0.06)
        else:
            size = canvas
            baseline = 0.5 if job["id"] == "eodduksiniKing" and name.startswith("ground_idle_") else 0.875
            airborne = flying and not (job["id"] == "eodduksiniKing" and name.startswith("ground_idle_"))
            frame = character_frame(crop, size, scale, airborne, baseline)
        frame.save(directory / name, optimize=True)
        frames[name] = frame
        if not visible_box(frame):
            warnings.append(f"empty:{name}")
    # Always use a verified full-body frame for the full-body preview. Generated
    # preview cells occasionally contain a portrait or a neighboring-row fragment.
    frames["preview.png"] = fit_center(frames["idle_00.png"], (512, 512))
    frames["preview.png"].save(directory / "preview.png", optimize=True)
    packed_size = pack_frames(frames, directory)
    clips = {}
    for name in frames:
        if name in {"preview.png", "icon.png"}:
            continue
        match = re.match(r"(.+)_\d+\.png$", name)
        if match:
            clips.setdefault(match[1], []).append(Path(name).stem)
    for key, names in list(clips.items()):
        clips[key] = {"frames": names, "fps": 8 if key == "walk" else 6,
                      "loop": key in {"walk", "idle", "grab_hold", "ground_idle"}}
    metadata = {
        "subjectKey": f"{job['group']}:{job['id']}", "skinId": "default",
        "document": job["document"], "created": "2026-11-04",
        "generator": "built-in image_gen", "postprocessing": "Python Pillow and NumPy; user authorized",
        "facing": "right", "canvas": {"width": canvas[0], "height": canvas[1]},
        "origin": {"x": 0.5, "y": 0.5 if flying else 0.875},
        "sourceGrid": {"columns": cols, "rows": rows, "size": list(image.size)},
        "bodyScale": scale, "atlas": "atlas.json", "clips": clips,
        "reviewStatus": "generated; technical validation only; animation and anatomy need visual review",
        "warnings": warnings,
        "usageNote": "Generated for this project from its art briefs; third-party license not asserted.",
    }
    (directory / "skin.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (directory / "generation-prompt.txt").write_text(job["prompt"] + "\n", encoding="utf-8")
    return {"id": job["id"], "group": job["group"], "frames": len(frames),
            "canvas": list(canvas), "atlasSize": list(packed_size), "warnings": warnings,
            "directory": directory.relative_to(ROOT).as_posix()}


def make_preview(results):
    font_path = Path("C:/Windows/Fonts/malgun.ttf")
    font = ImageFont.truetype(str(font_path), 18) if font_path.exists() else ImageFont.load_default()
    card_w, card_h, columns = 220, 240, 6
    contact = Image.new("RGB", (columns * card_w, math.ceil(len(results) / columns) * card_h), "#EEE8DC")
    draw = ImageDraw.Draw(contact)
    cards = []
    for index, result in enumerate(results):
        directory = ROOT / result["directory"]
        doc = ROOT / f"docs/art/default/{result['group']}/{result['id']}.md"
        name = doc.read_text(encoding="utf-8").splitlines()[0].removeprefix("# ").split(" ")[0]
        title = doc.read_text(encoding="utf-8").splitlines()[0].removeprefix("# ")
        title = title[:title.index(" 이미지")]
        image = Image.open(directory / "preview.png").convert("RGBA")
        image.thumbnail((190, 195), RESAMPLE)
        left, top = (index % columns) * card_w, (index // columns) * card_h
        contact.paste(image, (left + (card_w - image.width) // 2, top + 10), image)
        draw.text((left + 12, top + 212), title, font=font, fill="#332D40")
        url = "../../" + result["directory"]
        cards.append(f'<article><h2>{html.escape(title)}</h2><img class="portrait" src="{url}/preview.png" alt="{html.escape(title)}"><p>{result["frames"]} PNG</p><a href="{url}/atlas.png">Atlas</a> · <a href="{url}/skin.json">Metadata</a><details><summary>Frames</summary><div class="frames">' +
                     ''.join(f'<figure><img src="{url}/{p.name}" loading="lazy"><figcaption>{p.stem}</figcaption></figure>'
                             for p in sorted(directory.glob('*.png'))
                             if p.name not in {'atlas.png', 'source-atlas.png', 'preview.png'}) + '</div></details></article>')
    contact.save(OUT / "contact-sheet.png", optimize=True)
    # A compact four-frame walk review; it does not drive gameplay.
    walk_frames = []
    for step in range(4):
        walking = Image.new("RGB", contact.size, "#EEE8DC")
        painter = ImageDraw.Draw(walking)
        for index, result in enumerate(results):
            directory = ROOT / result["directory"]
            tile = Image.open(directory / f"walk_{step:02d}.png").convert("RGBA")
            tile.thumbnail((190, 195), RESAMPLE)
            left, top = (index % columns) * card_w, (index // columns) * card_h
            walking.paste(tile, (left + (card_w - tile.width) // 2, top + 10), tile)
            painter.text((left + 12, top + 212), result["id"], fill="#332D40")
        walk_frames.append(walking)
    walk_frames[0].save(OUT / "walk-preview.gif", save_all=True,
                        append_images=walk_frames[1:], duration=160, loop=0)
    page = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Lane Battle Art</title><style>body{margin:30px;background:#eee8dc;color:#332d40;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px}article{background:#faf7ef;padding:20px;border-radius:15px}h2{font-size:20px}.portrait{width:100%;height:240px;object-fit:contain}.frames{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.frames img{width:100%;height:110px;object-fit:contain;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/12px 12px}figure{margin:0}figcaption{font-size:10px;overflow-wrap:anywhere}a{color:#365e91}summary{cursor:pointer;margin-top:16px}</style><h1>캐릭터 기본 아트 26종</h1><p>SD 캐릭터 · 기본 스킨 · 동작 프레임과 효과. 생성 원화의 자동 분리본이며 실제 전투 애니메이션 검수는 별도입니다.</p><main>' + ''.join(cards) + '</main></html>'
    (OUT / "preview.html").write_text(page + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*")
    args = parser.parse_args()
    jobs = json.loads(JOBS.read_text(encoding="utf-8"))
    specs = {item["id"]: item for item in jobs["characters"]}
    selected = [job for job in jobs["generated"] if not args.only or job["id"] in args.only]
    results = [prepare(job, specs[job["id"]]) for job in selected]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "preparation-report.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    make_preview(results)
    print(json.dumps({"characters": len(results), "frames": sum(r["frames"] for r in results),
                      "warnings": {r["id"]: r["warnings"] for r in results if r["warnings"]}}, indent=2))


if __name__ == "__main__":
    main()
