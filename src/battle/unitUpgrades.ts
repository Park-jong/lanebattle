import type { AbilityDef } from '../data/abilities';
import type { AllyDef } from '../data/types';
import type { UnitModifiers, UnitParams } from './modifiers';

/** 유닛 하나의 ②·③ 적용 규칙. 새 유닛 규칙은 표에 추가하면 된다 */
interface UnitUpgradeRule {
  stats?: (def: AllyDef, core: UnitParams | null, awaken: UnitParams | null) => Partial<AllyDef>;
  ability?: (ability: AbilityDef, core: UnitParams | null, awaken: UnitParams | null) => AbilityDef;
}

const RULES: Readonly<Record<string, UnitUpgradeRule>> = {
  clubGoblin: {
    stats: (def, core) =>
      core ? { cost: Math.round(def.cost * (1 - core.costReduction)), cooldown: def.cooldown * (1 - core.cooldownReduction) } : {},
    ability: (a, _core, awaken) => (awaken ? { ...a, killSpawn: { chance: awaken.chance, count: awaken.count } } : a),
  },
  oneLegGoblin: {
    ability: (a, core, awaken) => ({
      ...a,
      ...(core ? { firstStrikeMultiplier: core.chargeMultiplier } : {}),
      ...(awaken ? { pierce: { pathExtra: awaken.pathExtra } } : {}),
    }),
  },
  sumoGoblin: {
    ability: (a, core, awaken) =>
      a.nthStrike
        ? {
            ...a,
            nthStrike: {
              ...a.nthStrike,
              ...(core ? { every: core.everyNth } : {}),
              ...(awaken ? { collisionDamage: awaken.collisionDamage } : {}),
            },
          }
        : a,
  },
  foxfireArcher: {
    stats: (_def, core) => (core ? { burnPerSec: core.burnPerSec } : {}),
    ability: (a, _core, awaken) => (awaken ? { ...a, multiTarget: awaken.targets } : a),
  },
  gumiho: {
    stats: (def, core) => (core && def.areaRadius ? { areaRadius: def.areaRadius * (1 + core.areaBonus) } : {}),
    ability: (a, _core, awaken) => (awaken ? { ...a, salvo: { shots: awaken.shots, interval: awaken.shotInterval } } : a),
  },
  bulgasari: {
    ability: (a, core, awaken) => ({
      ...a,
      ...(core ? { onHit: { ...a.onHit, defenseBreakMaxStacks: core.maxStacks } } : {}),
      ...(awaken ? { armorKill: { healRatio: awaken.healRatio, attackPerStack: awaken.attackPerStack } } : {}),
    }),
  },
  haetae: {
    ability: (a, core, awaken) => ({
      ...a,
      ...(core && a.grab ? { grab: { ...a.grab, duration: core.holdSeconds } } : {}),
      ...(awaken ? { aura: { radius: awaken.radius, effect: { damageReduction: awaken.damageReduction } } } : {}),
    }),
  },
  samjokgo: {
    ability: (a, core, awaken) => ({
      ...a,
      ...(core && a.aura ? { aura: { ...a.aura, effect: { ...a.aura.effect, attack: core.auraBonus } } } : {}),
      ...(awaken ? { sunFlame: { interval: awaken.interval, radius: awaken.radius } } : {}),
    }),
  },
  magpieFlock: {
    stats: (_def, core) => (core ? { summonCount: core.flocks } : {}),
    ability: (a, _core, awaken) =>
      awaken && a.vsTrait ? { ...a, vsTrait: { ...a.vsTrait, multiplier: awaken.flyingMultiplier, stagger: awaken.stagger } } : a,
  },
  yeongdeungWind: {
    ability: (a, core, awaken) => ({
      ...a,
      ...(core && a.aura ? { aura: { ...a.aura, effect: { moveSpeed: core.auraBonus, attackSpeed: core.auraBonus } } } : {}),
      ...(awaken && a.missAura ? { missAura: { ...a.missAura, chance: awaken.missChance, reflect: awaken.reflect > 0 } } : {}),
    }),
  },
};

/** 업그레이드를 반영한 아군 정의. 보정이 없으면 원본을 그대로 돌려준다 */
export function upgradeAllyDef(def: AllyDef, mods: UnitModifiers | undefined): AllyDef {
  if (!mods) return def;
  const extra = RULES[def.id]?.stats?.(def, mods.core, mods.awaken) ?? {};
  return { ...def, ...extra, maxHp: def.maxHp * mods.hpMultiplier, attack: def.attack * mods.attackMultiplier };
}

/** 업그레이드를 반영한 고유 능력. 보정이 없으면 원본을 그대로 돌려준다 */
export function upgradeAbility(base: AbilityDef, unitId: string, mods: UnitModifiers | undefined): AbilityDef {
  if (!mods) return base;
  return RULES[unitId]?.ability?.(base, mods.core, mods.awaken) ?? base;
}
