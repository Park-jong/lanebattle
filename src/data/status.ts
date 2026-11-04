import type { AttackType, EnemyTrait, Tag } from './types';

// numbers.md 1장 상태 효과 / 피해 계산
export const STATUS = {
  /** 화상: 지속 시간(초)과 기본 최대 중첩 (연계에서 2로 늘릴 수 있다) */
  burn: { duration: 3, maxStacks: 1 },
  /** 방어 파괴: 중첩당 받는 피해 증가, 기본 최대 중첩, 지속(초) */
  defenseBreak: { damagePerStack: 0.1, maxStacks: 5, duration: 6 },
  /** 기절·붙잡기를 보스에게 걸면 이 시간(초)의 경직으로 대체 */
  bossStagger: 0.5,
  /** 받는 피해 감소 합계 상한 */
  damageReductionCap: 0.7,
  /** 이 중첩 이상이면 갑옷 특성이 무효 */
  armorNegateStacks: 3,
  /** 보스 상성 배율 */
  bossWeaknessMultiplier: 2,
  bossResistanceMultiplier: 0.2,
  /** 타이머 만료 판정 오차 */
  epsilon: 1e-9,
} as const;

/** 적 특성 배율 규칙. attackTypes/tags 중 하나라도 맞으면 적용 */
export interface TraitRule {
  trait: EnemyTrait;
  attackTypes?: readonly AttackType[];
  tags?: readonly Tag[];
  multiplier: number;
  /** 방어 파괴가 충분히 쌓이면 무효가 되는 규칙 (갑옷) */
  negatedByDefenseBreak?: boolean;
}

export const TRAIT_RULES: readonly TraitRule[] = [
  { trait: 'swarm', attackTypes: ['magic'], multiplier: 1.5 },
  { trait: 'ghost', attackTypes: ['melee'], multiplier: 0.5 },
  { trait: 'ghost', tags: ['fire'], multiplier: 1.5 },
  { trait: 'armor', attackTypes: ['ranged', 'magic'], multiplier: 0.5, negatedByDefenseBreak: true },
  { trait: 'flying', tags: ['wind'], multiplier: 1.5 },
];
