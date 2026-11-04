import { describe, expect, it } from 'vitest';
import { NEAREST_REACH, POSSESSION_COMMON, POSSESSION_SKILLS, POSSESSION_SLOTS } from '../data/possession';
import type { SkillId } from '../data/skills';
import { possessionNodeId } from '../data/upgrades';
import { computeBuildEffects } from '../game/buildEffects';
import { Battle } from './battle';
import type { Fighter } from './entities';
import { PossessionSkillRunner } from './possession';
import { SeededRng } from './rng';

const HX = 1000;
const BIG_HP = 100000;

/** 유닛에 빙의한 전투: 영웅은 x=1000에서 오른쪽을 보고, 신력은 가득 */
function possess(unitId: string | null, levels: Record<string, number> = {}, stage = 0, bossAt?: number): Battle {
  const modifiers = computeBuildEffects({ ...(unitId ? { [possessionNodeId(unitId)]: 1 } : {}), ...levels });
  const b = new Battle({ stage, rng: new SeededRng(1), modifiers, bossAt });
  b.hero.x = HX;
  b.resources.spirit = b.resources.maxSpirit;
  return b;
}

/** 영웅에서 dx만큼 떨어진 적. 맞아도 죽지 않도록 체력을 키운다 */
function foe(b: Battle, id: string, dx: number, hp = BIG_HP): Fighter {
  const e = b.spawnEnemy(id, false, b.hero.x + dx);
  e.maxHp = e.hp = hp;
  return e;
}

const lost = (e: Fighter) => BIG_HP - e.hp;

/** 부적 없이 아군 한 마리를 x에 둔다 */
function allyAt(b: Battle, id: string, x: number): Fighter {
  b.spawnFreeAllies(id, 1);
  const a = b.allies[b.allies.length - 1];
  a.x = x;
  return a;
}

/** 스킬 쿨타임을 지운다 */
function resetCooldown(b: Battle, id: SkillId): void {
  (b as unknown as { skillCooldowns: { start(id: SkillId, seconds: number): void } }).skillCooldowns.start(id, 0);
}

/** 시간을 n초 진행 (0.05 단위) */
const advance = (b: Battle, seconds: number) => b.step(seconds);

/** 보스 스테이지(챕터 c)에서 보스를 바로 등장시키고, 영웅을 보스 왼쪽 dx에 둔다 */
function bossFight(unitId: string, chapter: number, dx: number, levels: Record<string, number> = {}) {
  const b = possess(unitId, levels, (chapter - 1) * 5 + 4, 0);
  b.step(0.05);
  const boss = b.encounter!.boss!;
  b.hero.x = boss.x - dx;
  b.hero.facing = 1;
  return { b, boss };
}

describe('빙의 변신: 태그·약점', () => {
  it('영웅 태그에 유닛 태그가 더해진다 (여우불 = 영웅·불, 방망이병 = 영웅·도깨비, 외다리 = 영웅·도깨비·바람)', () => {
    expect(possess('foxfireArcher').heroForm!.tags).toEqual(['hero', 'fire']);
    expect(possess('clubGoblin').heroForm!.tags).toEqual(['hero', 'dokkaebi']);
    expect(possess('oneLegGoblin').heroForm!.tags).toEqual(['hero', 'dokkaebi', 'wind']);
    expect(possess(null).heroForm).toBeNull();
  });

  it('여우불 빙의 기본 공격은 불 약점 보스(거대 원귀)에게 ×2: 25 x 2 = 50', () => {
    const { b, boss } = bossFight('foxfireArcher', 1, 100);
    b.drainDamageEvents();
    let hit;
    for (let i = 0; i < 40 && !hit; i++) {
      b.step(0.05);
      hit = b.drainDamageEvents().find((e) => e.target === boss && e.kind !== 'burn');
    }
    expect(hit).toMatchObject({ amount: 50, kind: 'weak' });
  });

  it('차사왕의 영웅 약점은 빙의해도 유지: 방망이병 기본 공격 25 x 2 = 50', () => {
    const { b, boss } = bossFight('clubGoblin', 5, 30);
    b.drainDamageEvents();
    let hit;
    for (let i = 0; i < 10 && !hit; i++) {
      b.step(0.05);
      hit = b.drainDamageEvents().find((e) => e.target === boss && e.kind !== 'burn');
    }
    expect(hit).toMatchObject({ amount: 50, kind: 'weak' });
  });
});

