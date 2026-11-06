import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { ALL_SYNERGY_IDS, isSynergyId, type SynergyId } from '../data/synergy';
import { Battle } from './battle';
import type { Fighter } from './entities';
import { SeededRng } from './rng';

const idx = (id: string) => ALLIES.findIndex((a) => a.id === id);

function newBattle(synergies: readonly SynergyId[] = []) {
  const b = new Battle({ stage: 0, rng: new SeededRng(1), synergies });
  (b as unknown as { director: { update: () => [] } }).director = { update: () => [] };
  b.hero.x = 1500;
  return b;
}

/** 아군 하나를 소환해 제자리에 고정한다 (기절) */
function ally(b: Battle, id: string, x = 500, freeze = true): Fighter {
  b.resources.talisman = 200;
  (b as unknown as { cooldowns: number[] }).cooldowns.fill(0);
  b.summon(idx(id));
  const a = b.allies[b.allies.length - 1];
  a.x = x;
  if (freeze) a.status!.stun(1e6, false);
  return a;
}

const clubs = (b: Battle, n: number) => Array.from({ length: n }, (_, i) => ally(b, 'clubGoblin', 300 + i * 10));

describe('연계 엔진 기본', () => {
  it('연계는 14종이고 기본은 모두 꺼짐', () => {
    expect(ALL_SYNERGY_IDS).toHaveLength(14);
    expect(isSynergyId('emberI')).toBe(true);
    expect(isSynergyId('nope')).toBe(false);
    const b = newBattle();
    const list = clubs(b, 5);
    b.step(0.05);
    for (const c of list) {
      expect(c.status!.attackSpeedBonus).toBe(0);
      expect(c.status!.attackBonus).toBe(0);
    }
    expect(b.synergy.activeIds()).toEqual([]);
  });

  it('태그 수: 두 태그 유닛은 양쪽에 세고, 연계의 고리가 켜지면 각각 2', () => {
    const b = newBattle();
    ally(b, 'oneLegGoblin'); // 도깨비 + 바람
    ally(b, 'sumoGoblin'); // 도깨비
    ally(b, 'magpieFlock'); // 바람
    b.step(0.05);
    expect(b.synergy.tagCount('dokkaebi')).toBe(2);
    expect(b.synergy.tagCount('wind')).toBe(2);
    expect(b.synergy.tagCount('fire')).toBe(0);

    const b2 = newBattle(['linkRing']);
    ally(b2, 'oneLegGoblin');
    ally(b2, 'sumoGoblin');
    ally(b2, 'magpieFlock');
    b2.step(0.05);
    expect(b2.synergy.tagCount('dokkaebi')).toBe(3); // 2 + 1
    expect(b2.synergy.tagCount('wind')).toBe(3); // 2 + 1
  });

  it('연계의 고리: 두 태그 유닛이 도깨비 모임 Ⅰ의 3마리 조건을 채운다', () => {
    const without = newBattle(['dokkaebiGatheringI']);
    const w = [ally(without, 'oneLegGoblin'), ally(without, 'sumoGoblin')];
    without.step(0.05);
    expect(w[0].status!.attackSpeedBonus).toBe(0); // 2마리

    const b = newBattle(['dokkaebiGatheringI', 'linkRing']);
    const list = [ally(b, 'oneLegGoblin'), ally(b, 'sumoGoblin')];
    b.step(0.05);
    expect(list[0].status!.attackSpeedBonus).toBeCloseTo(0.15); // 2 + 1 = 3
  });

  it('조건이 깨지면 효과가 즉시 사라진다', () => {
    const b = newBattle(['dokkaebiGatheringI']);
    const list = clubs(b, 3);
    b.step(0.05);
    expect(list[0].status!.attackSpeedBonus).toBeCloseTo(0.15);
    expect(b.synergy.activeIds()).toEqual(['dokkaebiGatheringI']);
    list[2].hp = 0;
    b.step(0.05);
    expect(list[0].status!.attackSpeedBonus).toBe(0);
    expect(b.synergy.activeIds()).toEqual([]);
  });

  it('전체 끄기 스위치: 효과가 모두 사라지고 최대 체력도 되돌아간다', () => {
    const b = newBattle([...ALL_SYNERGY_IDS]);
    const g = ally(b, 'haetae', 500);
    const club = ally(b, 'clubGoblin', 550);
    b.step(0.05);
    expect(club.maxHp).toBeCloseTo(156);
    expect(club.status!.attackBonus).toBe(0); // 백귀야행은 4태그가 아니라 꺼짐
    b.synergyDisabled = true;
    b.step(0.05);
    expect(club.maxHp).toBe(120);
    expect(g.status!.damageReduction).toBe(0);
    expect(b.synergy.activeIds()).toEqual([]);
    b.synergyDisabled = false;
    b.step(0.05);
    expect(club.maxHp).toBeCloseTo(156);
  });
});

