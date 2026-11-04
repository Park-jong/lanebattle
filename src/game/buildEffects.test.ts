import { describe, expect, it } from 'vitest';
import { noModifiers } from '../battle/modifiers';
import { UPGRADE_NODES } from '../data/upgrades';
import { computeBuildEffects, parseUpgradeQuery } from './buildEffects';

describe('computeBuildEffects', () => {
  it('빈 빌드는 효과 없음과 같다', () => {
    expect(computeBuildEffects({})).toEqual(noModifiers());
  });

  it('노드 63개 모두 찍으면 효과 없음과 달라진다', () => {
    expect(UPGRADE_NODES).toHaveLength(63);
    for (const node of UPGRADE_NODES) {
      expect(computeBuildEffects({ [node.id]: node.maxLevel }), node.id).not.toEqual(noModifiers());
    }
  });

  it('레벨이 누적된다 (방울 단련 +10%/레벨, 단단한 몸 +15%/레벨)', () => {
    expect(computeBuildEffects({ bellTraining: 1 }).hero.attackMultiplier).toBeCloseTo(1.1);
    expect(computeBuildEffects({ bellTraining: 3 }).hero.attackMultiplier).toBeCloseTo(1.3);
    expect(computeBuildEffects({ sturdyBody: 2 }).hero.hpMultiplier).toBeCloseTo(1.3);
    expect(computeBuildEffects({ quickRevive: 2 }).hero.reviveReduction).toBe(2);
    expect(computeBuildEffects({ spiritSpring: 2 }).hero.spiritChargeMultiplier).toBeCloseTo(1.4);
  });

  it('최대 레벨을 넘긴 값과 알 수 없는 id는 잘라 내거나 무시한다', () => {
    expect(computeBuildEffects({ bellTraining: 99 }).hero.attackMultiplier).toBeCloseTo(1.3);
    expect(computeBuildEffects({ nope: 3, bellTraining: -1 })).toEqual(noModifiers());
  });

  it('배타 갈래는 각자 자기 효과만 낸다', () => {
    const tornado = computeBuildEffects({ fanWindTornado: 1 }).skills.fanWind;
    expect(tornado).toEqual({ rangeMultiplier: 1.5, damageMultiplier: 1, knockbackMultiplier: 1 });
    const gust = computeBuildEffects({ fanWindGust: 1 }).skills.fanWind;
    expect(gust).toEqual({ rangeMultiplier: 1, damageMultiplier: 2, knockbackMultiplier: 1.5 });
    const rite = computeBuildEffects({ blessingGrandRite: 1 }).skills.blessing;
    expect(rite).toEqual({ rangeMultiplier: 1.5, healRatio: 0.4, attackBonus: 0.25 });
    const release = computeBuildEffects({ blessingSpiritRelease: 1 }).skills.blessing;
    expect(release).toEqual({ rangeMultiplier: 1, healRatio: 0.25, attackBonus: 0.75 });
    expect(computeBuildEffects({ bladeDanceBlades: 1 }).skills.bladeDance).toEqual({
      cooldownMultiplier: 1, extraDuration: 3, extraDamagePerSec: 40,
    });
    expect(computeBuildEffects({ bladeDancePossession: 1 }).skills.bladeDance.cooldownMultiplier).toBeCloseTo(0.6);
  });

  it('무당 각성과 깊은 신기', () => {
    const fx = computeBuildEffects({ mudangAwakening: 1, deepSpirit: 1 });
    expect(fx.hero.awakening).toEqual({ everyNth: 3, radius: 80, attackMultiplier: 1.5 });
    expect(fx.hero.maxSpiritBonus).toBe(50);
  });

  it('요괴: 유닛별로 기본·핵심·각성이 따로 담긴다', () => {
    const fx = computeBuildEffects({ clubGoblinBasic: 1, clubGoblinCore: 1, haetaeBasic: 1 });
    expect(fx.units.clubGoblin.hpMultiplier).toBeCloseTo(1.25);
    expect(fx.units.clubGoblin.attackMultiplier).toBeCloseTo(1.25);
    expect(fx.units.clubGoblin.core).toEqual({ costReduction: 0.2, cooldownReduction: 0.3 });
    expect(fx.units.clubGoblin.awaken).toBeNull();
    expect(fx.units.haetae.core).toBeNull();
    expect(fx.units.gumiho).toBeUndefined();
  });

  it('연계 노드 id가 연계 목록이 된다', () => {
    const fx = computeBuildEffects({ emberI: 1, hundredDemons: 1, bellTraining: 1 });
    expect([...fx.synergies].sort()).toEqual(['emberI', 'hundredDemons']);
  });

  it('살림 7종', () => {
    const eco = computeBuildEffects({
      generousStart: 2, charmPouch: 3, qiCycle: 3, thriftyLiving: 2, spoils: 1, bigEconomy: 1, spiritCharm: 1,
    }).economy;
    expect(eco.startTalisman).toBe(50);
    expect(eco.maxTalismanBonus).toBe(120);
    expect(eco.chargePerSecBonus).toBeCloseTo(4.5);
    expect(eco.gatherCostMultiplier).toBeCloseTo(0.6);
    expect(eco.killTalismanMultiplier).toBeCloseTo(1.5);
    expect(eco.gatherMaxLevel).toBe(7);
    expect(eco.spiritPerCharm).toEqual({ unit: 100, spirit: 10 });
  });

  it('입력 객체를 바꾸지 않고, 호출마다 새 객체를 돌려준다', () => {
    const levels = { bellTraining: 2 };
    const a = computeBuildEffects(levels);
    a.hero.attackMultiplier = 99;
    expect(levels).toEqual({ bellTraining: 2 });
    expect(computeBuildEffects(levels).hero.attackMultiplier).toBeCloseTo(1.2);
    expect(noModifiers().hero.attackMultiplier).toBe(1);
  });
});

describe('parseUpgradeQuery (?upg=)', () => {
  it('레벨을 생략하면 최대 레벨', () => {
    expect(parseUpgradeQuery('bellTraining,fanWindGust')).toEqual({ bellTraining: 3, fanWindGust: 1 });
  });

  it('id:레벨 형식, 최대를 넘으면 잘라 낸다', () => {
    expect(parseUpgradeQuery('bellTraining:2,qiCycle:9')).toEqual({ bellTraining: 2, qiCycle: 3 });
  });

  it('알 수 없는 id·잘못된 레벨·빈 값은 무시한다', () => {
    expect(parseUpgradeQuery('nope,bellTraining:x,sturdyBody:0,')).toEqual({});
    expect(parseUpgradeQuery('')).toEqual({});
    expect(parseUpgradeQuery(null)).toEqual({});
  });

  it('신명·선행 규칙과 무관하게 4단 노드도 담긴다', () => {
    expect(parseUpgradeQuery('mudangAwakening,gumihoAwaken')).toEqual({ mudangAwakening: 1, gumihoAwaken: 1 });
  });
});