describe('빙의 변신: 체력·이동·비행', () => {
  it('체력·이동 속도·부활은 영웅 값, 무당 트리 효과도 그대로', () => {
    const plain = possess(null, { sturdyBody: 2, quickRevive: 2 });
    const form = possess('haetae', { sturdyBody: 2, quickRevive: 2 });
    expect(form.hero.maxHp).toBe(plain.hero.maxHp);
    expect(form.hero.maxHp).toBeCloseTo(390);
    form.step(0.05, { moveDir: 1 });
    expect(form.hero.x).toBeCloseTo(HX + 160 * 0.05); // 해태 속도 35가 아니라 영웅 속도 160
  });

  it('비행 유닛(삼족오·까치 떼)에 빙의해도 영웅은 땅 위에서 근접 공격을 받는다', () => {
    for (const unitId of ['samjokgo', 'magpieFlock']) {
      const b = possess(unitId);
      expect(b.hero.flying).toBe(false);
      const e = b.spawnEnemy('eggGhost', false, HX + 8);
      e.maxHp = e.hp = BIG_HP;
      b.hero.hp = b.hero.maxHp;
      b.step(0.1);
      expect(b.hero.hp, unitId).toBeLessThan(b.hero.maxHp);
    }
  });

  it('빙의가 없으면 기존과 같다: 근접 사거리 50, 태그 영웅, 부채 바람 30신력', () => {
    const b = possess(null);
    expect(b.heroForm).toBeNull();
    expect(b.hero.possessedId).toBeNull();
    const near = foe(b, 'geuseundae', 60); // 60 - 14 = 46 <= 50
    const far = foe(b, 'geuseundae', 90);
    b.step(0.05);
    expect(lost(near)).toBe(25);
    expect(lost(far)).toBe(0);
    b.resources.spirit = 100;
    b.castSkill('fanWind');
    expect(b.resources.spirit).toBeLessThan(100 - 29);
    expect(b.possessionSkillsActive).toBe(false);
  });
});

