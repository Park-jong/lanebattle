import type { SkillId } from './skills';

// numbers.md 11장 최종 단계 업그레이드(강림·귀문개방) 수치.
// 빙의(10장)와 함께 하나의 배타 그룹이다. 효과 계산은 battle/finalStage.ts가 한다

/** 최종 단계 종류. 노드의 finalStage 값 */
export type FinalStageId = 'possession' | 'descent' | 'ghostGate';

/** 최종 단계 배타 그룹 이름: 셋 중 하나만 찍을 수 있다 */
export const FINAL_STAGE_GROUP = 'finalStage';

/** 강림 (무당 트리, 무당 + 살림 트리 완료 후 해금) */
export const DESCENT_TUNING = {
  nodeId: 'descent',
  cost: 40,
  /** 영웅 최대 체력 배율 (다른 체력 배율과 곱) */
  hpMultiplier: 3,
  /** 영웅이 주는 모든 피해 배율 (고정 피해 단계, 상성 계산 전) */
  damageMultiplier: 3,
  /** 신력 시간 충전 배율 (신력 샘 배율과 곱) */
  spiritChargeMultiplier: 3,
  /** 스킬 쿨타임 고정값(초). 쿨타임 감소보다 우선 */
  cooldowns: { fanWind: 0.1, blessing: 1, bladeDance: 5 } as Readonly<Record<SkillId, number>>,
  /** 신력 소모 고정값. 적은 스킬만 바뀐다 */
  spiritCosts: { fanWind: 0 } as Readonly<Partial<Record<SkillId, number>>>,
} as const;

/** 귀문개방 (연계 트리, 요괴 유닛 5종 ①②③ + 연계 트리 완료 후 해금) */
export const GHOST_GATE_TUNING = {
  nodeId: 'ghostGate',
  cost: 1,
  /** 해금에 필요한 ①②③을 모두 찍은 요괴 유닛 수 */
  minAwakenedUnits: 5,
  /** 모든 유닛 소환 비용 고정값 */
  summonCost: 10,
  /** 소환 쿨타임 배율 (유닛 업그레이드 반영 후 곱한다) */
  summonCooldownMultiplier: 0.5,
} as const;

/** 숨겨진 최종 단계 칸의 힌트 한 줄 (자세히 말하지 않는다) */
export const FINAL_STAGE_HINTS: Readonly<Record<FinalStageId, string>> = {
  possession: '이 요괴를 끝까지 깨우고 무당의 길을 모두 걸으면, 둘은 하나가 된다…',
  descent: '무당의 길과 살림을 모두 갖추면, 하늘에서 무언가 내려온다…',
  ghostGate: '여러 요괴를 깊이 깨우고 인연을 모두 이으면, 닫힌 문이 열린다…',
};
