import type { EnemyTrait, Tag } from './types';

// numbers.md 4장(아군)·5장(적) 고유 능력의 파라미터. 키는 유닛 id

/** 버프 수치 (battle/status.ts의 BuffEffect와 같은 모양, 0.2 = +20%) */
export interface BuffValues {
  attack?: number;
  moveSpeed?: number;
  attackSpeed?: number;
  damageReduction?: number;
}

export interface AbilityDef {
  /** 소환 후 첫 공격 피해 배율 */
  firstStrikeMultiplier?: number;
  /** every번째 공격마다 대상에게 넉백 + 기절 */
  nthStrike?: { every: number; knockback: number; stun: number };
  /** interval초마다 사거리 안 가장 앞의 적 하나를 duration초 붙잡음 */
  grab?: { interval: number; duration: number };
  /** 오라: 반경 안 아군에게 효과 */
  aura?: { radius: number; effect: BuffValues };
  /** 반경 안 아군을 노리는 적 투사체가 chance 확률로 빗나감 (여럿이어도 합산 없음) */
  missAura?: { radius: number; chance: number };
  /** 특정 특성의 대상에게 주는 피해 배율 (공격자 쪽 배율) */
  vsTrait?: { trait: EnemyTrait; multiplier: number };
  /** 공격이 맞은 대상에게 거는 효과 */
  onHit?: {
    defenseBreak?: boolean;
    slow?: { ratio: number; duration: number };
    healBlock?: number;
  };
  /** 공격 대상 제한: 원거리·마법 아군 우선(나머지는 지나감) / 서낭당만 */
  targeting?: 'rangedAndMagicFirst' | 'baseOnly';
  /** 기지에 주는 피해 배율 */
  baseDamageMultiplier?: number;
  /** interval초마다 최대 체력·공격력 x multiplier, 몸집 x sizeMultiplier (최대 maxCount회) */
  growth?: { interval: number; multiplier: number; sizeMultiplier: number; maxCount: number };
  /** interval초마다 반경 안 적 대상(아군 쪽)에게 버프 해제 */
  dispelPulse?: { interval: number; radius: number; duration: number };
  /** 이 태그가 붙은 공격의 피해·상태를 무효화 */
  immuneTags?: readonly Tag[];
}

export const ABILITIES: Readonly<Record<string, AbilityDef>> = {
  // ----- 아군 -----
  oneLegGoblin: { firstStrikeMultiplier: 3 },
  sumoGoblin: { nthStrike: { every: 3, knockback: 60, stun: 0.5 } },
  bulgasari: { onHit: { defenseBreak: true } },
  haetae: { grab: { interval: 8, duration: 2 } },
  samjokgo: { aura: { radius: 150, effect: { attack: 0.2 } } },
  magpieFlock: { vsTrait: { trait: 'flying', multiplier: 2 } },
  yeongdeungWind: {
    aura: { radius: 180, effect: { moveSpeed: 0.15, attackSpeed: 0.15 } },
    missAura: { radius: 180, chance: 0.25 },
  },
  // ----- 적 -----
  waterGhostThrower: { onHit: { slow: { ratio: 0.3, duration: 2 } } },
  maidenGhost: { targeting: 'rangedAndMagicFirst' },
  geuseundae: { growth: { interval: 5, multiplier: 1.15, sizeMultiplier: 1.08, maxCount: 6 } },
  sonGakshi: { onHit: { healBlock: 4 } },
  grimReaper: { dispelPulse: { interval: 6, radius: 120, duration: 3 } },
  gangcheol: { immuneTags: ['fire'] },
  dueoksini: { targeting: 'baseOnly', baseDamageMultiplier: 2 },
};

const NO_ABILITY: AbilityDef = {};

export function getAbility(id: string): AbilityDef {
  return ABILITIES[id] ?? NO_ABILITY;
}
