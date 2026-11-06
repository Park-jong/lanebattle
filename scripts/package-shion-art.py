"""Align generated Shion frames and export clips, an atlas and review animations.

This is deterministic game-asset packaging, never an art generator. Raw image_gen
PNGs and their alpha are preserved in the revision's raw directory.
"""
from pathlib import Path
import json
import math
import zipfile

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REV = ROOT / 'output/art-generation/revisions/shion-electromagnetic-v2'
OUT = REV / 'package'
CANVAS = 2048
ORIGIN = (1024, 1792)
BODY_HEIGHT = 900


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def clip_definitions():
    order = {
        'idle': [0, 2, 3, 4, 1, 5, 6, 7],
        'walk': [0, 4, 1, 5, 2, 6, 3, 7],
        'attack': [0, 1, 2, 4, 3, 5],
        'hit': [0, 2, 1, 3],
        'spawn': [0, 1, 2], 'death': [0, 1, 2, 3],
        'skill_fan': [0, 1, 2, 3], 'skill_blessing': [0, 1, 2, 3],
        'skill_blade': [0, 1, 2, 3],
        'start': [0, 1, 2], 'stop': [0, 1, 2], 'turn': [0, 1, 2],
        'fx_fan': [0, 1, 2, 3], 'fx_blessing': [0, 1, 2, 3],
        'fx_blade': [0, 1, 2, 3], 'fx_saber_edge': [0, 1],
    }
    fps = {'idle': 8, 'walk': 12, 'attack': 18, 'hit': 20,
           'spawn': 9, 'death': 8, 'skill_fan': 12, 'skill_blessing': 12,
           'skill_blade': 12, 'start': 12, 'stop': 12, 'turn': 12}
    return {name: {'frames': [f'{name}_{n:02}' for n in numbers],
                   'fps': fps.get(name, 12), 'loop': name in ('idle', 'walk')}
            for name, numbers in order.items()}


def pose_height(stem):
    values = {'attack': [820, 800, 800, 850, 820, 900],
              'skill_fan': [800, 770, 800, 900],
              'skill_blade': [900, 770, 760, 900],
              'death': [850, 550, 470, 470],
              'hit': [860, 900, 875, 900], 'turn': [875, 900, 875]}
    prefix, index = stem.rsplit('_', 1)
    return values.get(prefix, [BODY_HEIGHT] * 8)[int(index)]


def body_landmarks(image):
    """Estimate hair crown and boot support; write all estimates for review."""
    sample = image.copy()
    sample.thumbnail((400, 520), Image.Resampling.LANCZOS)
    a = np.asarray(sample).astype(np.int16)
    r, g, b, alpha = (a[:, :, n] for n in range(4))
    visible = alpha > 180
    pink = visible & (r > 130) & (r > b + 10) & (b > g + 12)
    pink_rows = np.flatnonzero(pink.sum(axis=1) >= 4)
    if not len(pink_rows):
        raise ValueError('No pink hair landmarks found')
    top = int(pink_rows[0])
    # Black/blue boot material excludes pink hair and plum cape.
    dark = visible & (r < 125) & (g < 125) & (b < 145) & (b >= r - 3) & (np.abs(r-g) < 22)
    dark[:round(top + (sample.height-top)*0.65), :] = False
    dark_rows = np.flatnonzero(dark.sum(axis=1) >= 4)
    if not len(dark_rows):
        raise ValueError('No boot support landmarks found')
    ground = int(dark_rows[-1])
    bottom = dark[max(top, ground-round((ground-top)*0.18)):ground+1]
    counts = bottom.sum(axis=0)
    columns = np.flatnonzero(counts >= max(4, counts.max()*0.22))
    if not len(columns):
        raise ValueError('No boot root columns found')
    root_x = float(np.average(columns, weights=counts[columns]))
    ratio = image.width / sample.width
    return {'crown_y': top * ratio, 'ground_y': ground * ratio,
            'root_x': root_x * ratio, 'method': 'pink-crown and lower-boot material estimate'}


def body_frame(image, stem):
    points = body_landmarks(image)
    scale = pose_height(stem) / max(1, points['ground_y'] - points['crown_y'])
    box = image.getchannel('A').point(lambda v: 255 if v >= 48 else 0).getbbox()
    # Use one scale factor and translation. Never stretch anatomy or rotate art.
    dx = max(abs(box[0]-points['root_x']), abs(box[2]-points['root_x']))
    dy = max(0, points['ground_y']-box[1])
    scale = min(scale, (ORIGIN[0]-32)/max(1, dx), (ORIGIN[1]-32)/max(1, dy))
    size = tuple(max(1, round(n * scale)) for n in image.size)
    offset = (round(ORIGIN[0]-points['root_x']*scale), round(ORIGIN[1]-points['ground_y']*scale))
    frame = Image.new('RGBA', (CANVAS, CANVAS))
    frame.alpha_composite(image.resize(size, Image.Resampling.LANCZOS), offset)
    points.update(scale=scale, offset=list(offset), pose_height=pose_height(stem))
    return frame, points