describe('빙의 기본 공격', () => {
  it('여우불 사수: 원거리, 사거리 180, 화상 4 (② 적용 시 7), 공격력은 영웅 값 25', () => {
    const b = possess('foxfireArcher');
    expect(b.heroForm).toMatchObject({ attackType: 'ranged', range: 180, burnPerSec: 4 });
    const inRange = foe(b, 'geuseundae', 190); // 190 - 14 = 176 <= 180
    b.step(0.05);
    expect(b.projectiles).toHaveLength(1);
    const p = b.projectiles[0];
    expect(p).toMatchObject({ damage: 25, attackType: 'ranged', team: 'ally' });
    expect(p.target).toBe(inRange);
    expect(p.payload).toMatchObject({ burnPerSec: 4, source: 'hero', areaRadius: 0 });
    advance(b, 1);
    expect(inRange.hp).toBeLessThan(BIG_HP - 24);
    expect(inRange.status!.burnDps).toBe(4);

    const out = possess('foxfireArcher');
    foe(out, 'geuseundae', 200); // 186 > 180
    out.step(0.05);
    expect(out.projectiles).toHaveLength(0);

    const upgraded = possess('foxfireArcher', { foxfireArcherBasic: 1, foxfireArcherCore: 1 });
    expect(upgraded.heroForm!.burnPerSec).toBe(7);
    foe(upgraded, 'geuseundae', 100);
    upgraded.step(0.05);
    expect(upgraded.projectiles[0].damage).toBe(25); // ① 공격력 +25%는 영웅에 적용되지 않는다
    expect(upgraded.projectiles[0].payload.burnPerSec).toBe(7);
  });

  it('방울 단련은 빙의 기본 공격에도 반영된다 (25 x 1.3 = 32.5)', () => {
    const b = possess('foxfireArcher', { bellTraining: 3 });
    foe(b, 'geuseundae', 100);
    b.step(0.05);
    expect(b.projectiles[0].damage).toBeCloseTo(32.5);
  });

  it('구미호: 마법, 사거리 160, 범위 60 (② 적용 시 84)와 화상 6, 범위 안 다른 적도 맞는다', () => {
    const b = possess('gumiho');
    expect(b.heroForm).toMatchObject({ attackType: 'magic', range: 160, areaRadius: 60, burnPerSec: 6 });
    const main = foe(b, 'geuseundae', 100);
    const near = foe(b, 'geuseundae', 150); // 주 대상에서 50 - 14 = 36 <= 60
    const far = foe(b, 'geuseundae', 200); // 100 - 14 = 86 > 60
    b.step(0.05);
    expect(b.projectiles[0].attackType).toBe('magic');
    advance(b, 0.5);
    expect(lost(main)).toBeGreaterThanOrEqual(25);
    expect(lost(near)).toBeGreaterThanOrEqual(25);
    expect(lost(far)).toBe(0);
    expect(main.status!.burnDps).toBe(6);

    const wide = possess('gumiho', { gumihoBasic: 1, gumihoCore: 1 });
    expect(wide.heroForm!.areaRadius).toBeCloseTo(84);
  });

  it('불가사리: 근접(영웅 사거리 50)이고 맞을 때마다 방어 파괴 1중첩, ② 최대 8중첩', () => {
    const b = possess('bulgasari');
    expect(b.heroForm).toMatchObject({ attackType: 'melee', range: 50, defenseBreak: {} });
    const e = foe(b, 'geuseundae', 40);
    b.step(0.05);
    expect(lost(e)).toBe(25);
    expect(e.status!.defenseBreakStacks).toBe(1);
    expect(b.projectiles).toHaveLength(0);
    const upgraded = possess('bulgasari', { bulgasariBasic: 1, bulgasariCore: 1 });
    expect(upgraded.heroForm!.defenseBreak).toEqual({ maxStacks: 8 });
  });

  it('까치 떼: 원거리 사거리 140, 비행 적에게 ×2 (바람 태그 비행 ×1.5와 곱해져 25 x 2 x 1.5 = 75)', () => {
    const b = possess('magpieFlock');
    expect(b.heroForm).toMatchObject({ attackType: 'ranged', range: 140, flyingMultiplier: 2 });
    const bird = foe(b, 'eodduksini', 90);
    bird.stats.speed = 0;
    b.step(0.05);
    expect(b.projectiles[0].payload.multiplier).toBe(2);
    let hit = 0;
    for (let i = 0; i < 20 && hit === 0; i++) {
      b.step(0.05);
      hit = lost(bird);
    }
    expect(hit).toBeCloseTo(75);

    const ground = possess('magpieFlock');
    const walker = foe(ground, 'geuseundae', 90);
    ground.step(0.05);
    expect(ground.projectiles[0].payload.multiplier).toBe(1);
    advance(ground, 0.5);
    expect(lost(walker)).toBeCloseTo(25);
  });

  it('고유 능력은 붙지 않는다: 외다리 첫 타 ×3, 씨름 메치기, 해태 붙잡기 없음', () => {
    const b = possess('oneLegGoblin');
    const e = foe(b, 'geuseundae', 40);
    b.step(0.05);
    expect(lost(e)).toBe(25 * 1); // 돌격 ×3 없음 (바람 태그는 일반 적에게 영향 없음)
    const sumo = possess('sumoGoblin');
    const s = foe(sumo, 'geuseundae', 40);
    advance(sumo, 2.5);
    expect(s.x).toBeGreaterThan(sumo.hero.x); // 넉백·기절 없이 원래 자리 근처
    expect(s.status!.stunned).toBe(false);
  });

  it('무당 각성 3타 충격파(공격력 x1.5)는 빙의 중에도 유지된다: 25 x 3 + 37.5', () => {
    const b = possess('clubGoblin', { mudangAwakening: 1 });
    const e = foe(b, 'geuseundae', 40);
    let total = 0;
    for (let i = 0; i < 100 && total < 100; i++) {
      b.step(0.05);
      total = lost(e);
    }
    expect(total).toBeCloseTo(112.5);
  });
});

