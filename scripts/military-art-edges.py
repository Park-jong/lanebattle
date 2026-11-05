"""Read-only border check; flagged sprites still require visual inspection."""
from pathlib import Path
from collections import Counter
import json
import sqlite3

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'output/art-generation/military-run'
jobs = json.loads((ROOT / 'docs/art/military/prompts/jobs.json').read_text(encoding='utf-8'))['items']
db = sqlite3.connect(f'file:{STATE / "progress.sqlite3"}?mode=ro', uri=True)
ready = {r[0] for r in db.execute("SELECT id FROM jobs WHERE status='generated_pending_qa'")}
results = []
for job in jobs:
    if job['kind'] != 'body' or job['id'] not in ready:
        continue
    with Image.open(ROOT / job['output']) as image:
        alpha = image.getchannel('A')
        w, h = image.size
        strips = {'left': (0, 0, 1, h), 'right': (w-1, 0, w, h),
                  'top': (0, 0, w, 1), 'bottom': (0, h-1, w, h)}
        edges = {key: sum(count for value, count in enumerate(alpha.crop(box).histogram()) if value >= 128)
                 for key, box in strips.items()}
        if max(edges.values()) > 6:
            results.append({'id': job['id'], 'edges': edges, 'output': job['output']})
(STATE / 'edge-review.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'count': len(results), 'by_unit': dict(Counter(r['id'].rsplit(':', 1)[0] for r in results)),
                  'items': results}))
