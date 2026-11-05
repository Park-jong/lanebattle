"""Install a visually reviewed image_gen correction, preserving both originals."""
from pathlib import Path
import base64
import json
import shutil
import sqlite3
import sys
import time

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'output/art-generation/military-run'
payload = json.loads(base64.b64decode(sys.argv[1]).decode('utf-8'))
jobs = json.loads((ROOT / 'docs/art/military/prompts/jobs.json').read_text(encoding='utf-8'))['items']
job = next(j for j in jobs if j['id'] == payload['id'])
destination = (ROOT / job['output']).resolve()
destination.relative_to(ROOT.resolve())
source = Path(payload['source']).resolve()
with Image.open(source) as image:
    image.load()
    size, mode = list(image.size), image.mode
    alpha = list(image.getchannel('A').getextrema())
    assert mode == 'RGBA' and alpha == [0, 255], (mode, alpha)
db = sqlite3.connect(STATE / 'progress.sqlite3', timeout=30)
db.execute('BEGIN IMMEDIATE')
status, previous_source, raw = db.execute('SELECT status,source,metadata FROM jobs WHERE id=?', (job['id'],)).fetchone()
assert status == 'generated_pending_qa', status
metadata = json.loads(raw or '{}')
archive = STATE / 'rejected' / (job['id'].replace(':', '_') + '-' + str(time.time_ns()) + '.png')
archive.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(destination, archive)
shutil.copy2(source, destination)
metadata.update(size=size, mode=mode, alpha_range=alpha, size_matches=size == job['target_size'],
                prompt_override=payload['prompt'], execution_references=payload['refs'],
                visual_qa=payload['reason'], previous_source=previous_source)
db.execute('UPDATE jobs SET source=?,metadata=?,error=NULL,updated=? WHERE id=?',
           (str(source), json.dumps(metadata, ensure_ascii=False), time.time(), job['id']))
db.commit()
event = dict(id=job['id'], event='corrected', source=str(source), previous_source=previous_source,
             archive=str(archive), reason=payload['reason'], metadata=metadata)
for name in ['generated.jsonl', 'qa.jsonl']:
    with (STATE / name).open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(event, ensure_ascii=False) + '\n')
print(json.dumps(dict(id=job['id'], size=size, alpha=alpha, corrected=True)))