describe('빙의 스킬 공통', () => {
  it('비용 12/16/32, 쿨타임 3.6/7.2/24', () => {
    expect(POSSESSION_COMMON.fanWind).toEqual({ spiritCost: 12, cooldown: 3.6 });
    expect(POSSESSION_COMMON.blessing).toEqual({ spiritCost: 16, cooldown: 7.2 });
    expect(POSSESSION_COMMON.bladeDance).toEqual({ spiritCost: 32, cooldown: 24 });
    for (const unitId of Object.keys(POSSESSION_SKILLS)) {
      const b = possess(unitId);
      const spent: number[] = [];
      for (const id of POSSESSION_SLOTS) {
        const before = b.resources.spirit;
        expect(b.castSkill(id), `${unitId} ${id}`).toBe('ok');
        spent.push(before - b.resources.spirit);
        expect(b.skillCooldown(id)).toBe(POSSESSION_COMMON[id].cooldown);
        expect(b.skillSpiritCost(id)).toBe(POSSESSION_COMMON[id].spiritCost);
      }
      expect(spent).toEqual([12, 16, 32]);
    }
  });

  it('실패 사유와 소모 규칙은 기존과 같다 (신력·쿨타임을 쓰지 않는다)', () => {
    const b = possess('gumiho');
    b.resources.spirit = 11;
    expect(b.castSkill('fanWind')).toBe('noSpirit');
    expect(b.resources.spirit).toBe(11);
    expect(b.skillCooldown('fanWind')).toBe(0);
    b.resources.spirit = 100;
    expect(b.castSkill('fanWind')).toBe('ok');
    expect(b.castSkill('fanWind')).toBe('cooldown');
    b.hero.status!.stun(1, false);
    expect(b.castSkill('blessing')).toBe('stunned');
    b.hero.hp = 0;
    expect(b.castSkill('bladeDance')).toBe('heroDead');
  });

  it('무당 스킬 갈래와 신내림(쿨타임 -40%)은 빙의 스킬에 적용되지 않는다', () => {
    const b = possess('foxfireArcher', { bladeDancePossession: 1, fanWindGust: 1 });
    expect(b.skillCooldownMax('bladeDance')).toBe(24);
    const e = foe(b, 'geuseundae', 100);
    b.castSkill('fanWind');
    expect(lost(e)).toBe(40); // 돌풍 피해 ×2 없음
  });

  it('시전 기록에 실제 범위·모양·유닛 태그 색이 담긴다', () => {
    const b = possess('foxfireArcher');
    b.castSkill('fanWind');
    b.castSkill('blessing');
    b.castSkill('bladeDance');
    const events = b.drainCastEvents();
    expect(events.map((e) => [e.range, e.shape])).toEqual([[NEAREST_REACH, 'circle'], [120, 'circle'], [500, 'fan']]);
    expect(events[1].x).toBe(HX + 300);
    expect(events[0].possessed).toEqual({ unitId: 'foxfireArcher', tint: 'fire' });
    const charge = possess('oneLegGoblin');
    charge.castSkill('fanWind');
    expect(charge.drainCastEvents()[0]).toMatchObject({ x: HX, range: 200, shape: 'fan' });
  });

  it('유닛 6~10도 빙의 스킬을 쓴다 (준비 중 대체 동작 없음): 이름·비용 12/16/32', () => {
    const names: Record<string, string[]> = {
      bulgasari: ['쇠 씹기', '쇠 갑옷', '탐식'],
      haetae: ['정의의 일격', '수호 진형', '해태의 심판'],
      samjokgo: ['태양 깃', '태양 오라', '일식'],
      magpieFlock: ['까치 떼 쇄도', '길조', '오작교'],
      yeongdeungWind: ['돌개바람', '순풍', '영등 폭풍'],
    };
    for (const [unitId, list] of Object.entries(names)) {
      expect(POSSESSION_SKILLS[unitId]).toBeDefined();
      const b = possess(unitId);
      expect(b.possessionSkillsActive).toBe(true);
      expect(POSSESSION_SLOTS.map((id) => b.skillName(id))).toEqual(list);
      const spent: number[] = [];
      for (const id of POSSESSION_SLOTS) {
        const before = b.resources.spirit;
        expect(b.castSkill(id), `${unitId} ${id}`).toBe('ok');
        spent.push(before - b.resources.spirit);
      }
      expect(spent).toEqual([12, 16, 32]);
    }
  });

  it('보스는 넉백 무효, 기절은 0.5초 경직 (외다리 회오리 발차기·천둥 질주)', () => {
    const { b, boss } = bossFight('oneLegGoblin', 1, 100);
    const x = boss.x;
    const hp = boss.hp;
    b.castSkill('blessing');
    expect(boss.x).toBe(x);
    expect(hp - boss.hp).toBeCloseTo(10); // 50 x 근접 저항 0.2
    b.castSkill('bladeDance');
    expect(hp - boss.hp).toBeCloseTo(10 + 60);
    expect(boss.status!.stunned).toBe(true);
    b.step(0.6);
    expect(boss.status!.stunned).toBe(false);
  });
});

