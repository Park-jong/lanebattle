"""Commit generated military art per character; never stages unrelated paths."""
from pathlib import Path
import argparse
import json
import sqlite3
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT/'docs/art/military/prompts/jobs.json').read_text(encoding='utf-8'))
STATE = ROOT/'output/art-generation/military-run'


def git(*args, check=True):
    return subprocess.run(['git', *args], cwd=ROOT, encoding='utf-8',
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=check)


parser = argparse.ArgumentParser()
parser.add_argument('--all', action='store_true', help='Snapshot every character now')
parser.add_argument('--ready', action='store_true', help='Commit new required/all checkpoints')
parser.add_argument('--unit')
args = parser.parse_args()
if not (args.all or args.ready or args.unit):
    parser.error('Choose --all, --ready or --unit')
db = sqlite3.connect(STATE/'progress.sqlite3')
db.row_factory = sqlite3.Row
rows = {r['id']: dict(r) for r in db.execute('SELECT id,status,source,metadata FROM jobs')}

for unit in DATA['units']:
    key = unit['subject_key']
    if args.unit and key != args.unit:
        continue
    group, ident = key.split(':')
    jobs = [j for j in DATA['items'] if j['subject_key'] == key]
    generated = [j for j in jobs if rows[j['id']]['status'] == 'generated_pending_qa']
    required = [j for j in jobs if j['priority'] == 'required']
    required_done = all(rows[j['id']]['status'] == 'generated_pending_qa' for j in required)
    checkpoint = 'all' if len(generated) == len(jobs) else 'required' if required_done else 'partial'
    manifest = ROOT/f'docs/art/military/generated/{group}/{ident}.json'
    old = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else {}
    if args.ready and (checkpoint == 'partial' or old.get('checkpoint') == checkpoint):
        continue
    records = []
    for job in generated:
        path = ROOT/job['output']
        if not path.is_file():
            raise FileNotFoundError(path)
        metadata = json.loads(rows[job['id']]['metadata'] or '{}')
        records.append({
            'id': job['id'], 'output': job['output'], 'kind': job['kind'],
            'priority': job['priority'], 'actual_size': metadata.get('size'),
            'target_size': job['target_size'], 'alpha_range': metadata.get('alpha_range'),
            'references': metadata.get('execution_references', job['references']),
            'execution_prompt': metadata.get('prompt_override', job['prompt']),
            'visual_qa': metadata.get('visual_qa', 'pending'),
        })
    snapshot = {
        'subject_key': key, 'name': unit['name'], 'checkpoint': checkpoint,
        'generated': len(generated), 'planned': len(jobs),
        'required_generated': sum(j['priority'] == 'required' for j in generated),
        'required_planned': len(required), 'tool': 'built-in image_gen',
        'delivery_state': 'Raw generated assets; alignment and runtime integration pending',
        'items': records,
    }
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    paths = [unit['source_concept'], f'docs/art/military/prompts/{group}/{ident}-prompts.md',
             manifest.relative_to(ROOT).as_posix()] + [j['output'] for j in generated]
    git('add', '-f', '--', *paths)
    if not git('diff', '--cached', '--quiet', '--', *paths, check=False).returncode:
        print(json.dumps({'unit': key, 'unchanged': True}), flush=True)
        continue
    name = unit['name'].split(' (')[0]
    message = (f'art: {name} 밀리터리 스킨 {checkpoint} 이미지 {len(generated)}개 저장\n\n'
               f'컨셉·프롬프트·생성 원본을 캐릭터 단위로 보존한다.\n'
               f'계획 {len(jobs)}개 중 {len(generated)}개 생성. 크기 정렬과 게임 연결은 미완료.\n')
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', suffix='.txt', delete=False) as stream:
        stream.write(message)
        message_file = Path(stream.name)
    try:
        git('commit', '--only', '--file', str(message_file), '--', *paths)
    finally:
        message_file.unlink(missing_ok=True)
    print(json.dumps({'unit': key, 'name': name, 'checkpoint': checkpoint,
                      'images': len(generated), 'commit': git('rev-parse', '--short', 'HEAD').stdout.strip()},
                     ensure_ascii=False), flush=True)