def contain(image, size):
    result = Image.new('RGBA', size)
    image = image.copy()
    image.thumbnail(size, Image.Resampling.LANCZOS)
    result.alpha_composite(image, ((size[0]-image.width)//2, (size[1]-image.height)//2))
    return result


def main():
    plan = json.loads((REV / 'animation-jobs.json').read_text(encoding='utf-8'))
    assert len(plan['items']) == 74 and all(j['status'] == 'generated' for j in plan['items'])
    frames_dir, runtime_dir = OUT / 'frames', OUT / 'runtime'
    frames_dir.mkdir(parents=True, exist_ok=True)
    runtime_dir.mkdir(exist_ok=True)
    clips = clip_definitions()
    alignments, runtime_images = {}, {}
    for job in plan['items']:
        stem = job['stem']
        with Image.open(ROOT / job['output']) as raw:
            image = raw.convert('RGBA')
        if job['kind'] == 'body':
            frame, points = body_frame(image, stem)
            alignments[stem] = points
            runtime = frame.resize((256, 256), Image.Resampling.LANCZOS)
        else:
            frame = contain(image, tuple(job['target_size']))
            limit = 128 if stem == 'icon' or job['kind'] == 'ui' else 256
            runtime = contain(frame, (limit, limit))
        frame.save(frames_dir / f'{stem}.png', optimize=True)
        runtime_images[stem] = runtime
    write(OUT / 'alignment.json', {'canvas': [CANVAS, CANVAS], 'origin': list(ORIGIN),
          'body_height': BODY_HEIGHT, 'notes': 'Uniform rescale and translation only; raw generator originals preserved. Material-based landmarks are reviewable estimates.',
          'frames': alignments})
    skin = {'subjectKey': 'hero:kkomaMudang', 'skinId': 'military',
            'canvas': {'width': CANVAS, 'height': CANVAS}, 'origin': {'x': 0.5, 'y': 0.875},
            'bodyBounds': {'width': 320, 'height': BODY_HEIGHT}, 'runtimeLimit': 256,
            'clips': clips, 'attackContactFrame': 'attack_01',
            'sourceCount': 74, 'tool': 'built-in image_gen',
            'integration': 'Standalone art package; live game manifest and combat code unchanged.'}
    write(OUT / 'skin.json', skin)
    # Untrimmed 256px atlas cells preserve the common body-frame origin.
    placements, x, y, row_height = {}, 2, 2, 0
    for stem, image in sorted(runtime_images.items()):
        if x+image.width+2 > 2048:
            x, y, row_height = 2, y+row_height+2, 0
        placements[stem] = (x, y)
        x += image.width+2
        row_height = max(row_height, image.height)
    atlas = Image.new('RGBA', (2048, y+row_height+2))
    atlas_frames = {}
    for stem, image in runtime_images.items():
        px, py = placements[stem]
        atlas.alpha_composite(image, (px, py))
        atlas_frames[stem] = {'frame': {'x': px, 'y': py, 'w': image.width, 'h': image.height},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': image.width, 'h': image.height},
            'sourceSize': {'w': image.width, 'h': image.height}}
    key = 'hero-kkomaMudang-military-v2'
    atlas.save(runtime_dir / f'{key}.png', optimize=True)
    write(runtime_dir / f'{key}.json', {'frames': atlas_frames, 'meta': {'image': key+'.png',
          'format': 'RGBA8888', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}})
    art = {'subjectKey': 'hero:kkomaMudang', 'skinId': 'military', 'texture': key,
        'image': f'runtime/{key}.png', 'atlas': f'runtime/{key}.json',
        'origin': {'x': 0.5, 'y': 0.875}, 'bodyHeight': BODY_HEIGHT/8,
        'bodyWidth': 40, 'canvas': {'width': 256, 'height': 256}, 'clips': clips}
    write(OUT / 'manifest.json', {'version': 2, 'scope': 'military-shion-v2',
          'rendererIntegration': False, 'characters': [art]})
    # Standalone GIFs and contact sheets are review artifacts, not replacement art.
    for name, clip in clips.items():
        pictures = []
        for stem in clip['frames']:
            image = Image.open(frames_dir / f'{stem}.png').convert('RGBA')
            image = contain(image, (640, 640))
            background = Image.new('RGB', (640, 680), '#20242f')
            background.paste(image, (0, 30), image)
            draw = ImageDraw.Draw(background)
            draw.text((12, 10), f'{name} / {stem}', fill='white')
            if not name.startswith('fx_'):
                draw.line((0, 590, 640, 590), fill='#414b5d')
                draw.line((320, 582, 320, 598), fill='#d8a6bd', width=2)
            pictures.append(background)
        durations = [round(1000/clip['fps'])] * len(pictures)
        if not clip['loop']:
            durations[-1] += 600
        pictures[0].save(OUT / f'{name}.gif', save_all=True, append_images=pictures[1:],
                         duration=durations, loop=0, optimize=False)
    review_data = {'clips': clips, 'count': 74, 'atlasFrames': atlas_frames, 'atlasImage': f'runtime/{key}.png'}
    html = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>시온 · 모션 미리보기</title><style>*{box-sizing:border-box}body{margin:0;background:#11151e;color:#edf1fa;font:16px system-ui;padding:28px}main{max-width:1120px;margin:auto}h1{font-size:26px;margin:0 0 8px}p{color:#b5bed0}nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}button,select{font:inherit;padding:9px 13px;border:1px solid #424b60;border-radius:7px;background:#202838;color:inherit;cursor:pointer}button.active{border-color:#e98dae;color:#ffc8dd}canvas{display:block;width:min(100%,760px);margin:auto;background:#20242f;border:1px solid #333c4e;border-radius:12px}label{margin:10px;display:inline-block}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:28px}.grid img{width:100%;background:#20242f;border-radius:8px}a{color:#ffc8dd}#status{font-variant-numeric:tabular-nums}</style>
<main><h1>시온 · 전류 대검 모션</h1><p>분홍색 긴 머리 · 전자기 대검 · 링 없음 / 생성 이미지 74장</p><nav id="clips"></nav><button id="pause">일시정지</button><button id="step">다음 프레임</button><label>속도 <select id="speed"><option value="0.5">0.5배</option><option value="1" selected>1배</option><option value="2">2배</option></select></label><label><input id="flip" type="checkbox">좌우 반전</label><p id="status">이미지 불러오는 중</p><canvas id="stage" width="900" height="900"></canvas><p>원본과 정렬본, 재생 순서는 같은 폴더의 frames · alignment.json · skin.json에 있습니다. 현재 게임에는 아직 연결하지 않았습니다.</p><section class="grid" id="gallery"></section></main>
<script>const data=__DATA__;const labels={idle:'대기',walk:'걷기',attack:'공격',hit:'피격',spawn:'등장',death:'퇴장',skill_fan:'Q 충격파',skill_blessing:'W 지원',skill_blade:'E 제압',start:'이동 시작',stop:'정지',turn:'방향 전환',fx_fan:'Q 효과',fx_blessing:'W 효과',fx_blade:'E 효과',fx_saber_edge:'베기 잔상'};const atlas=new Image;atlas.src=data.atlasImage;let clipName='attack',age=0,paused=false,previous=0;const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d');const controls=document.querySelector('#clips');for(const [name,clip]of Object.entries(data.clips)){const button=document.createElement('button');button.textContent=labels[name]||name;button.dataset.clip=name;button.onclick=()=>{clipName=name;age=0;highlight()};controls.append(button);}function highlight(){for(const button of controls.children)button.classList.toggle('active',button.dataset.clip===clipName)}highlight();document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'재생':'일시정지'};document.querySelector('#step').onclick=()=>{paused=true;document.querySelector('#pause').textContent='재생';age+=1/data.clips[clipName].fps};function tick(now){const dt=previous?Math.min(.1,(now-previous)/1000):0;previous=now;if(!paused)age+=dt*Number(document.querySelector('#speed').value);const clip=data.clips[clipName];const duration=clip.frames.length/clip.fps;const time=age%(duration+(clip.loop?0:.6));const index=Math.min(clip.frames.length-1,Math.floor(time*clip.fps));const frame=clip.frames[index];ctx.clearRect(0,0,900,900);ctx.strokeStyle='#465166';ctx.beginPath();ctx.moveTo(0,787.5);ctx.lineTo(900,787.5);ctx.stroke();ctx.save();if(document.querySelector('#flip').checked){ctx.translate(900,0);ctx.scale(-1,1)}const rect=data.atlasFrames[frame].frame;if(atlas.complete&&atlas.naturalWidth)ctx.drawImage(atlas,rect.x,rect.y,rect.w,rect.h,0,0,900,900);ctx.restore();document.querySelector('#status').textContent=(labels[clipName]||clipName)+' · '+(index+1)+' / '+clip.frames.length+' · '+frame;requestAnimationFrame(tick)}requestAnimationFrame(tick);for(const name of ['attack','walk','skill_fan','skill_blessing','skill_blade','death']){const item=document.createElement('div');item.innerHTML='<p>'+labels[name]+'</p><a href="'+name+'.gif"><img loading="lazy" src="'+name+'.gif" alt="'+labels[name]+' GIF"></a>';document.querySelector('#gallery').append(item)}</script></html>'''
    (OUT / 'preview.html').write_text(html.replace('__DATA__', json.dumps(review_data)), encoding='utf-8')
    report = {'sourceImages': len(plan['items']), 'bodyFrames': len(alignments), 'clips': len(clips),
              'atlasSize': list(atlas.size), 'atlasFrames': len(atlas_frames), 'origin': [0.5, 0.875],
              'rawPreserved': True, 'liveGameModified': False}
    write(OUT / 'package-report.json', report)
    with zipfile.ZipFile(REV / 'shion-electromagnetic-v2.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(OUT.rglob('*')):
            if path.is_file():
                archive.write(path, 'shion-electromagnetic-v2/' + path.relative_to(OUT).as_posix())
        for name in ['generation-prompt.txt', 'framing-edit-prompt.txt', 'animation-jobs.json', 'animation-audit.json']:
            archive.write(REV/name, 'shion-electromagnetic-v2/provenance/'+name)
    print(json.dumps(report))


if __name__ == '__main__':
    main()
