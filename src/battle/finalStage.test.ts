import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { computeBuildEffects } from '../game/buildEffects';
import type { BuildLevels } from '../game/build';
import { describeSkill } from '../game/skillText';
import { describeUnit, summonStatus } from '../game/unitText';
import { Battle } from './battle';
import type { Fighter } from './entities';
import { SeededRng } from './rng';

// numbers.md 11장 강림·귀문개방 전투 효과. 기대값은 손으로 계산한 수치다.

const HX = 1000;
const BIG_HP = 100000;

/** 웨이브를 끄고 빌드 효과를 적용한 전투. 영웅은 가운데에 둔다 */
function newBattle(levels: BuildLevels = {}, stage = 0): Battle {
  const b = new Battle({ stage, rng: new SeededRng(1), modifiers: computeBuildEffects(levels) });
  (b as unknown as { director: { update: () => [] } }).director = { update: () => [] };
  b.hero.x = HX;
  b.resources.spirit = b.resources.maxSpirit;
  return b;
}

/** 맞아도 죽지 않는 적. frozen이면 움직이지도 공격하지도 않는다 */
function foe(b: Battle, id: string, x: number, frozen = true): Fighter {
  const e = b.spawnEnemy(id, false, x);
  e.maxHp = e.hp = BIG_HP;
  if (frozen) e.status!.stun(10000, false);
  return e;
}

const lost = (e: Fighter) => BIG_HP - e.hp;
const idx = (id: string) => ALLIES.findIndex((a) => a.id === id);
const resetCooldowns = (b: Battle) => (b as unknown as { cooldowns: number[] }).cooldowns.fill(0);

describe('강림: 요괴 소환 불가', () => {
  it('소환은 부적이 충분해도 descent로 실패하고 부적·쿨타임·아군이 그대로다', () => {
    const b = newBattle({ descent: 1 });
    b.resources.talisman = 200;
    expect(b.summon(0)).toBe('descent');
    expect(b.allies).toHaveLength(0);
    expect(b.resources.talisman).toBe(200);
    expect(b.summonCooldown(0)).toBe(0);
  });

  it('강림이 아니면 소환된다', () => {
    const b = newBattle();
    b.resources.talisman = 200;
    expect(b.summon(0)).toBe('ok');
  });

  it('툴팁 상태 줄은 "강림 중에는 소환할 수 없습니다"', () => {
    const ok = { allyCount: 0, maxAllies: COMBAT.maxAllies, cooldown: 0, talisman: 200, cost: 30 };
    expect(summonStatus({ ...ok, descent: true })).toEqual({ text: '강림 중에는 소환할 수 없습니다', ok: false });
    expect(summonStatus(ok).ok).toBe(true);
  });
});

describe('강림: 체력·쿨타임·신력', () => {
  it('최대 체력 300 x 3 = 900, 시작 체력도 900', () => {
    const b = newBattle({ descent: 1 });
    expect(b.hero.maxHp).toBe(HERO.maxHp * 3);
    expect(b.hero.maxHp).toBe(900);
    expect(b.hero.hp).toBe(900);
  });

  it('단단한 몸 3레벨과는 곱: 300 x 1.45 x 3', () => {
    const b = newBattle({ descent: 1, sturdyBody: 3 });
    expect(b.hero.maxHp).toBeCloseTo(300 * 1.45 * 3);
    expect(b.hero.hp).toBeCloseTo(1305);
  });

  it('쿨타임 Q 0.1 / W 1 / E 5초', () => {
    const b = newBattle({ descent: 1 });
    expect([b.skillCooldownMax('fanWind'), b.skillCooldownMax('blessing'), b.skillCooldownMax('bladeDance')]).toEqual([0.1, 1, 5]);
    b.castSkill('fanWind');
    b.castSkill('bladeDance');
    expect(b.skillCooldown('fanWind')).toBeCloseTo(0.1);
    expect(b.skillCooldown('bladeDance')).toBeCloseTo(5);
  });

  it('신내림(작두 쿨타임 -40%)이 있어도 E는 5초 (고정값이 우선)', () => {
    const b = newBattle({ descent: 1, bladeDancePossession: 1 });
    expect(b.skillCooldownMax('bladeDance')).toBe(5);
    expect(newBattle({ bladeDancePossession: 1 }).skillCooldownMax('bladeDance')).toBeCloseTo(24);
  });

  it('Q 신력 0, W 40·E 80은 그대로', () => {
    const b = newBattle({ descent: 1 });
    expect([b.skillSpiritCost('fanWind'), b.skillSpiritCost('blessing'), b.skillSpiritCost('bladeDance')]).toEqual([0, 40, 80]);
    b.resources.spirit = 0;
    expect(b.castSkill('fanWind')).toBe('ok'); // 신력 0이어도 쓸 수 있다
    expect(b.resources.spirit).toBe(0);
    expect(b.castSkill('blessing')).toBe('noSpirit');
    b.resources.spirit = 50;
    expect(b.castSkill('blessing')).toBe('ok');
    expect(b.resources.spirit).toBe(10);
  });

  it('신력 시간 충전 초당 5 x 3 = 15, 적중 +2는 그대로', () => {
    const b = newBattle({ descent: 1 });
    b.resources.spirit = 0;
    b.step(1);
    expect(b.resources.spirit).toBeCloseTo(15);
    const h = newBattle({ descent: 1 });
    h.resources.spirit = 0;
    foe(h, 'grimReaper', HX + 30);
    h.step(0.05);
    expect(h.resources.spirit).toBeCloseTo(2 + 15 * 0.05);
  });

  it('신력 샘 2레벨(x1.4)과는 곱: 5 x 1.4 x 3 = 21', () => {
    const b = newBattle({ descent: 1, spiritSpring: 2 });
    b.resources.spirit = 0;
    b.step(1);
    expect(b.resources.spirit).toBeCloseTo(21);
  });
});

