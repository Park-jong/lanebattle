import { STATUS, TRAIT_RULES } from '../data/status';
import { COMBAT } from '../data/combat';
import type { Affinity, AttackSource, AttackType, EnemyTrait, Tag } from '../data/types';

/** 공격 정보: 유형, 태그, 공격자 종류 */
export interface AttackInfo {
  type: AttackType;
  tags: readonly Tag[];
  source: AttackSource;
  /** 방어 파괴를 거는 공격인지 (보스 약점 판정용, strike가 채운다) */
  defenseBreak?: boolean;
  /** 공격자가 비행 유닛인지 (보스 약점 판정용, strike가 채운다) */
  attackerFlying?: boolean;
}

/** 피해를 받는 쪽의 계산용 정보 */
export interface DamageTarget {
  traits: readonly EnemyTrait[];
  /** 보스 약점·저항 (없으면 일반 적) */
  weakness?: Affinity;
  resistance?: Affinity;
  defenseBreakStacks?: number;
  /** 받는 피해 감소 합계 (상한은 함수 안에서 적용) */
  damageReduction?: number;
  /** 이 태그가 붙은 공격은 피해 0 (최소 피해도 적용하지 않음) */
  immuneTags?: readonly Tag[];
}

export interface DamageOptions {
  /** 공격력 버프 합 (0.2 = +20%) */
  attackBonus?: number;
  /** 지속 피해: 공격력 버프와 공격 유형 배율, 최소 피해 1을 적용하지 않는다 */
  dot?: boolean;
  /** 공격자 쪽 추가 배율 (외다리 첫 타, 까치 등). 기본 1 */
  multiplier?: number;
}

/** 상성 해당 여부. 지속 피해(dot)는 공격 유형·방어 파괴·비행 공격자를 보지 않고 태그로만 판정한다 */
function matches(affinity: Affinity | undefined, attack: AttackInfo, dot: boolean): boolean {
  if (!affinity) return false;
  if (affinity.tags?.some((t) => attack.tags.includes(t))) return true;
  if (dot) return false;
  if (affinity.attackTypes?.includes(attack.type)) return true;
  if (affinity.defenseBreak && attack.defenseBreak) return true;
  return (affinity.flyingAttacker && attack.attackerFlying) ?? false;
}

/** 적 특성 배율. 해당하는 규칙을 모두 곱한다 */
export function traitMultiplier(attack: AttackInfo, target: DamageTarget, dot = false): number {
  const broken = (target.defenseBreakStacks ?? 0) >= STATUS.armorNegateStacks;
  let result = 1;
  for (const rule of TRAIT_RULES) {
    if (!target.traits.includes(rule.trait)) continue;
    if (rule.negatedByDefenseBreak && broken) continue;
    const byType = !dot && (rule.attackTypes?.includes(attack.type) ?? false);
    const byTag = rule.tags?.some((t) => attack.tags.includes(t)) ?? false;
    if (byType || byTag) result *= rule.multiplier;
  }
  return result;
}

/** 보스 상성 배율. 약점 x2(한 번만), 저항 x0.2, 둘 다면 곱한다 */
export function affinityMultiplier(attack: AttackInfo, target: DamageTarget, dot = false): number {
  let result = 1;
  if (matches(target.weakness, attack, dot)) result *= STATUS.bossWeaknessMultiplier;
  if (matches(target.resistance, attack, dot)) result *= STATUS.bossResistanceMultiplier;
  return result;
}

/** 피해 숫자 색을 정하는 상성 분류 */
export type Matchup = 'weak' | 'resist' | 'normal';

/** 적 특성 배율과 보스 상성 배율의 곱이 1보다 크면 약점, 작으면 저항 */
export function classifyMatchup(attack: AttackInfo, target: DamageTarget, dot = false): Matchup {
  const m = traitMultiplier(attack, target, dot) * affinityMultiplier(attack, target, dot);
  if (m > 1 + 1e-9) return 'weak';
  if (m < 1 - 1e-9) return 'resist';
  return 'normal';
}

/**
 * 최종 피해 = 기본 공격력 x (1 + 공격력 버프) x 공격자 배율 x 특성 배율 x 보스 상성 배율
 *            x (1 + 받는 피해 증가 - 받는 피해 감소). 최소 1.
 */
export function calcDamage(
  base: number,
  attack: AttackInfo,
  target: DamageTarget,
  options: DamageOptions = {},
): number {
  if (target.immuneTags?.some((t) => attack.tags.includes(t))) return 0;
  const dot = options.dot ?? false;
  const attackBonus = dot ? 0 : (options.attackBonus ?? 0);
  const increase = (target.defenseBreakStacks ?? 0) * STATUS.defenseBreak.damagePerStack;
  const reduction = Math.min(STATUS.damageReductionCap, Math.max(0, target.damageReduction ?? 0));
  const damage =
    base *
    (1 + attackBonus) *
    (options.multiplier ?? 1) *
    traitMultiplier(attack, target, dot) *
    affinityMultiplier(attack, target, dot) *
    (1 + increase - reduction);
  return dot ? damage : Math.max(COMBAT.minDamage, damage);
}
