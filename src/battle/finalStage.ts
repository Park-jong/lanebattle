import { DESCENT_TUNING, GHOST_GATE_TUNING } from '../data/finalStage';
import type { SkillId } from '../data/skills';
import type { AllyDef } from '../data/types';
import type { BattleModifiers } from './modifiers';

// 강림·귀문개방(numbers.md 11장)이 바꾸는 값을 계산하는 순수 함수. Battle과 툴팁 문구가 같은 식을 쓴다

/** 강림 중 스킬 쿨타임 고정값. 강림이 아니면 기본 쿨타임을 그대로 돌려준다 */
export function descentCooldown(mods: BattleModifiers, id: SkillId, normal: number): number {
  return mods.hero.descent ? DESCENT_TUNING.cooldowns[id] : normal;
}

/** 강림 중 스킬 신력 소모. Q는 0, 나머지는 기본값 */
export function descentSpiritCost(mods: BattleModifiers, id: SkillId, normal: number): number {
  return mods.hero.descent ? (DESCENT_TUNING.spiritCosts[id] ?? normal) : normal;
}

/** 강림 중 영웅이 주는 피해 배율 (아니면 1) */
export function descentDamageMultiplier(mods: BattleModifiers): number {
  return mods.hero.descent ? DESCENT_TUNING.damageMultiplier : 1;
}

/** 귀문개방: 업그레이드가 반영된 소환 비용 30 고정, 쿨타임 절반. 아니면 그대로 */
export function applyGhostGate(def: AllyDef, mods: BattleModifiers): AllyDef {
  if (!mods.ghostGate) return def;
  return { ...def, cost: GHOST_GATE_TUNING.summonCost, cooldown: def.cooldown * GHOST_GATE_TUNING.summonCooldownMultiplier };
}