describe('유닛 1 방망이병 스킬', () => {
  it('방망이 난타: 앞쪽 150 범위 근접 피해 55, 비행·뒤쪽 제외, 영체 근접 ×0.5', () => {
    const b = possess('clubGoblin');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 164); // 164 - 14 = 150
    const out = foe(b, 'geuseundae', 170);
    const behind = foe(b, 'geuseundae', -50);
    const bird = foe(b, 'eodduksini', 50);
    const ghost = foe(b, 'maidenGhost', 60);
    b.castSkill('fanWind');
    expect([lost(a), lost(edge), lost(out), lost(behind), lost(bird)]).toEqual([55, 55, 0, 0, 0]);
    expect(lost(ghost)).toBeCloseTo(27.5);
  });

  it('뚝딱 소환: 방망이병 3마리를 부적 없이 소환, 아군 30 상한을 지킨다', () => {
    const b = possess('clubGoblin', { clubGoblinBasic: 1 });
    b.resources.talisman = 77;
    b.castSkill('blessing');
    expect(b.allies.map((a) => a.defId)).toEqual(['clubGoblin', 'clubGoblin', 'clubGoblin']);
    expect(b.resources.talisman).toBe(77);
    expect(b.allies[0].maxHp).toBeCloseTo(150); // 요괴 ① 강화를 반영
    b.spawnFreeAllies('clubGoblin', 25); // 28마리
    resetCooldown(b, 'blessing');
    b.castSkill('blessing');
    expect(b.allies).toHaveLength(30);
    resetCooldown(b, 'blessing');
    b.castSkill('blessing');
    expect(b.allies).toHaveLength(30);
  });

  it('도깨비 잔치: 10초간 도깨비 아군(어디에 있든)과 영웅 공격력 +50%, 공격 속도 +30%. 다른 태그는 제외', () => {
    const b = possess('clubGoblin');
    const club = allyAt(b, 'clubGoblin', 300);
    const sumo = allyAt(b, 'sumoGoblin', 2000);
    const fox = allyAt(b, 'foxfireArcher', 1000);
    const dispelled = allyAt(b, 'clubGoblin', 1000);
    b.dispelBuffs(dispelled, 20);
    b.castSkill('bladeDance');
    b.step(0.05);
    for (const body of [club, sumo, b.hero]) {
      expect(body.status!.attackBonus).toBeCloseTo(0.5);
      expect(body.status!.attackSpeedBonus).toBeCloseTo(0.3);
    }
    expect(fox.status!.attackBonus).toBe(0);
    expect(dispelled.status!.attackBonus).toBe(0);
    advance(b, 9.8);
    expect(club.status!.attackBonus).toBeCloseTo(0.5);
    advance(b, 0.3);
    expect(club.status!.attackBonus).toBe(0);
    expect(b.hero.status!.attackSpeedBonus).toBe(0);
  });
});

