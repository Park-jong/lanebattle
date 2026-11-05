"""Read-only validation of generated military PNGs and their provenance."""
from collections import Counter
from pathlib import Path
import json
import sqlite3

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'output/art-generation/military-run'
jobs = json.loads((ROOT / 'docs/art/military/prompts/jobs.json').read_text(encoding='utf-8'))['items']
db = sqlite3.connect(f'file:{STATE / "progress.sqlite3"}?mode=ro', uri=True)
db.row_factory = sqlite3.Row
rows = {row['id']: dict(row) for row in db.execute('SELECT * FROM jobs')}
sizes, statuses, issues = Counter(), Counter(), []
checked = 0
for job in jobs:
    row = rows[job['id']]
    statuses[row['status']] += 1
    if row['status'] != 'generated_pending_qa':
        continue
    try:
        path = ROOT / job['output']
        with Image.open(path) as image:
            image.load()
            checked += 1
            sizes[str(image.size)] += 1
            if job['transparent_background']:
                if 'A' not in image.getbands():
                    issues.append({'id': job['id'], 'issue': 'missing alpha channel'})
                elif image.getchannel('A').getextrema()[0] == 255:
                    issues.append({'id': job['id'], 'issue': 'fully opaque canvas'})
        metadata = json.loads(row['metadata'] or '{}')
        if not row['source'] or not Path(row['source']).is_file():
            issues.append({'id': job['id'], 'issue': 'missing preserved generator original'})
        if not metadata:
            issues.append({'id': job['id'], 'issue': 'missing generation metadata'})
    except Exception as error:
        issues.append({'id': job['id'], 'issue': str(error)})
report = {'total': len(jobs), 'checked_files': checked, 'statuses': dict(statuses),
          'actual_sizes': dict(sizes), 'issues': issues,
          'scope': 'File readability, alpha presence and provenance only. Visual continuity, canvas alignment and runtime integration require separate review.'}
(STATE / 'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