describe('연계 효과 14종', () => {
  it('도깨비 모임 Ⅰ: 도깨비 3마리 이상이면 도깨비 공격 속도 +15%', () => {
    const b = newBattle(['dokkaebiGatheringI']);
    const list = clubs(b, 3);
    const archer = ally(b, 'foxfireArcher');
    b.step(0.05);
    expect(list[0].status!.attackSpeedBonus).toBeCloseTo(0.15);
    expect(archer.status!.attackSpeedBonus).toBe(0); // 도깨비가 아님
  });

  it('도깨비 모임 Ⅱ: 도깨비 5마리 이상이면 도깨비 공격력 +20%', () => {
    const b = newBattle(['dokkaebiGatheringII']);
    const list = clubs(b, 4);
    b.step(0.05);
    expect(list[0].status!.attackBonus).toBe(0);
    list.push(...clubs(b, 1));
    b.step(0.05);
    expect(list[0].status!.attackBonus).toBeCloseTo(0.2);
  });

  it('불씨 Ⅰ: 화상 피해 +30% (초당 4 -> 5.2)', () => {
    const b = newBattle(['emberI']);
    ally(b, 'foxfireArcher', 500, false);
    const foe = b.spawnEnemy('jangseungSpirit', false, 600);
    b.step(0.5);
    expect(foe.status!.burnDps).toBeCloseTo(5.2);
    const plain = newBattle();
    ally(plain, 'foxfireArcher', 500, false);
    const foe2 = plain.spawnEnemy('jangseungSpirit', false, 600);
    plain.step(0.5);
    expect(foe2.status!.burnDps).toBeCloseTo(4);
  });

  it('불씨 Ⅱ: 화상 최대 중첩 2', () => {
    const b = newBattle(['emberII']);
    ally(b, 'foxfireArcher', 500, false);
    ally(b, 'foxfireArcher', 505, false);
    const foe = b.spawnEnemy('jangseungSpirit', false, 600);
    b.step(0.5);
    expect(foe.status!.burnStacks).toBe(2);
    const plain = newBattle();
    ally(plain, 'foxfireArcher', 500, false);
    ally(plain, 'foxfireArcher', 505, false);
    const foe2 = plain.spawnEnemy('jangseungSpirit', false, 600);
    plain.step(0.5);
    expect(foe2.status!.burnStacks).toBe(1);
  });

  it('수호의 맹세 Ⅰ: 신수 2마리 이상이면 신수가 받는 피해 -15%', () => {
    const b = newBattle(['guardianVowI']);
    const one = ally(b, 'bulgasari');
    const club = ally(b, 'clubGoblin');
    b.step(0.05);
    expect(one.status!.damageReduction).toBe(0);
    const two = ally(b, 'haetae');
    b.step(0.05);
    expect(one.status!.damageReduction).toBeCloseTo(0.15);
    expect(two.status!.damageReduction).toBeCloseTo(0.15);
    expect(club.status!.damageReduction).toBe(0);
  });

  it('수호의 맹세 Ⅱ: 신수 반경 120 안 아군이 초당 최대 체력 2% 회복 (회복 차단 적용)', () => {
    const b = newBattle(['guardianVowII']);
    const g = ally(b, 'haetae', 500);
    const near = ally(b, 'clubGoblin', 620);
    const far = ally(b, 'clubGoblin', 621);
    const blocked = ally(b, 'clubGoblin', 600);
    g.hp = 600;
    near.hp = far.hp = blocked.hp = 60;
    b.blockHeal(blocked, 10);
    b.step(1);
    expect(g.hp).toBeCloseTo(600 + 1000 * 0.02); // 620
    expect(near.hp).toBeCloseTo(60 + 120 * 0.02); // 62.4
    expect(far.hp).toBe(60);
    expect(blocked.hp).toBe(60);
  });

  it('순풍 Ⅰ: 바람 2마리 이상이면 바람 유닛 이동 +20%, 공격 속도 +10%', () => {
    const b = newBattle(['tailwindI']);
    const m1 = ally(b, 'magpieFlock');
    b.step(0.05);
    expect(m1.status!.moveMultiplier).toBe(1);
    const m2 = ally(b, 'magpieFlock');
    const club = ally(b, 'clubGoblin');
    b.step(0.05);
    expect(m1.status!.moveMultiplier).toBeCloseTo(1.2);
    expect(m2.status!.attackSpeedBonus).toBeCloseTo(0.1);
    expect(club.status!.moveMultiplier).toBe(1);
  });

  it('순풍 Ⅱ: 바람 유닛의 공격이 적 이동 속도 -20%, 1.5초', () => {
    const b = newBattle(['tailwindII']);
    const m = ally(b, 'magpieFlock', 500, false);
    const foe = b.spawnEnemy('jangseungSpirit', false, 600);
    b.step(0.5);
    expect(foe.status!.slowRatio).toBeCloseTo(0.2);
    m.hp = 0;
    b.step(1.6);
    expect(foe.status!.slowed).toBe(false);
  });

  it('도깨비불: 화상 걸린 적을 도깨비가 치면 피해 +40%', () => {
    const b = newBattle(['dokkaebiFire']);
    ally(b, 'clubGoblin', 500, false);
    const foe = b.spawnEnemy('jangseungSpirit', false, 515);
    b.applyBurn(foe, 1);
    b.step(0.05);
    // 화상 1 x 0.05 + 14 x 1.4
    expect(foe.hp).toBeCloseTo(400 - 0.05 - 14 * 1.4);
  });

  it('도깨비불: 화상이 없으면 x1', () => {
    const b = newBattle(['dokkaebiFire']);
    ally(b, 'clubGoblin', 500, false);
    const foe = b.spawnEnemy('jangseungSpirit', false, 515);
    b.step(0.05);
    expect(foe.hp).toBeCloseTo(400 - 14);
  });

  it('수호 진형: 해태가 앞에 있으면 그 뒤 원거리·마법 유닛 받는 피해 -30%', () => {
    const b = newBattle(['guardFormation']);
    ally(b, 'haetae', 600);
    const behind = ally(b, 'foxfireArcher', 500);
    const mage = ally(b, 'gumiho', 550);
    const front = ally(b, 'foxfireArcher', 700);
    const melee = ally(b, 'clubGoblin', 500);
    b.step(0.05);
    expect(behind.status!.damageReduction).toBeCloseTo(0.3);
    expect(mage.status!.damageReduction).toBeCloseTo(0.3);
    expect(front.status!.damageReduction).toBe(0);
    expect(melee.status!.damageReduction).toBe(0);
  });

  it('불바람: 바람 유닛이 화상 걸린 적을 치면 반경 60에 화상 확산 (다시 번지지 않음)', () => {
    const b = newBattle(['fireWind']);
    ally(b, 'magpieFlock', 500, false);
    const e1 = b.spawnEnemy('eggGhost', false, 600);
    const e2 = b.spawnEnemy('eggGhost', false, 640);
    const e3 = b.spawnEnemy('eggGhost', false, 690);
    b.applyBurn(e1, 5);
    b.step(0.5);
    expect(e2.status!.burning).toBe(true);
    expect(e2.status!.burnDps).toBeCloseTo(5);
    expect(e3.status!.burning).toBe(false); // e1에서는 90, e2에서 번진 화상은 다시 번지지 않음

    const plain = newBattle();
    ally(plain, 'magpieFlock', 500, false);
    plain.spawnEnemy('eggGhost', false, 600);
    const p2 = plain.spawnEnemy('eggGhost', false, 640);
    plain.applyBurn(plain.enemies[0], 5);
    plain.step(0.5);
    expect(p2.status!.burning).toBe(false);
  });

  it('신수의 축복: 신수 반경 120 안 도깨비 최대 체력 +30%, 벗어나면 되돌리고 현재 체력 클램프', () => {
    const b = newBattle(['divineBlessing']);
    ally(b, 'haetae', 500);
    const near = ally(b, 'clubGoblin', 550);
    const archer = ally(b, 'foxfireArcher', 550);
    b.step(0.05);
    expect(near.maxHp).toBeCloseTo(156);
    expect(near.hp).toBe(120); // 현재 체력은 그대로
    expect(archer.maxHp).toBe(70); // 도깨비가 아님
    near.hp = 150;
    near.x = 700; // 200 떨어짐
    b.step(0.05);
    expect(near.maxHp).toBe(120);
    expect(near.hp).toBe(120);
  });

  it('백귀야행: 4태그가 모두 있으면 모든 아군(영웅 포함) 공격력 +20%, 받는 피해 -10%', () => {
    const b = newBattle(['hundredDemons']);
    const club = ally(b, 'clubGoblin');
    ally(b, 'foxfireArcher');
    ally(b, 'bulgasari');
    b.step(0.05);
    expect(club.status!.attackBonus).toBe(0); // 바람 없음
    const magpie = ally(b, 'magpieFlock');
    b.step(0.05);
    for (const a of [club, magpie, b.allies[1]]) {
      expect(a.status!.attackBonus).toBeCloseTo(0.2);
      expect(a.status!.damageReduction).toBeCloseTo(0.1);
    }
    expect(b.hero.status!.attackBonus).toBeCloseTo(0.2);
    expect(b.hero.status!.damageReduction).toBeCloseTo(0.1);
    expect(b.synergy.activeIds()).toEqual(['hundredDemons']);
  });
});