describe('유닛 2 외다리 도깨비 스킬', () => {
  it('외다리 돌진: 앞으로 200 이동, 지나간 길의 땅 위 적에게 근접 피해 60', () => {
    const b = possess('oneLegGoblin');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 214); // 214 - 14 = 200
    const out = foe(b, 'geuseundae', 220);
    const behind = foe(b, 'geuseundae', -30);
    const bird = foe(b, 'eodduksini', 100);
    b.castSkill('fanWind');
    expect(b.hero.x).toBe(HX + 200);
    expect([lost(a), lost(edge), lost(out), lost(behind), lost(bird)]).toEqual([60, 60, 0, 0, 0]);
  });

  it('돌진은 서낭당~성 사이로 제한되고 왼쪽을 보면 왼쪽으로 달린다', () => {
    const b = possess('oneLegGoblin');
    b.hero.x = 2200;
    b.castSkill('fanWind');
    expect(b.hero.x).toBe(2320);
    const l = possess('oneLegGoblin');
    l.hero.facing = -1;
    const e = foe(l, 'geuseundae', -100);
    l.castSkill('fanWind');
    expect(l.hero.x).toBe(HX - 200);
    expect(lost(e)).toBe(60);
  });

  it('회오리 발차기: 반경 150 근접 피해 50 + 넉백 100 (뒤쪽도, 비행 제외)', () => {
    const b = possess('oneLegGoblin');
    const front = foe(b, 'geuseundae', 100);
    const back = foe(b, 'geuseundae', -100);
    const out = foe(b, 'geuseundae', 170);
    b.castSkill('blessing');
    expect([lost(front), lost(back), lost(out)]).toEqual([50, 50, 0]);
    expect(front.x).toBe(HX + 200);
    expect(back.x).toBe(HX);
    expect(out.x).toBe(HX + 170);
  });

  it('천둥 질주: 앞으로 400 돌진, 길 위의 적 근접 피해 300 + 기절 1초', () => {
    const b = possess('oneLegGoblin');
    const a = foe(b, 'geuseundae', 300);
    const out = foe(b, 'geuseundae', 420); // 406 > 400
    b.castSkill('bladeDance');
    expect(b.hero.x).toBe(HX + 400);
    expect([lost(a), lost(out)]).toEqual([300, 0]);
    expect(a.status!.stunned).toBe(true);
    b.step(0.9);
    expect(a.status!.stunned).toBe(true);
    b.step(0.2);
    expect(a.status!.stunned).toBe(false);
  });
});

describe('유닛 3 씨름 도깨비 스킬', () => {
  it('들배지기: 가장 가까운 적 1명 근접 피해 90 + 넉백 150 + 기절 1초 (비행 제외)', () => {
    const b = possess('sumoGoblin');
    const a = foe(b, 'geuseundae', 100);
    const nearest = foe(b, 'geuseundae', -60);
    foe(b, 'eodduksini', 20);
    const far = foe(b, 'geuseundae', 420); // 406 > NEAREST_REACH
    b.castSkill('fanWind');
    expect(lost(nearest)).toBe(90);
    expect(nearest.x).toBe(HX - 60 + 150);
    expect(nearest.status!.stunned).toBe(true);
    expect([lost(a), lost(far)]).toEqual([0, 0]);
  });

  it('샅바 잡기: 반경 150 적을 3초 붙잡는다 (피해 없음)', () => {
    const b = possess('sumoGoblin');
    const a = foe(b, 'geuseundae', 150);
    const back = foe(b, 'geuseundae', -100);
    const out = foe(b, 'geuseundae', 170);
    b.castSkill('blessing');
    expect([lost(a), lost(back), lost(out)]).toEqual([0, 0, 0]);
    expect([a.status!.stunned, back.status!.stunned, out.status!.stunned]).toEqual([true, true, false]);
    b.step(2.9);
    expect(a.status!.stunned).toBe(true);
    b.step(0.2);
    expect(a.status!.stunned).toBe(false);
  });

  it('천하장사: 앞쪽 250 범위 근접 피해 320 + 넉백 200, 밀려난 적이 부딪힌 적도 둘 다 피해 40', () => {
    const b = possess('sumoGoblin');
    const thrown = foe(b, 'geuseundae', 100);
    const hit = foe(b, 'geuseundae', 300); // 범위 밖(286 > 250), 밀려난 길 위
    const clear = foe(b, 'geuseundae', 340); // 길 밖 (240 - 14 = 226 > 214)
    const behind = foe(b, 'geuseundae', -50);
    b.castSkill('bladeDance');
    expect(thrown.x).toBe(HX + 100 + 200);
    expect(lost(thrown)).toBe(320 + 40);
    expect(lost(hit)).toBe(40);
    expect([lost(clear), lost(behind)]).toEqual([0, 0]);
  });
});

describe('천하장사 충돌 피해 1회 한정', () => {
  it('앞쪽 250 안 적 둘(x=100, 250): 각각 320 + 40 = 360', () => {
    const b = possess('sumoGoblin');
    const near = foe(b, 'geuseundae', 100);
    const far = foe(b, 'geuseundae', 250);
    b.castSkill('bladeDance');
    expect([lost(near), lost(far)]).toEqual([360, 360]);
    expect(near.x).toBe(HX + 100 + 200);
    expect(far.x).toBe(HX + 250 + 200);
  });

  it('밀집한 적 셋도 각각 충돌 피해는 한 번', () => {
    const b = possess('sumoGoblin');
    const list = [60, 130, 200].map((dx) => foe(b, 'geuseundae', dx));
    b.castSkill('bladeDance');
    for (const e of list) expect(lost(e)).toBeLessThanOrEqual(320 + 40);
  });
});

