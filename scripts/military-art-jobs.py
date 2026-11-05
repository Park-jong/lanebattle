"""Resume-safe bookkeeping for built-in image generation; never calls an image API."""
from pathlib import Path
import argparse
import base64
import json
import re
import shutil
import sqlite3
import sys
import time

from PIL import Image
from military_art_prompts import execution_prompt

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parents[1]
JOBS = ROOT / 'docs/art/military/prompts/jobs.json'
STATE = ROOT / 'output/art-generation/military-run'
STATE.mkdir(parents=True, exist_ok=True)
DATA = json.loads(JOBS.read_text(encoding='utf-8'))
DB = STATE / 'progress.sqlite3'


def within(path):
    path.resolve().relative_to(ROOT.resolve())
    return path


def effective_job(job):
    job=dict(job,references=list(job['references']))
    if job['kind']=='body' and job['priority']=='required':
        stem=Path(job['output']).stem
        match=re.match(r'(.+)_(\d+)$',stem)
        if match and int(match.group(2))>0:
            previous=str(Path(job['output']).with_name(match.group(1)+'_'+str(int(match.group(2))-1).zfill(2)+'.png')).replace('\\','/')
            if any(j['output']==previous for j in DATA['items']) and previous not in job['references']:
                job['references'].append(previous)
    return job


def connect():
    db = sqlite3.connect(DB, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, position INTEGER, status TEXT, attempts INTEGER DEFAULT 0, source TEXT, metadata TEXT, error TEXT, updated REAL)')
    db.executemany('INSERT OR IGNORE INTO jobs (id,position,status,updated) VALUES (?, ?, ?, ?)',
                   [(j['id'], i, 'pending', time.time()) for i, j in enumerate(DATA['items'])])
    db.commit()
    return db


def status(db):
    counts = {r['status']: r['n'] for r in db.execute('SELECT status,COUNT(*) AS n FROM jobs GROUP BY status')}
    result = dict(total=len(DATA['items']), counts=counts, state=str(STATE),
                  recent=[dict(r) for r in db.execute('SELECT id,status,error FROM jobs ORDER BY updated DESC LIMIT 4')])
    (STATE/'status.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    rows={r['id']:dict(r) for r in db.execute('SELECT id,status,metadata FROM jobs')}
    generated=sum(r['status']=='generated_pending_qa' for r in rows.values())
    lines=['# 밀리터리 스킨 이미지 생성 기록', '', '생성 도구: 내장 image_gen · 전체 작업: '+str(len(DATA['items']))+'개', '',
           '현재 생성 파일 '+str(generated)+'개. 작업별 검수·원본 크기 정렬·애니메이션 연결은 별도 상태로 관리한다. 이 기록은 전체 제작 완료를 의미하지 않는다.', '',
           '[전체 프롬프트](prompts/README.md) · [개별 컨셉 목록](README.md)', '',
           '## 종류별 생성 상태', '', '| 이름 | 대상 키 | 생성 수 | 기준 원화 검수 |', '| --- | --- | --- | --- |']
    for unit in DATA['units']:
        key=unit['subject_key']
        count=sum(rows[j['id']]['status']=='generated_pending_qa' for j in DATA['items'] if j['subject_key']==key)
        record=rows.get(key+':idle_00',{})
        metadata=json.loads(record.get('metadata') or '{}')
        qa=metadata.get('visual_qa','미생성')
        reference=next(j for j in DATA['items'] if j['id']==key+':idle_00')
        label='['+unit['name']+'](../../../'+reference['output']+')' if (ROOT/reference['output']).is_file() else unit['name']
        lines.append('| '+label+' | `'+key+'` | '+str(count)+' | '+qa.replace('|','/')+' |')
    lines+=['', '## 원본·진행 파일', '',
            '- 캐릭터 원본: `output/art-generation/source-assets/<분류>/<종류ID>/military/`.',
            '- 배경·기지·UI 원본: `output/art-generation/military-theme/`.',
            '- 작업 상태: `output/art-generation/military-run/progress.sqlite3` 및 `status.json`.',
            '- 생성 출처·실제 프롬프트·해상도: `output/art-generation/military-run/generated.jsonl`.',
            '- 외형 불일치 결과는 같은 run 폴더의 `rejected/`에 보존하고 후속 동작의 참조에서 제외한다.',
            '- 생성 출력의 원래 RGBA와 투명 알파를 보존한다. 목표 크기와 다른 파일은 기록 후 정렬 검수 대상으로 남긴다.', '']
    (ROOT/'docs/art/military/GENERATED.md').write_text('\n'.join(lines),encoding='utf-8')
    return result


parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['status','claim','finish','fail','job','release','reject','accept','reconcile'])
parser.add_argument('--payload')
parser.add_argument('--roots', action='store_true')
args = parser.parse_args()
payload = json.loads(base64.b64decode(args.payload).decode('utf-8')) if args.payload else {}
db = connect()

if args.action == 'status':
    print(json.dumps(status(db), ensure_ascii=False))
elif args.action == 'job':
    print(json.dumps(next(j for j in DATA['items'] if j['id']==payload['id']), ensure_ascii=False))
