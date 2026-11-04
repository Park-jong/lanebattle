import type { Tag } from './types';

// numbers.md 9장 "연계" 14종. 기본은 모두 꺼짐 (8단계 업그레이드 트리에서 켠다)
export const SYNERGY = {
  /** 도깨비 3마리 이상: 도깨비 공격 속도 +15% */
  dokkaebiGatheringI: { name: '도깨비 모임 Ⅰ', tag: 'dokkaebi' as Tag, minCount: 3, attackSpeed: 0.15 },
  /** 도깨비 5마리 이상: 도깨비 공격력 +20% */
  dokkaebiGatheringII: { name: '도깨비 모임 Ⅱ', tag: 'dokkaebi' as Tag, minCount: 5, attack: 0.2 },
  /** 화상 피해 +30% */
  emberI: { name: '불씨 Ⅰ', burnDamageBonus: 0.3 },
  /** 화상 최대 중첩 2 */
  emberII: { name: '불씨 Ⅱ', burnMaxStacks: 2 },
  /** 신수 2마리 이상: 신수 받는 피해 -15% */
  guardianVowI: { name: '수호의 맹세 Ⅰ', tag: 'divine' as Tag, minCount: 2, damageReduction: 0.15 },
  /** 신수 반경 안 아군 초당 최대 체력 2% 회복 */
  guardianVowII: { name: '수호의 맹세 Ⅱ', tag: 'divine' as Tag, radius: 120, healPerSec: 0.02 },
  /** 바람 2마리 이상: 바람 유닛 이동 +20%, 공격 속도 +10% */
  tailwindI: { name: '순풍 Ⅰ', tag: 'wind' as Tag, minCount: 2, moveSpeed: 0.2, attackSpeed: 0.1 },
  /** 바람 유닛 공격이 적 이동 속도 -20%, 1.5초 */
  tailwindII: { name: '순풍 Ⅱ', tag: 'wind' as Tag, slowRatio: 0.2, slowDuration: 1.5 },
  /** 화상 걸린 적을 도깨비가 치면 피해 +40% */
  dokkaebiFire: { name: '도깨비불', tag: 'dokkaebi' as Tag, damageMultiplier: 1.4 },
  /** 해태가 앞(x가 더 큼)에 있으면 그 뒤 원거리·마법 유닛 받는 피해 -30% */
  guardFormation: { name: '수호 진형', guardianId: 'haetae', damageReduction: 0.3 },
  /** 바람 유닛이 화상 걸린 적을 치면 반경 안에 화상 확산 */
  fireWind: { name: '불바람', tag: 'wind' as Tag, radius: 60 },
  /** 신수 반경 안 도깨비 최대 체력 +30% */
  divineBlessing: { name: '신수의 축복', guardianTag: 'divine' as Tag, targetTag: 'dokkaebi' as Tag, radius: 120, maxHpBonus: 0.3 },
  /** 두 태그 유닛이 태그 수를 2로 셈 */
  linkRing: { name: '연계의 고리', dualTagCount: 2 },
  /** 4가지 태그가 모두 있으면 모든 아군(영웅 포함) 공격력 +20%, 받는 피해 -10% */
  hundredDemons: {
    name: '백귀야행',
    requiredTags: ['dokkaebi', 'fire', 'divine', 'wind'] as Tag[],
    attack: 0.2,
    damageReduction: 0.1,
  },
} as const;

export type SynergyId = keyof typeof SYNERGY;
export const ALL_SYNERGY_IDS = Object.keys(SYNERGY) as SynergyId[];

export function isSynergyId(value: string): value is SynergyId {
  return Object.prototype.hasOwnProperty.call(SYNERGY, value);
}