describe('유닛 4 여우불 사수 스킬', () => {
  it('여우불 연사: 가까운 적 3명(비행·뒤쪽 포함)에게 원거리 40 + 화상 8, 4번째는 제외', () => {
    const b = possess('foxfireArcher');
    const back = foe(b, 'geuseundae', -30);
    const bird = foe(b, 'eodduksini', 60);
    const front = foe(b, 'geuseundae', 110);
    const fourth = foe(b, 'geuseundae', 160);
    b.castSkill('fanWind');
    expect([lost(back), lost(bird), lost(front), lost(fourth)]).toEqual([40, 40, 40, 0]);
    expect([back.status!.burnDps, bird.status!.burnDps, front.status!.burnDps, fourth.status!.burnDps]).toEqual([8, 8, 8, 0]);
  });

  it('불 태그 상성: 영체는 불 ×1.5 (60), 갑옷은 원거리 ×0.5 (20), 강철이는 불 무효(피해·화상 없음)', () => {
    const b = possess('foxfireArcher');
    const ghost = foe(b, 'maidenGhost', 30);
    const armor = foe(b, 'jangseungSpirit', 60);
    const steel = foe(b, 'gangcheol', 90);
    b.castSkill('fanWind');
    expect(lost(ghost)).toBe(60);
    expect(lost(armor)).toBe(20);
    expect(lost(steel)).toBe(0);
    expect(steel.status!.burnDps).toBe(0);
  });

  it('불꽃 비: 앞쪽 300 지점 반경 120에 마법 60 + 화상 10 (무리 ×1.5 = 90)', () => {
    const b = possess('foxfireArcher');
    const center = foe(b, 'geuseundae', 300);
    const edge = foe(b, 'geuseundae', 420); // 120 - 14 = 106
    const swarm = foe(b, 'eggGhost', 300);
    const out = foe(b, 'geuseundae', 440); // 140 - 14 = 126 > 120
    const near = foe(b, 'geuseundae', 0);
    const bird = foe(b, 'eodduksini', 300);
    b.castSkill('blessing');
    expect([lost(center), lost(edge), lost(out), lost(near), lost(bird)]).toEqual([60, 60, 0, 0, 60]);
    expect(lost(swarm)).toBe(90);
    expect(center.status!.burnDps).toBe(10);
  });

  it('여우불 폭풍: 앞쪽 500 범위 모든 적에 마법 250 + 화상 15 (갑옷 ×0.5 = 125)', () => {
    const b = possess('foxfireArcher');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 514);
    const out = foe(b, 'geuseundae', 520);
    const behind = foe(b, 'geuseundae', -20);
    const armor = foe(b, 'jangseungSpirit', 200);
    const bird = foe(b, 'eodduksini', 300);
    b.castSkill('bladeDance');
    expect([lost(a), lost(edge), lost(out), lost(behind), lost(bird)]).toEqual([250, 250, 0, 0, 250]);
    expect(lost(armor)).toBe(125);
    expect(a.status!.burnDps).toBe(15);
  });
});