describe('강림: 피해 300%', () => {
  it('기본 공격 25 -> 75', () => {
    const b = newBattle({ descent: 1 });
    const e = foe(b, 'grimReaper', HX + 30);
    b.step(0.05);
    expect(lost(e)).toBeCloseTo(75);
  });

  it('방울 단련 3레벨(x1.3)과는 곱: 25 x 1.3 x 3', () => {
    const b = newBattle({ descent: 1, bellTraining: 3 });
    const e = foe(b, 'grimReaper', HX + 30);
    b.step(0.05);
    expect(lost(e)).toBeCloseTo(25 * 1.3 * 3);
  });

  it('부채 바람 30 -> 90, 돌풍 갈래(x2)면 30 x 2 x 3 = 180', () => {
    const b = newBattle({ descent: 1 });
    const e = foe(b, 'grimReaper', HX + 100);
    b.castSkill('fanWind');
    expect(lost(e)).toBeCloseTo(90);
    const g = newBattle({ descent: 1, fanWindGust: 1 });
    const e2 = foe(g, 'grimReaper', HX + 100);
    g.castSkill('fanWind');
    expect(lost(e2)).toBeCloseTo(180);
  });

  it('작두 타기 200 -> 600', () => {
    const b = newBattle({ descent: 1 });
    const e = foe(b, 'grimReaper', HX + 100);
    b.castSkill('bladeDance'); // 시전 직후 (step 전이라 기본 공격 없음)
    expect(lost(e)).toBeCloseTo(600);
  });

  it('칼날 춤 지속 피해 초당 40 -> 120', () => {
    const b = newBattle({ descent: 1, bladeDanceBlades: 1 });
    const e = foe(b, 'grimReaper', HX + 100);
    b.castSkill('bladeDance');
    b.hero.status!.stun(10000, false);
    const before = e.hp;
    b.step(1);
    expect(before - e.hp).toBeCloseTo(120, 0);
  });

  it('무당 각성 충격파 25 x 1.5 -> x3 (먼 적은 충격파 피해만)', () => {
    const b = newBattle({ descent: 1, mudangAwakening: 1 });
    foe(b, 'grimReaper', HX + 30);
    const far = foe(b, 'grimReaper', HX + 70);
    b.step(1.5); // 기본 공격 3번째에 충격파
    expect(lost(far)).toBeCloseTo(25 * 1.5 * 3);
  });

  it('강림이 아니면 그대로 (기본 25, 부채 바람 30)', () => {
    const b = newBattle();
    const e = foe(b, 'grimReaper', HX + 30);
    b.step(0.05);
    expect(lost(e)).toBeCloseTo(25);
    const f = newBattle();
    const e2 = foe(f, 'grimReaper', HX + 100);
    f.castSkill('fanWind');
    expect(lost(e2)).toBeCloseTo(30);
  });

  it('차사왕 영웅 약점 x2와 곱: 작두 200 x 3 x 2 = 1200', () => {
    const fresh = new Battle({ stage: 24, bossAt: 0, rng: new SeededRng(1), modifiers: computeBuildEffects({ descent: 1 }) });
    fresh.step(0.05);
    const boss = fresh.encounter!.boss!;
    boss.x = 140;
    fresh.resources.spirit = 100;
    const before = boss.hp;
    expect(fresh.castSkill('bladeDance')).toBe('ok');
    expect(before - boss.hp).toBeCloseTo(200 * 3 * 2);
  });
});

