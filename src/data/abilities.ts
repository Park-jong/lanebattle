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
  /** 타고난 방호. 버프 해제와 무관하게 적용 */
  damageReduction?: number;
  /** 근접 공격의 주 대상 주변 지상 적에게 주는 추가 피해 */
  cleave?: { radius: number; damageMultiplier: number };
  /** 소환 후 첫 공격 피해 배율 */
  firstStrikeMultiplier?: number;
  /** every번째 공격마다 대상에게 넉백 + 기절 */
  nthStrike?: { every: number; knockback: number; stun: number; collisionDamage?: number };
  /** interval초마다 사거리 안 가장 앞의 적 하나를 duration초 붙잡음 */
  grab?: { interval: number; duration: number };
  /** 오라: 반경 안 아군에게 효과 */
  aura?: { radius: number; effect: BuffValues };
  /** 반경 안 아군을 노리는 적 투사체가 chance 확률로 빗나감 (여럿이어도 합산 없음) */
  missAura?: { radius: number; chance: number; reflect?: boolean };
  /** 특정 특성의 대상에게 주는 피해 배율 (공격자 쪽 배율) */
  vsTrait?: { trait: EnemyTrait; multiplier: number; stagger?: number };
  /** 공격이 맞은 대상에게 거는 효과 */
  onHit?: {
    defenseBreak?: boolean;
    /** 방어 파괴 최대 중첩 (없으면 기본값) */
    defenseBreakMaxStacks?: number;
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
  // ----- 요괴 각성(③) 업그레이드로만 생기는 능력 -----
  /** 소환 후 첫 공격이 자신과 대상 사이(대상 너머 pathExtra까지)의 적 모두를 친다 */
  pierce?: { pathExtra: number };
  /** 한 번 공격할 때 서로 다른 대상 targets명에게 쏜다 */
  multiTarget?: number;
  /** 한 번 공격할 때 shots번 interval초 간격으로 쏜다 */
  salvo?: { shots: number; interval: number };
  /** 적을 처치하면 chance 확률로 같은 유닛 count마리를 추가 소환 */
  killSpawn?: { chance: number; count: number };
  /** 갑옷 적을 처치하면 체력 healRatio 회복, 그 판 동안 공격력 attackPerStack씩 중첩 */
  armorKill?: { healRatio: number; attackPerStack: number };
  /** interval초마다 반경 안 적 전체에 화상 */
  sunFlame?: { interval: number; radius: number };
  /** 이 태그가 붙은 공격의 피해·상태를 무효화 */
  immuneTags?: readonly Tag[];
}

export const ABILITIES: Readonly<Record<string, AbilityDef>> = {
  // ----- 아군 -----
  oneLegGoblin: { firstStrikeMultiplier: 3 },
  sumoGoblin: { nthStrike: { every: 3, knockback: 60, stun: 0.5 } },
  bulgasari: { onHit: { defenseBreak: true }, vsTrait: { trait: 'armor', multiplier: 1.5 } },
  haetae: { damageReduction: 0.2, grab: { interval: 8, duration: 2 } },
  samjokgo: { multiTarget: 2, aura: { radius: 220, effect: { attack: 0.2 } } },
  magpieFlock: { vsTrait: { trait: 'flying', multiplier: 2 } },
  yeongdeungWind: {
    aura: { radius: 180, effect: { moveSpeed: 0.15, attackSpeed: 0.15 } },
    missAura: { radius: 180, chance: 0.25 },
  },
  // ----- 적 -----
  waterGhostThrower: { onHit: { slow: { ratio: 0.3, duration: 2 } } },
  maidenGhost: { targeting: 'rangedAndMagicFirst' },
  jangseungSpirit: { cleave: { radius: 65, damageMultiplier: 0.75 } },
  geuseundae: { growth: { interval: 5, multiplier: 1.15, sizeMultiplier: 1.08, maxCount: 6 } },
  sonGakshi: { onHit: { healBlock: 4 } },
  grimReaper: { dispelPulse: { interval: 6, radius: 120, duration: 3 } },
  gangcheol: { immuneTags: ['fire'], cleave: { radius: 55, damageMultiplier: 0.75 } },
  dueoksini: { targeting: 'baseOnly', baseDamageMultiplier: 2 },
};

const NO_ABILITY: AbilityDef = {};

export function getAbility(id: string): AbilityDef {
  return ABILITIES[id] ?? NO_ABILITY;
}