describe('유닛 5 구미호 스킬', () => {
  it('여우구슬: 가장 가까운 적 위치 반경 80에 마법 70 + 화상 6', () => {
    const b = possess('gumiho');
    const nearest = foe(b, 'geuseundae', 100);
    const splash = foe(b, 'geuseundae', 170); // 70 - 14 = 56 <= 80
    const out = foe(b, 'geuseundae', 200); // 100 - 14 = 86 > 80
    const swarm = foe(b, 'eggGhost', 120);
    b.castSkill('fanWind');
    expect([lost(nearest), lost(splash), lost(out)]).toEqual([70, 70, 0]);
    expect(lost(swarm)).toBe(105);
    expect(nearest.status!.burnDps).toBe(6);
    expect(out.status!.burnDps).toBe(0);
  });

  it('여우구슬: 닿는 적이 없으면 신력만 쓴다', () => {
    const b = possess('gumiho');
    foe(b, 'geuseundae', 500);
    expect(b.castSkill('fanWind')).toBe('ok');
    expect(b.resources.spirit).toBe(88);
  });

  it('홀림: 반경 200 적 기절 1.5초 + 감속 40% 4초 (피해 없음, 비행 포함)', () => {
    const b = possess('gumiho');
    const a = foe(b, 'geuseundae', 150);
    const back = foe(b, 'geuseundae', -190);
    const bird = foe(b, 'eodduksini', 100);
    const out = foe(b, 'geuseundae', 220);
    b.castSkill('blessing');
    expect([lost(a), lost(back)]).toEqual([0, 0]);
    expect([a, back, bird, out].map((e) => e.status!.stunned)).toEqual([true, true, true, false]);
    expect(a.status!.slowRatio).toBeCloseTo(0.4);
    b.step(1.6);
    expect(a.status!.stunned).toBe(false);
    expect(a.status!.slowed).toBe(true);
    b.step(2.5);
    expect(a.status!.slowed).toBe(false);
  });

  it('아홉 꼬리 업화: 반경 300에 0.2초 간격 9회, 각 마법 45 (총 405) + 화상 6', () => {
    const b = possess('gumiho');
    const e = foe(b, 'geuseundae', 100);
    const out = foe(b, 'geuseundae', 420);
    const hits = () => b.drainDamageEvents().filter((ev) => ev.target === e && ev.kind !== 'burn' && ev.amount === 45).length;
    b.castSkill('bladeDance');
    let count = hits();
    expect(count).toBe(1); // 첫 타는 즉시
    expect(e.status!.burnDps).toBe(6);
    b.step(0.25);
    count += hits();
    expect(count).toBe(2);
    b.step(1.5);
    count += hits();
    expect(count).toBe(9);
    b.step(1);
    expect(hits()).toBe(0);
    expect(lost(out)).toBe(0);
  });
});

describe('빙의 스킬 기본 동작 (아직 쓰이지 않는 조합 포함)', () => {
  const runner = (b: Battle, tags = ['hero'] as const) => new PossessionSkillRunner(b, tags);

  it('오라형 버프: duration초 동안 영웅 중심 반경 안 아군(영웅 포함)에게만', () => {
    const b = possess(null);
    const near = allyAt(b, 'clubGoblin', HX + 240);
    const far = allyAt(b, 'clubGoblin', HX + 300);
    runner(b).run({ name: 't', effects: [{ kind: 'aura', radius: 250, effect: { attack: 0.5 }, duration: 10 }] });
    b.step(0.05);
    expect([b.hero.status!.attackBonus, near.status!.attackBonus, far.status!.attackBonus]).toEqual([0.5, 0.5, 0]);
    expect(b.auraCircles).toEqual([{ x: HX, radius: 250 }]);
    b.step(10);
    expect(b.hero.status!.attackBonus).toBe(0);
    expect(b.auraCircles).toEqual([]);
  });

  it('서낭당 회복, 처치 시 회복, 방어 파괴 중첩', () => {
    const b = possess(null);
    b.shrine.hp = 500;
    runner(b).run({ name: 't', effects: [{ kind: 'shrineHeal', ratio: 0.1 }] });
    expect(b.shrine.hp).toBe(600);

    b.hero.hp = 100;
    const weak1 = foe(b, 'geuseundae', 50, 100);
    const weak2 = foe(b, 'geuseundae', 80, 100);
    const tank = foe(b, 'geuseundae', 90);
    runner(b).run({
      name: 't',
      effects: [{ kind: 'hit', area: { kind: 'radius', radius: 150 }, type: 'melee', damage: 100, healOnKill: 0.1, defenseBreak: 3 }],
    });
    expect([weak1.alive, weak2.alive]).toEqual([false, false]);
    expect(b.hero.hp).toBeCloseTo(100 + 2 * 30);
    expect(tank.status!.defenseBreakStacks).toBe(3);
    runner(b).run({
      name: 't', effects: [{ kind: 'hit', area: { kind: 'radius', radius: 150 }, type: 'melee', defenseBreak: 'max' }],
    });
    expect(tank.status!.defenseBreakStacks).toBe(5);
  });
});