describe('귀문개방: 소환 비용·쿨타임', () => {
  it('모든 유닛 소환 비용 10 고정 (방망이병 ②여도 10, 해태도 10)', () => {
    const b = newBattle({ ghostGate: 1, clubGoblinBasic: 1, clubGoblinCore: 1 });
    for (let i = 0; i < ALLIES.length; i++) expect(b.allyDef(i).cost, ALLIES[i].id).toBe(10);
    expect(b.allyDef(idx('clubGoblin')).cost).toBe(10);
    expect(b.allyDef(idx('haetae')).cost).toBe(10);
    // 귀문개방이 없으면 방망이병 ②는 비용 -20%
    expect(newBattle({ clubGoblinBasic: 1, clubGoblinCore: 1 }).allyDef(idx('clubGoblin')).cost).toBeCloseTo(ALLIES[idx('clubGoblin')].cost * 0.8);
  });

  it('실제 소환에서도 부적 10만 쓴다', () => {
    const b = newBattle({ ghostGate: 1 });
    b.resources.talisman = 200;
    expect(b.summon(idx('haetae'))).toBe('ok');
    expect(b.resources.talisman).toBeCloseTo(190);
  });

  it('쿨타임: 방망이병 1.5 -> 0.75, ② 적용 1.05 -> 0.525, 해태 15 -> 7.5', () => {
    const plain = newBattle({ ghostGate: 1 });
    expect(plain.allyDef(idx('clubGoblin')).cooldown).toBeCloseTo(0.75);
    expect(plain.allyDef(idx('haetae')).cooldown).toBeCloseTo(7.5);
    const upgraded = newBattle({ ghostGate: 1, clubGoblinBasic: 1, clubGoblinCore: 1 });
    expect(upgraded.allyDef(idx('clubGoblin')).cooldown).toBeCloseTo(0.525);
    // 귀문개방이 없을 때의 기준값
    expect(newBattle().allyDef(idx('clubGoblin')).cooldown).toBeCloseTo(1.5);
    expect(newBattle({ clubGoblinBasic: 1, clubGoblinCore: 1 }).allyDef(idx('clubGoblin')).cooldown).toBeCloseTo(1.05);
    // 실제 소환 후 남는 쿨타임
    plain.resources.talisman = 200;
    plain.summon(idx('haetae'));
    expect(plain.summonCooldown(idx('haetae'))).toBeCloseTo(7.5);
  });

  it('소환 툴팁에 비용 10·쿨타임 절반·귀문개방 줄이 나온다', () => {
    const text = describeUnit('haetae', computeBuildEffects({ ghostGate: 1 }), '7').lines.join('\n');
    expect(text).toContain('부적 10 / 쿨타임 7.5초');
    expect(text).toContain('귀문개방');
    const normal = describeUnit('haetae', computeBuildEffects({}), '7').lines.join('\n');
    expect(normal).toContain('쿨타임 15초');
    expect(normal).not.toContain('귀문개방');
  });

  it('귀문개방은 영웅 체력·스킬에 영향이 없다', () => {
    const b = newBattle({ ghostGate: 1 });
    expect(b.hero.maxHp).toBe(300);
    expect(b.skillCooldownMax('fanWind')).toBe(6);
    expect(b.skillSpiritCost('fanWind')).toBe(30);
    expect(b.summon(0)).not.toBe('descent');
  });
});

describe('강림 스킬 툴팁', () => {
  it('새 쿨타임·신력·피해를 보여 준다', () => {
    const m = computeBuildEffects({ descent: 1 });
    const fan = describeSkill('fanWind', m).lines.join('\n');
    expect(fan).toContain('신력 0 / 쿨타임 0.1초');
    expect(fan).toContain('피해 90');
    expect(fan).toContain('강림');
    const blade = describeSkill('bladeDance', m).lines.join('\n');
    expect(blade).toContain('신력 80 / 쿨타임 5초');
    expect(blade).toContain('피해 600');
    expect(describeSkill('blessing', m).lines.join('\n')).toContain('신력 40 / 쿨타임 1초');
  });

  it('강림이 아니면 기존 문구 그대로', () => {
    const m = computeBuildEffects({});
    expect(describeSkill('fanWind', m).lines.join('\n')).toContain('신력 30 / 쿨타임 6초');
    expect(describeSkill('fanWind', m).lines.join('\n')).not.toContain('강림');
  });

  it('칼날 춤 지속 피해 문구도 x3 (초당 120)', () => {
    const m = computeBuildEffects({ descent: 1, bladeDanceBlades: 1 });
    expect(describeSkill('bladeDance', m).lines.join('\n')).toContain('초당 120 추가 피해');
  });
});

describe('최종 단계가 없으면 기존 동작', () => {
  it('체력·쿨타임·충전·소환 비용이 기본값이다', () => {
    const b = newBattle();
    expect(b.hero.maxHp).toBe(300);
    expect([b.skillCooldownMax('fanWind'), b.skillCooldownMax('blessing'), b.skillCooldownMax('bladeDance')]).toEqual([6, 12, 40]);
    b.resources.spirit = 0;
    b.step(1);
    expect(b.resources.spirit).toBeCloseTo(5);
    expect(b.allyDef(0).cost).toBe(ALLIES[0].cost);
    resetCooldowns(b);
  });
});
