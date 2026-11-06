"""Local visual/lifecycle/performance check. Requires Python Playwright and a running Vite dev server.

python scripts/verify-pixelfx.py --url http://127.0.0.1:5177
Only the test browser receives a game handle; no debug globals are shipped in the application.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5177')
parser.add_argument('--smoke-only', action='store_true')
args = parser.parse_args()
out = Path(__file__).resolve().parents[1] / 'output' / 'pixelfx-verification'
out.mkdir(parents=True, exist_ok=True)

SETUP = """async () => {
  const game = window.__qaGame, scene = game.scene.getScene('Battle');
  game.loop.sleep();
  const { SeededRng } = await import('/src/battle/rng.ts');
  const { Battle } = await import('/src/battle/battle.ts');
  const b = new Battle({ stage: scene.battle.stage, rng: new SeededRng(42) });
  scene.battle = b;
  scene.baseViews[0].base = b.shrine; scene.baseViews[1].base = b.castle;
  b.hero.x = 1000; b.hero.hp = b.hero.maxHp = 100000; b.hero.facing = 1;
  b.shrine.hp = b.shrine.maxHp = b.castle.hp = b.castle.maxHp = 1000000;
  b.enemies = []; b.allies = []; b.projectiles = [];
  for (const id of ['clubGoblin', 'foxfireArcher', 'gumiho', 'bulgasari', 'haetae', 'magpieFlock']) b.spawnFreeAllies(id, 3);
  b.allies.forEach((a, i) => { a.x = 910 - i * 6; a.hp = a.maxHp = 100000; });
  for (let i = 0; i < 25; i++) {
    const e = b.spawnEnemy(['eggGhost', 'waterGhostThrower', 'jangseungSpirit', 'maidenGhost'][i % 4], false, 1060 + i * 7);
    e.hp = e.maxHp = 100000;
  }
  window.__qaScene = scene; window.__qaTick = 0;
  game.step(0, 16.6667);
  return { allies: b.allies.length, enemies: b.enemies.length, skin: new URLSearchParams(location.search).get('skin') };
}"""

BENCHMARK = """async () => {
  const game = window.__qaGame, s = window.__qaScene, times = [], intervals = [];
  let previous = performance.now(), peak = 0;
  // Same fixed-step battle and seed, with/without cosmetic effects. RAF submits each frame to the GPU.
  for (let i = 0; i < 180; i++) {
    await new Promise(requestAnimationFrame);
    const now = performance.now();
    if (i >= 30) intervals.push(now - previous);
    previous = now;
    const start = performance.now();
    game.step(++window.__qaTick * 16.6667, 16.6667);
    if (i >= 30) times.push(performance.now() - start);
    peak = Math.max(peak, s.effects.playback.entries.length);
  }
  times.sort((a,b) => a-b); intervals.sort((a,b) => a-b);
  const pages = (await import('/src/render/pixelfxManifest.ts')).PIXELFX.pages;
  const loaded = pages.filter(p => s.textures.exists(p.texture));
  return { meanStepMs: times.reduce((a,b) => a+b,0) / times.length,
    p95StepMs: times[Math.floor(times.length * .95)], medianFrameMs: intervals[Math.floor(intervals.length / 2)],
    peakEffects: peak, images: s.effects.nodes.size + s.effects.free.length,
    textureBytes: loaded.reduce((n,p) => n + p.width * p.height * 4, 0),
    heapBytes: performance.memory?.usedJSHeapSize ?? null,
    loadedEffectPages: loaded.length, elapsed: s.battle.elapsed,
    health: [s.battle.hero.hp, s.battle.shrine.hp, ...s.battle.enemies.map(e => e.hp)],
    resources: [s.battle.resources.spirit, s.battle.resources.talisman] };
}"""

reports = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--enable-precise-memory-info'])
    for skin in ([] if args.smoke_only else ['military', 'default']):
        for enabled in [False, True]:
            context = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
            page = context.new_page()
            errors, failed_assets = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failed_assets.append(response.url) if response.status >= 400 else None)
            page.route('**/src/main.ts*', lambda route: route.fulfill(content_type='application/javascript',
                body="import { startGame } from '/src/startGame.ts'; window.__qaGame = startGame();"))
            url = f'{args.url}/?stage=0&skin={skin}' + ('' if enabled else '&vfx=off')
            page.goto(url)
            page.wait_for_function("window.__qaGame?.scene.isActive('Battle')", timeout=30000)
            page.evaluate(SETUP)
            report = page.evaluate(BENCHMARK)
            report['errors'], report['failedAssets'] = errors, failed_assets
            if enabled:
                # Actual cast -> simulation hit -> VFX, with an injured ally for healing feedback.
                page.evaluate("""() => {
                  const s=window.__qaScene,b=s.battle,g=window.__qaGame;
                  b.hero.status.clear(); b.hero.hp -= 100; b.resources.spirit=100;
                  b.castSkill('blessing');
                  for(let i=0;i<8;i++) g.step(++window.__qaTick*16.6667,16.6667);
                }""")
                page.screenshot(path=str(out / f'{skin}-healing.png'))
                page.evaluate("""() => {
                  const s=window.__qaScene,b=s.battle,g=window.__qaGame;
                  b.resources.spirit=100; b.castSkill('bladeDance');
                  for(let i=0;i<5;i++) g.step(++window.__qaTick*16.6667,16.6667);
                }""")
                page.screenshot(path=str(out / f'{skin}-blade-dance.png'))
                lifecycle = page.evaluate("""() => {
                  const s=window.__qaScene,g=window.__qaGame;
                  s.paused=true;
                  const before=s.effects.playback.entries.map(f=>[f.id,f.age]);
                  for(let i=0;i<20;i++) g.step(++window.__qaTick*16.6667,16.6667);
                  const after=s.effects.playback.entries.map(f=>[f.id,f.age]);
                  s.paused=false;
                  // Catch-up drains old hit/cast events and does not show their burst.
                  s.catchUp.hide(0,false); s.catchUp.show(3000,false);
                  g.step(++window.__qaTick*16.6667,16.6667);
                  const cleared=s.effects.playback.entries.length===0;
                  return {pauseFrozen:JSON.stringify(before)===JSON.stringify(after),catchUpCleared:cleared};
                }""")
                report['lifecycle'] = lifecycle
                assert lifecycle['pauseFrozen'] and lifecycle['catchUpCleared'], lifecycle
            key = f'{skin}-' + ('on' if enabled else 'off')
            reports[key] = report
            assert not errors, errors
            assert not failed_assets, failed_assets
            assert report['peakEffects'] <= 64 and report['images'] <= 64, report
            print(key, json.dumps({k: v for k, v in report.items() if k not in ['health', 'resources']}, ensure_ascii=False))
            context.close()
        off, on = reports[f'{skin}-off'], reports[f'{skin}-on']
        assert off['health'] == on['health'] and off['resources'] == on['resources'], 'Cosmetics changed combat outcome'
    smoke = {}
    for name, query in [
        ('military-review', 'stage=0&skin=military'),
        ('possession', 'stage=0&skin=military&upg=clubGoblinPossess'),
        ('boss', 'stage=19&skin=military&bossAt=0'),
    ]:
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/src/main.ts*', lambda route: route.fulfill(content_type='application/javascript',
            body="import { startGame } from '/src/startGame.ts'; window.__qaGame = startGame();"))
        page.goto(f'{args.url}/?{query}')
        page.wait_for_function("window.__qaGame?.scene.isActive('Battle')", timeout=30000)
        result = page.evaluate("""async (name) => {
          const g=window.__qaGame,s=g.scene.getScene('Battle'),b=s.battle;
          g.loop.sleep(); window.__qaScene=s; window.__qaTick=0;
          const tick=(n=1)=>{for(let i=0;i<n;i++)g.step(++window.__qaTick*16.6667,16.6667);};
          b.hero.x=1000;b.hero.hp=170;b.resources.spirit=100;b.allies=[];b.projectiles=[];
          const boss=b.encounter?.boss;
          b.enemies=boss?[boss]:[];
          if(boss){boss.x=1160;boss.hp=1000;boss.setFlying(true);}
          else {
            b.spawnFreeAllies('clubGoblin',1);b.spawnFreeAllies('foxfireArcher',1);
            b.allies.forEach((a,i)=>a.x=820+i*65);
            for(let i=0;i<3;i++){const e=b.spawnEnemy(i?'eggGhost':'jangseungSpirit',false,1120+i*70);e.hp=e.maxHp=10000;}
          }
          b.step=()=>{};tick(35);s.effects.playback.clear();s.effects.render();
          if(name==='boss'){
            boss.setFlying(false);tick();
            const landed=s.effects.playback.entries.some(f=>f.clip==='slam');
            b.dealFixedDamage(boss,100000,{type:'magic',tags:['hero'],source:'hero'});tick(4);
            return {landed,death:s.effects.playback.entries.some(f=>f.clip==='explosion')};
          }
          if(name==='possession'){
            b.castSkill('blessing');tick(3);
            const support=s.effects.playback.entries.some(f=>f.clip==='rune')&&!s.effects.playback.entries.some(f=>f.clip==='explosion');
            b.hero.facing=-1;b.castSkill('fanWind');tick(3);
            return {support,left:s.effects.playback.entries.some(f=>f.clip==='blades'&&f.facing===-1)};
          }
          const flying=b.enemies[0];flying.setFlying(true);flying.status.stun(2,false);tick();
          const mark=s.effects.statuses.get(flying),flyingAligned=!!mark&&Math.abs(mark.y-(s.field.top(flying)-6))<.001;
          flying.setFlying(false);flying.status.clear();
          const castleX=b.castle.x;b.castle.x=1240;
          b.dealFixedDamage(b.castle,10,{type:'ranged',tags:[],source:'hero'});tick();
          const baseHit=s.effects.playback.entries.some(f=>f.clip==='bullet'&&f.x===1240);b.castle.x=castleX;
          s.effects.playback.clear();b.castSkill('bladeDance');tick(7);
          return {flyingAligned,baseHit,skill:s.effects.playback.entries.some(f=>f.clip==='blades')};
        }""", name)
        assert all(result.values()), (name, result)
        if name == 'military-review':
            page.evaluate("""() => { for(let i=0;i<5;i++)window.__qaGame.step(++window.__qaTick*16.6667,16.6667); }""")
        page.screenshot(path=str(out / f'{name}.png'))
        if name == 'boss':
            page.evaluate("""async () => {
              const s=window.__qaScene;
              window.__qaOldEffects=s.effects;
              window.__qaOldImages=[...s.effects.nodes.values(),...s.effects.free];
              (await import('/src/game/skin.ts')).gameSkin.set('default');
              s.scene.restart();window.__qaGame.loop.wake();
            }""")
            page.wait_for_function("window.__qaGame.scene.isActive('Battle') && window.__qaGame.scene.getScene('Battle').effects !== window.__qaOldEffects", timeout=30000)
            cleanup = page.evaluate("""() => {
              const s=window.__qaGame.scene.getScene('Battle');
              return {destroyed:window.__qaOldImages.every(n=>!n.color.scene&&!n.glow.scene),
                skinLoaded:s.effects.skin==='default'&&s.textures.exists('pixelfx-default-0')};
            }""")
            assert all(cleanup.values()), cleanup
            result.update(cleanup)
        assert not errors, errors
        smoke[name] = result
        context.close()
    reports['smoke'] = smoke
    browser.close()
(out / ('smoke-report.json' if args.smoke_only else 'report.json')).write_text(
    json.dumps(reports, indent=2, ensure_ascii=False), encoding='utf8')
print(f'Artifacts: {out}')
