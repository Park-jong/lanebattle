"""Record generated shared-art provenance without changing any image pixels."""
from pathlib import Path
import argparse
import json
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('group', choices=['environment', 'bases', 'ui'])
args = parser.parse_args()
data = json.loads((ROOT / 'docs/art/military/prompts/jobs.json').read_text(encoding='utf-8'))
db = sqlite3.connect(ROOT / 'output/art-generation/military-run/progress.sqlite3')
db.row_factory = sqlite3.Row
rows = {r['id']: dict(r) for r in db.execute('SELECT * FROM jobs')}
jobs = [j for j in data['items'] if f'/military-theme/{args.group}/' in j['output']]
records = []
for job in jobs:
    row = rows[job['id']]
    if row['status'] != 'generated_pending_qa':
        continue
    assert (ROOT / job['output']).is_file(), job['id']
    metadata = json.loads(row['metadata'])
    records.append(dict(id=job['id'], output=job['output'], kind=job['kind'],
                        actual_size=metadata.get('size'), target_size=job['target_size'],
                        alpha_range=metadata.get('alpha_range'),
                        references=metadata.get('execution_references', job['references']),
                        execution_prompt=metadata.get('prompt_override', job['prompt']),
                        visual_qa=metadata.get('visual_qa', 'pending')))
manifest = ROOT / f'docs/art/military/generated/theme/{args.group}.json'
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps(dict(group=args.group, generated=len(records), planned=len(jobs),
    tool='built-in image_gen', delivery_state='Raw generated assets; alignment and runtime integration pending',
    items=records), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(group=args.group, generated=len(records), planned=len(jobs))))
