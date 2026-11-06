"""Bookkeeping and review packaging for built-in image_gen Shion revision assets.

This script never generates art or calls an image API. Original generator files,
exact prompts and reference dependencies are preserved for every generated PNG.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import sys

from PIL import Image, ImageDraw
from military_art_prompts import execution_prompt

ROOT = Path(__file__).resolve().parents[1]
REV = ROOT / 'output/art-generation/revisions/shion-electromagnetic-v2'
RAW = REV / 'raw'
PLAN = REV / 'animation-jobs.json'
KEY = 'hero:kkomaMudang'
sys.stdout.reconfigure(encoding='utf-8')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def markdown_prompts(path):
    text = path.read_text(encoding='utf-8')
    return {Path(name).stem: prompt for name, prompt in re.findall(
        r'^#{2,3} `([^`]+)`.*?```text\n(.*?)\n```', text, re.M | re.S)}


def init():
    if PLAN.exists():
        return {'plan': str(PLAN), 'preserved': True}
    RAW.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'docs/art/military/prompts/jobs.json'
    facts_path = ROOT / 'docs/art/military/prompts/character-designs.en.json'
    jobs = read(source)
    facts = read(facts_path)
    selected = [j for j in jobs['items'] if j['subject_key'] == KEY or (
        not j['subject_key'] and '시온' in j['prompt'])]
    assert len(selected) == 74, len(selected)
    write(REV / 'prior-job-definitions.json', {'fact': facts[KEY], 'items': selected})
    facts[KEY] = ('SHION, clearly ADULT woman age23 height172cm, mature curvy athletic build, '
        'natural 7.5-head proportions. Waist-length LOOSE ROSE-PINK HAIR with softly waved ends, '
        'darker roots, lighter tips, black metal hair clip, TEAL EYES. NO PONYTAIL. '
        'OPEN WHITE CROPPED OFFICER JACKET, deep-V opaque BLACK FITTED CROP TOP exposing cleavage '
        'and bare abdomen, BLACK HIGH-WAISTED TACTICAL SHORT SHORTS with side slits exposing thighs, '
        'long asymmetric PLUM HALF-CAPE ATTACHED AT ONE SIDE OF WAIST, black long gloves and '
        'BLACK BELOW-KNEE MILITARY BOOTS. LEFT FOREARM COMMAND GAUNTLET, thigh equipment strap, '
        'waist power module. ONE OVERSIZED ELECTROMAGNETIC GREATSWORD ASTRA almost her height: '
        'BROAD BLACK mechanical frame, SILVER-WHITE edge, LONG SPLIT CYAN-WHITE LUMINOUS CORE, '
        'gunblade-like chamber at guard and a LONG TWO-HANDED GRIP. Small CYAN-WHITE ELECTRIC ARCS '
        'between core and blade. BOTH HANDS grip for attack/recovery; right hand supports sword '
        'during left-gauntlet skills. Composed confident field commander with effortless transcendent '
        'presence. Ground walking, NO HALO, NO FLOATING RING, NO mount, NO drone, NO extra weapon.')
    body_prompts = markdown_prompts(ROOT / 'docs/art/military/prompts/hero/kkomaMudang-prompts.md')
    ui_prompts = markdown_prompts(ROOT / 'docs/art/military/prompts/ui-and-status-prompts.md')
    tasks = []
    source_to_revision = {j['output']: str((RAW / Path(j['output']).name).relative_to(ROOT)).replace('\\', '/') for j in selected}
    units = {u['subject_key']: u for u in jobs['units']}
    for job in selected:
        stem = Path(job['output']).stem
        job['prompt'] = (body_prompts if job['subject_key'] == KEY else ui_prompts)[stem]
        revised = dict(job, output=source_to_revision[job['output']],
                       references=[source_to_revision.get(r, r) for r in job['references']])
        # Required frames also use the preceding pose to keep clip continuity.
        match = re.fullmatch(r'(.+)_(\d\d)', stem)
        if job['kind'] == 'body' and job['priority'] == 'required' and match and int(match[2]) > 0:
            previous = str((RAW / f'{match[1]}_{int(match[2])-1:02}.png').relative_to(ROOT)).replace('\\', '/')
            if previous not in revised['references']:
                revised['references'].append(previous)
        prompt = execution_prompt(revised, facts, units)
        if job['kind'] == 'body':
            prompt += ('\n\nCOMPOSITION LOCK: same camera, scale, right-facing 3/4 view, '
                'adult body proportions and anatomical identity as the FIRST reference. '
                'Show the entire character and whole greatsword with generous transparent margins '
                'even in raised or extended poses. Keep the ground contact line consistent. '
                'Draw only ONE pose, never an animation sheet. Sword metal stays rigid. '
                'Pink loose hair and waist cape lag behind body motion; keep clothing securely in place. '
                'Local cyan-white sword electricity only, no body aura or halo.')
        task = dict(revised, stem=stem, execution_prompt=prompt, status='pending')
        tasks.append(task)
    shutil.copy2(REV / 'idle_00.png', RAW / 'idle_00.png')
    for task in tasks:
        if task['stem'] == 'idle_00':
            task['status'] = 'generated'
            task['source'] = str(REV / 'idle_00.png')
            task['provenance'] = 'Existing new reference, see ../generation.json and original prompts.'
    write(source, jobs)
    write(facts_path, facts)
    write(PLAN, {'version': 1, 'subject_key': KEY, 'revision': REV.name, 'items': tasks})
    return {'total': len(tasks), 'done': 1, 'plan': str(PLAN)}


def ready(limit):
    plan = read(PLAN)
    rank = {'attack': 0, 'walk': 1, 'skill_fan': 2, 'skill_blade': 3,
            'skill_blessing': 4, 'death': 5, 'hit': 6, 'spawn': 7, 'idle': 8}
    def order(job):
        prefix = re.sub(r'_\d+$', '', job['stem'])
        return (job['priority'] == 'motion_extension', rank.get(prefix, 10))
    available = [j for j in sorted(plan['items'], key=order) if j['status'] == 'pending'
                 and all((ROOT / r).is_file() for r in j['references'])]
    return {'done': sum(j['status'] == 'generated' for j in plan['items']),
            'total': len(plan['items']), 'jobs': available[:limit]}


def record(stem, source, replace=False):
    plan = read(PLAN)
    task = next(j for j in plan['items'] if j['stem'] == stem)
    destination = ROOT / task['output']
    if destination.exists() and not replace:
        raise FileExistsError(f'Preserving existing revision image: {destination}')
    with Image.open(source) as image:
        image.load()
        if image.mode != 'RGBA' or image.getchannel('A').getextrema()[0] == 255:
            raise ValueError(f'Actual transparent alpha required for {stem}')
        properties = {'size': list(image.size), 'mode': image.mode,
                      'alpha_range': list(image.getchannel('A').getextrema())}
    if destination.exists():
        rejected = REV / 'rejected'
        rejected.mkdir(exist_ok=True)
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()[:12]
        shutil.copy2(destination, rejected / f'{stem}-{digest}.png')
        task.setdefault('replaced_sources', []).append(task.get('source'))
    shutil.copy2(source, destination)
    task.update(status='generated', source=str(source), tool='built-in image_gen', **properties)
    write(PLAN, plan)
    return {'saved': str(destination), 'done': sum(j['status'] == 'generated' for j in plan['items']), 'total': len(plan['items'])}


def audit():
    plan = read(PLAN)
    missing, issues, hashes = [], [], {}
    for task in plan['items']:
        path = ROOT / task['output']
        if not path.is_file():
            missing.append(task['stem'])
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in hashes:
            issues.append({'stem': task['stem'], 'duplicate': hashes[digest]})
        hashes[digest] = task['stem']
        with Image.open(path) as image:
            image.load()
            if image.mode != 'RGBA' or image.getchannel('A').getextrema()[0] == 255:
                issues.append({'stem': task['stem'], 'issue': 'missing transparency'})
    result = {'total': len(plan['items']), 'files': len(hashes), 'missing': missing, 'issues': issues}
    write(REV / 'animation-audit.json', result)
    return result


def contact():
    plan = read(PLAN)
    groups = {}
    for task in plan['items']:
        if task['status'] != 'generated':
            continue
        groups.setdefault(re.sub(r'_\d+$', '', task['stem']), []).append(task)
    outputs = []
    for group, tasks in groups.items():
        tasks.sort(key=lambda j: j['stem'])
        columns = min(4, len(tasks))
        sheet = Image.new('RGB', (columns * 280, ((len(tasks)+columns-1)//columns) * 350), '#20242f')
        draw = ImageDraw.Draw(sheet)
        for index, task in enumerate(tasks):
            image = Image.open(ROOT / task['output']).convert('RGBA')
            image.thumbnail((268, 318), Image.Resampling.LANCZOS)
            x, y = (index % columns) * 280, (index // columns) * 350
            sheet.paste(image, (x+(280-image.width)//2, y+25+(318-image.height)//2), image)
            draw.text((x+8, y+6), task['stem'], fill='white')
        path = REV / f'review-{group}.jpg'
        sheet.save(path, quality=90)
        outputs.append(str(path))
    return {'sheets': outputs}


parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['init', 'ready', 'record', 'audit', 'contact'])
parser.add_argument('--limit', type=int, default=4)
parser.add_argument('--stem')
parser.add_argument('--source')
parser.add_argument('--replace', action='store_true')
args = parser.parse_args()
result = {'init': init, 'ready': lambda: ready(args.limit),
          'record': lambda: record(args.stem, Path(args.source), args.replace),
          'audit': audit, 'contact': contact}[args.action]()
print(json.dumps(result, ensure_ascii=False))