describe('연계와 버프 해제', () => {
  it('해제 중인 유닛에게는 연계 버프가 적용되지 않는다', () => {
    const b = newBattle(['dokkaebiGatheringI', 'hundredDemons']);
    const list = clubs(b, 3);
    b.dispelBuffs(list[0], 5);
    b.step(0.05);
    expect(list[0].status!.attackSpeedBonus).toBe(0);
    expect(list[1].status!.attackSpeedBonus).toBeCloseTo(0.15);
  });

  it('해제 중에는 신수의 축복도 받지 못한다', () => {
    const b = newBattle(['divineBlessing']);
    ally(b, 'haetae', 500);
    const club = ally(b, 'clubGoblin', 550);
    b.dispelBuffs(club, 5);
    b.step(0.05);
    expect(club.maxHp).toBe(120);
  });

  it('공격자가 해제 중이면 도깨비불이 적용되지 않는다 (x1)', () => {
    const b = newBattle(['dokkaebiFire']);
    const club = ally(b, 'clubGoblin', 500, false);
    b.dispelBuffs(club, 100);
    const foe = b.spawnEnemy('jangseungSpirit', false, 515);
    b.applyBurn(foe, 1);
    b.step(0.05);
    expect(foe.hp).toBeCloseTo(400 - 0.05 - 14);
  });

  it('공격자가 해제 중이면 불씨·순풍 Ⅱ·불바람이 적용되지 않는다', () => {
    const b = newBattle(['emberI', 'emberII', 'tailwindII', 'fireWind']);
    const archer = ally(b, 'foxfireArcher', 500, false);
    const club = ally(b, 'clubGoblin', 560, false);
    const magpie = ally(b, 'magpieFlock', 450, false);
    for (const a of [archer, club, magpie]) b.dispelBuffs(a, 100);
    const foe = b.spawnEnemy('jangseungSpirit', false, 575);
    const other = b.spawnEnemy('eggGhost', false, 600);
    b.applyBurn(foe, 1);
    b.step(0.5);
    expect(foe.status!.burnDps).toBeCloseTo(4); // 불씨 Ⅰ 없음
    expect(foe.status!.burnStacks).toBe(1); // 불씨 Ⅱ 없음
    expect(foe.status!.slowed).toBe(false); // 순풍 Ⅱ 없음
    expect(other.status!.burning).toBe(false); // 불바람 없음
  });
});
