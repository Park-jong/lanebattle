import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import type { AttackInfo } from './damage';
import type { Body, Fighter } from './entities';
import { SeededRng } from './rng';

const fireMagic: AttackInfo = { type: 'magic', tags: ['fire'], source: 'ally' };
const plainMelee: AttackInfo = { type: 'melee', tags: ['dokkaebi'], source: 'ally' };
const plainMagic: AttackInfo = { type: 'magic', tags: ['dokkaebi'], source: 'ally' };
const enemyMelee: AttackInfo = { type: 'melee', tags: [], source: 'enemy' };

const newBattle = (stage = 0) => new Battle({ stage, rng: new SeededRng(1) });

/** 맞아도 죽지 않는 적 */
function tank(b: Battle, id: string): Fighter {
  const e = b.spawnEnemy(id, false, 1000);
  e.maxHp = e.hp = 100000;
  return e;
}

function bossBattle(chapter: number): { b: Battle; boss: Fighter } {
  const b = new Battle({ stage: (chapter - 1) * 5 + 4, bossAt: 0, rng: new SeededRng(1) });
  b.step(0.05);
  const boss = b.encounter!.boss!;
  boss.maxHp = boss.hp = 100000;
  b.drainDamageEvents();
  return { b, boss };
}

/** 한 번 때리고 그 대상에 대한 기록 하나를 돌려준다 */
function hitOnce(b: Battle, target: Body, base: number, info: AttackInfo) {
  b.drainDamageEvents();
  b.dealFixedDamage(target, base, info);
  const events = b.drainDamageEvents().filter((e) => e.target === target);
  expect(events).toHaveLength(1);
  return events[0];
}

describe('피해 기록: 상성 분류', () => {
  it('보스 약점 적중은 weak', () => {
    const { b, boss } = bossBattle(1); // 약점 불
    const e = hitOnce(b, boss, 10, fireMagic);
    expect(e.kind).toBe('weak');
    expect(e.amount).toBe(20);
    expect(e.friendly).toBe(false);
  });

  it('보스 저항 적중은 resist', () => {
    const { b, boss } = bossBattle(1); // 근접 저항
    const e = hitOnce(b, boss, 100, plainMelee);
    expect(e.kind).toBe('resist');
    expect(e.amount).toBe(20);
  });

  it('약점도 저항도 아니면 normal', () => {
    const { b, boss } = bossBattle(1);
    const e = hitOnce(b, boss, 10, plainMagic);
    expect(e.kind).toBe('normal');
    expect(e.amount).toBe(10);
  });

  it('일반 적의 특성 배율도 약점·저항으로 분류한다 (무리 vs 마법, 영체 vs 근접)', () => {
    const b = newBattle();
    expect(hitOnce(b, tank(b, 'eggGhost'), 10, plainMagic).kind).toBe('weak');
    expect(hitOnce(b, tank(b, 'maidenGhost'), 10, plainMelee).kind).toBe('resist');
  });

  it('면역(피해 0)은 immune, 피해량 0', () => {
    const b = newBattle();
    const e = hitOnce(b, tank(b, 'gangcheol'), 10, fireMagic); // 강철이는 불 면역
    expect(e.kind).toBe('immune');
    expect(e.amount).toBe(0);
  });

  it('아군·영웅·서낭당이 받은 피해는 friendly', () => {
    const b = newBattle();
    b.resources.talisman = 500;
    b.summon(0);
    for (const target of [b.allies[0], b.hero, b.shrine]) {
      const e = hitOnce(b, target, 7, enemyMelee);
      expect(e.friendly).toBe(true);
      expect(e.kind).toBe('normal');
      expect(e.amount).toBe(7);
    }
  });

  it('적 쪽 대상은 friendly가 아니다', () => {
    const b = newBattle();
    expect(hitOnce(b, b.castle, 10, plainMelee).friendly).toBe(false);
  });

  it('최소 피해 1: 소수 피해도 1 이상으로 표시한다', () => {
    const b = newBattle();
    expect(hitOnce(b, tank(b, 'geuseundae'), 0.2, plainMagic).amount).toBe(1);
  });
});

describe('피해 기록: 기록하지 않는 경우', () => {
  it('무적인 원귀의 성이 맞은 것은 기록하지 않는다', () => {
    const { b } = bossBattle(1);
    expect(b.castle.invulnerable).toBe(true);
    b.dealFixedDamage(b.castle, 50, plainMelee);
    expect(b.drainDamageEvents().filter((e) => e.target === b.castle)).toHaveLength(0);
  });

  it('이미 죽은 대상은 기록하지 않는다', () => {
    const b = newBattle();
    const e = tank(b, 'geuseundae');
    e.hp = 1;
    b.dealFixedDamage(e, 50, plainMagic);
    b.drainDamageEvents();
    b.dealFixedDamage(e, 50, plainMagic);
    expect(b.drainDamageEvents()).toHaveLength(0);
  });

  it('drain 뒤에는 비어 있다', () => {
    const b = newBattle();
    b.dealFixedDamage(tank(b, 'geuseundae'), 5, plainMagic);
    expect(b.drainDamageEvents()).toHaveLength(1);
    expect(b.drainDamageEvents()).toHaveLength(0);
  });

  it('화면이 비우지 않아도 쌓이는 기록 수에 상한이 있다', () => {
    const b = newBattle();
    const e = tank(b, 'geuseundae');
    for (let i = 0; i < 1000; i++) b.dealFixedDamage(e, 1, plainMagic);
    expect(b.drainDamageEvents().length).toBeLessThanOrEqual(300);
  });
});

describe('피해 기록: 화상 지속 피해', () => {
  it('화상 피해는 burn으로 묶여 나오고 합계가 맞는다', () => {
    const b = newBattle();
    const e = tank(b, 'geuseundae');
    b.applyBurn(e, 10);
    const before = e.hp;
    b.step(1.2);
    const burns = b.drainDamageEvents().filter((ev) => ev.kind === 'burn');
    const shown = burns.reduce((sum, ev) => sum + ev.amount, 0);
    const lost = before - e.hp;
    // 틱마다 하나씩이 아니라 0.5초 간격으로 묶인다
    expect(burns.length).toBeGreaterThanOrEqual(1);
    expect(burns.length).toBeLessThanOrEqual(3);
    expect(burns.every((ev) => ev.target === e && !ev.friendly)).toBe(true);
    expect(Math.abs(shown - lost)).toBeLessThanOrEqual(10);
    expect(shown).toBeGreaterThan(0);
  });

  it('아군이 받은 화상은 friendly burn', () => {
    const b = newBattle();
    b.resources.talisman = 500;
    b.summon(0);
    const ally = b.allies[0];
    ally.maxHp = ally.hp = 100000;
    b.applyBurn(ally, 10);
    b.step(1.2);
    const burns = b.drainDamageEvents().filter((ev) => ev.kind === 'burn');
    expect(burns.length).toBeGreaterThanOrEqual(1);
    expect(burns.every((ev) => ev.friendly)).toBe(true);
  });
});