elif args.action == 'claim':
    db.execute('BEGIN IMMEDIATE')
    states = {r['id']: r['status'] for r in db.execute('SELECT id,status FROM jobs')}
    completed_outputs = {j['output'] for j in DATA['items'] if states[j['id']]=='generated_pending_qa'}
    candidates = DATA['items']
    if args.roots:
        candidates = [j for j in candidates if j['kind']=='body' and not j['references']]
    else:
        ranks={'required':0,'theme_support':1,'motion_extension':2}
        candidates=sorted(candidates,key=lambda j:ranks[j['priority']])
    candidates=[effective_job(j) for j in candidates]
    chosen = None if (STATE/'HOLD').exists() else next((j for j in candidates if states[j['id']]=='pending'
                   and all(ref in completed_outputs and within(ROOT/ref).is_file() for ref in j['references'])),None)
    if chosen:
        db.execute('UPDATE jobs SET status=?,attempts=attempts+1,updated=? WHERE id=?',('generating',time.time(),chosen['id']))
        db.execute('UPDATE jobs SET metadata=? WHERE id=?',(json.dumps({'claimed_references':chosen['references']}),chosen['id']))
        facts_file=ROOT/'docs/art/military/prompts/character-designs.en.json'
        if facts_file.exists():
            facts=json.loads(facts_file.read_text(encoding='utf-8'))
            chosen=dict(chosen,execution_prompt=execution_prompt(chosen,facts,{u['subject_key']:u for u in DATA['units']}))
    db.commit()
    print(json.dumps(chosen,ensure_ascii=False))
elif args.action == 'finish':
    job = next(j for j in DATA['items'] if j['id']==payload['id'])
    claimed_row=db.execute('SELECT metadata FROM jobs WHERE id=?',(job['id'],)).fetchone()
    claimed_metadata=json.loads(claimed_row['metadata'] or '{}')
    hint = payload['output_hint']
    match = re.search(r' as (.+?\.png) by default',hint)
    if not match:
        raise ValueError('Image tool returned no recognizable saved PNG path')
    source = Path(match.group(1))
    if not source.is_file():
        raise FileNotFoundError(source)
    destination = within(ROOT/job['output'])
    if destination.exists():
        raise FileExistsError(f'Preserving existing image: {destination}')
    with Image.open(source) as im:
        im.verify()
    with Image.open(source) as im:
        alpha = im.getchannel('A').getextrema() if 'A' in im.getbands() else None
        metadata = dict(size=list(im.size),mode=im.mode,alpha_range=alpha,
                        target_size=job['target_size'],size_matches=list(im.size)==job['target_size'],
                        transparency_requested=job['transparent_background'],tool='built-in image_gen',
                        visual_qa=payload.get('visual_qa','pending'),prompt_override=payload.get('prompt_override'),
                        execution_references=claimed_metadata.get('claimed_references',job['references']))
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,destination)
    db.execute('UPDATE jobs SET status=?,source=?,metadata=?,error=NULL,updated=? WHERE id=?',
               ('generated_pending_qa',str(source),json.dumps(metadata,ensure_ascii=False),time.time(),job['id']))
    db.commit()
    record=dict(job_id=job['id'],output=job['output'],source=str(source),metadata=metadata)
    with (STATE/'generated.jsonl').open('a',encoding='utf-8') as stream:
        stream.write(json.dumps(record,ensure_ascii=False)+'\n')
    status(db)
    print(json.dumps(record,ensure_ascii=False))
elif args.action == 'fail':
    db.execute('UPDATE jobs SET status=?,error=?,updated=? WHERE id=?',('failed',payload.get('error','generation failed'),time.time(),payload['id']))
    db.commit()
    print(json.dumps(dict(id=payload['id'],status='failed'),ensure_ascii=False))
elif args.action == 'release':
    db.execute('UPDATE jobs SET status=?,updated=? WHERE id=? AND status=?',('pending',time.time(),payload['id'],'generating'))
    db.commit()
    print(json.dumps(dict(id=payload['id'],status='pending'),ensure_ascii=False))
elif args.action == 'reject':
    job = next(j for j in DATA['items'] if j['id']==payload['id'])
    path = within(ROOT/job['output'])
    archive = within(STATE/'rejected'/(job['id'].replace(':','-').replace('/','-')+'-'+str(time.time_ns())+'.png'))
    if path.exists():
        archive.parent.mkdir(parents=True,exist_ok=True)
        shutil.move(str(path),str(archive))
    db.execute('UPDATE jobs SET status=?,error=?,updated=? WHERE id=?',('pending',payload['reason'],time.time(),job['id']))
    db.commit()
    with (STATE/'qa.jsonl').open('a',encoding='utf-8') as stream:
        stream.write(json.dumps(dict(id=job['id'],decision='rejected',reason=payload['reason'],archive=str(archive)),ensure_ascii=False)+'\n')
    print(json.dumps(dict(id=job['id'],status='pending',archive=str(archive)),ensure_ascii=False))
elif args.action == 'accept':
    row = db.execute('SELECT metadata FROM jobs WHERE id=?',(payload['id'],)).fetchone()
    metadata = json.loads(row['metadata'])
    metadata['visual_qa']='accepted reference: '+payload.get('note','inspected')
    db.execute('UPDATE jobs SET metadata=?,updated=? WHERE id=?',(json.dumps(metadata,ensure_ascii=False),time.time(),payload['id']))
    db.commit()
    print(json.dumps(dict(id=payload['id'],visual_qa=metadata['visual_qa']),ensure_ascii=False))
elif args.action == 'reconcile':
    recovered=[]
    for job in DATA['items']:
        row=db.execute('SELECT * FROM jobs WHERE id=?',(job['id'],)).fetchone()
        path=within(ROOT/job['output'])
        if row['status']=='failed' and path.is_file() and row['source'] and row['metadata']:
            with Image.open(path) as im:
                im.verify()
            metadata=json.loads(row['metadata'])
            if 'size' in metadata:
                metadata['console_recovered']=True
                db.execute('UPDATE jobs SET status=?,metadata=?,error=NULL,updated=? WHERE id=?',('generated_pending_qa',json.dumps(metadata,ensure_ascii=False),time.time(),job['id']))
                recovered.append(job['id'])
    db.commit()
    status(db)
    print(json.dumps(dict(recovered=recovered),ensure_ascii=False))
