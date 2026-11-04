import type { BuffValues } from './abilities';
import type { SkillId } from './skills';
import type { AttackType, Tag } from './types';

// numbers.md 10장 빙의: 공통 비용·쿨타임, 스킬 효과를 "기본 동작"의 조합으로 정의한다.
// 스킬 슬롯은 기존 영웅 스킬 id를 그대로 쓴다 (fanWind = Q, blessing = W, bladeDance = E).

/** 빙의 스킬 슬롯 순서 (Q, W, E) */
export const POSSESSION_SLOTS: readonly SkillId[] = ['fanWind', 'blessing', 'bladeDance'];

/** 빙의 스킬 공통 신력 비용과 쿨타임(초) */
export const POSSESSION_COMMON: Readonly<Record<SkillId, { spiritCost: number; cooldown: number }>> = {
  fanWind: { spiritCost: 12, cooldown: 3.6 },
  blessing: { spiritCost: 16, cooldown: 7.2 },
  bladeDance: { spiritCost: 32, cooldown: 24 },
};

/** "가장 가까운 적 N명" 계열이 닿는 최대 거리 (문서에 없어 정한 값) */
export const NEAREST_REACH = 400;

/** 적을 고르는 범위 */
export type PossessionArea =
  /** 영웅이 바라보는 쪽 range 안 (limit이 있으면 가까운 순 limit명) */
  | { kind: 'front'; range: number; limit?: number }
  /** 영웅 중심 반경 안 (limit이 있으면 가까운 순 limit명) */
  | { kind: 'radius'; radius: number; limit?: number }
  /** 영웅에게서 가장 가까운 적 count명 (NEAREST_REACH 안) */
  | { kind: 'nearest'; count: number }
  /** 영웅 앞쪽 ahead 지점을 중심으로 한 반경 */
  | { kind: 'point'; ahead: number; radius: number }
  /** 가장 가까운 적(NEAREST_REACH 안)의 위치를 중심으로 한 반경 */
  | { kind: 'nearestPoint'; radius: number };

/** 맞은 적마다 일어나는 일. damage가 없으면 상태 효과만 건다 */
export interface PossessionHitEffects {
  /** 공격 유형 (스킬별) */
  type: AttackType;
  /** 고정 피해 (공격력 버프·연계 미적용) */
  damage?: number;
  /** 화상 초당 피해 (불 태그 스킬에서만 걸린다) */
  burnPerSec?: number;
  /** 기절·붙잡기 시간(초). 보스는 0.5초 경직 */
  stun?: number;
  /** 넉백 거리. 보스는 무효 */
  knockback?: number;
  slow?: { ratio: number; duration: number };
  /** 방어 파괴 중첩 수 ('max' = 최대 중첩) */
  defenseBreak?: number | 'max';
  /** 넉백으로 밀려난 적이 부딪힌 적과 서로 입는 피해 */
  collision?: number;
  /** 이 스킬로 처치한 적 1마리당 영웅 최대 체력 비율 회복 */
  healOnKill?: number;
  /** 비행 적에게 주는 피해 배율 (까치 떼 쇄도) */
  flyingMultiplier?: number;
  /** true면 비행 적만 대상 (오작교 경직) */
  flyingOnly?: boolean;
}

export interface PossessionHit extends PossessionHitEffects {
  area: PossessionArea;
}

/** 스킬을 이루는 기본 동작 */
export type PossessionEffect =
  /** 범위 안 적에게 피해와 상태 효과 */
  | ({ kind: 'hit' } & PossessionHit)
  /** 영웅이 앞으로 distance 이동하며 지나간 길의 땅 위 적에게 피해 */
  | { kind: 'charge'; distance: number; hit: PossessionHitEffects }
  /** 같은 타격을 times번, interval초 간격으로 (첫 타는 즉시) */
  | { kind: 'repeat'; times: number; interval: number; hit: PossessionHit }
  /** 아군 무료 소환 (아군 상한 준수, 부적 미사용) */
  | { kind: 'summon'; unitId: string; count: number }
  /** 시간제 버프. tag를 주면 그 태그 아군만, radius를 주면 영웅 중심 반경 안만 (영웅은 항상 포함). heroEffect를 주면 영웅은 effect 대신 이것만 받는다 */
  | { kind: 'buff'; tag?: Tag; radius?: number; effect: BuffValues; heroEffect?: BuffValues; duration: number }
  /** 오라형 버프: duration초 동안 영웅 중심 반경 안 아군(영웅 포함). missChance는 반경 안 아군을 노리는 적 투사체의 빗나감 확률 */
  | { kind: 'aura'; radius: number; effect: BuffValues; duration: number; missChance?: number }
  /** 서낭당 최대 체력 비율 회복 */
  | { kind: 'shrineHeal'; ratio: number };

export interface PossessionSkillDef {
  name: string;
  effects: readonly PossessionEffect[];
}

/** 유닛 하나의 빙의 스킬 3개 (슬롯 id별) */
export type PossessionSkillSet = Readonly<Record<SkillId, PossessionSkillDef>>;

/** 유닛 id -> 빙의 스킬 (유닛 10종 모두) */
export const POSSESSION_SKILLS: Readonly<Record<string, PossessionSkillSet>> = {
  clubGoblin: {
    fanWind: { name: '방망이 난타', effects: [{ kind: 'hit', area: { kind: 'front', range: 150 }, type: 'melee', damage: 55 }] },
    blessing: { name: '뚝딱 소환', effects: [{ kind: 'summon', unitId: 'clubGoblin', count: 3 }] },
    bladeDance: {
      name: '도깨비 잔치',
      effects: [{ kind: 'buff', tag: 'dokkaebi', effect: { attack: 0.5, attackSpeed: 0.3 }, duration: 10 }],
    },
  },
  oneLegGoblin: {
    fanWind: { name: '외다리 돌진', effects: [{ kind: 'charge', distance: 200, hit: { type: 'melee', damage: 60 } }] },
    blessing: {
      name: '회오리 발차기',
      effects: [{ kind: 'hit', area: { kind: 'radius', radius: 150 }, type: 'melee', damage: 50, knockback: 100 }],
    },
    bladeDance: { name: '천둥 질주', effects: [{ kind: 'charge', distance: 400, hit: { type: 'melee', damage: 300, stun: 1 } }] },
  },
  sumoGoblin: {
    fanWind: {
      name: '들배지기',
      effects: [{ kind: 'hit', area: { kind: 'nearest', count: 1 }, type: 'melee', damage: 90, knockback: 150, stun: 1 }],
    },
    blessing: { name: '샅바 잡기', effects: [{ kind: 'hit', area: { kind: 'radius', radius: 150 }, type: 'melee', stun: 3 }] },
    bladeDance: {
      name: '천하장사',
      effects: [{ kind: 'hit', area: { kind: 'front', range: 250 }, type: 'melee', damage: 320, knockback: 200, collision: 40 }],
    },
  },
  foxfireArcher: {
    fanWind: {
      name: '여우불 연사',
      effects: [{ kind: 'hit', area: { kind: 'nearest', count: 3 }, type: 'ranged', damage: 40, burnPerSec: 8 }],
    },
    blessing: {
      name: '불꽃 비',
      effects: [{ kind: 'hit', area: { kind: 'point', ahead: 300, radius: 120 }, type: 'magic', damage: 60, burnPerSec: 10 }],
    },
    bladeDance: {
      name: '여우불 폭풍',
      effects: [{ kind: 'hit', area: { kind: 'front', range: 500 }, type: 'magic', damage: 250, burnPerSec: 15 }],
    },
  },
  gumiho: {
    fanWind: {
      name: '여우구슬',
      effects: [{ kind: 'hit', area: { kind: 'nearestPoint', radius: 80 }, type: 'magic', damage: 70, burnPerSec: 6 }],
    },
    blessing: {
      name: '홀림',
      effects: [{ kind: 'hit', area: { kind: 'radius', radius: 200 }, type: 'magic', stun: 1.5, slow: { ratio: 0.4, duration: 4 } }],
    },
    bladeDance: {
      name: '아홉 꼬리 업화',
      effects: [
        {
          kind: 'repeat', times: 9, interval: 0.2,
          hit: { area: { kind: 'radius', radius: 300 }, type: 'magic', damage: 45, burnPerSec: 6 },
        },
      ],
    },
  },
  bulgasari: {
    fanWind: {
      name: '쇠 씹기',
      effects: [{ kind: 'hit', area: { kind: 'front', range: 120 }, type: 'melee', damage: 60, defenseBreak: 3 }],
    },
    blessing: {
      name: '쇠 갑옷',
      effects: [{ kind: 'buff', radius: 150, effect: { damageReduction: 0.25 }, heroEffect: { damageReduction: 0.5 }, duration: 6 }],
    },
    bladeDance: {
      name: '탐식',
      effects: [{ kind: 'hit', area: { kind: 'radius', radius: 250 }, type: 'melee', damage: 280, defenseBreak: 'max', healOnKill: 0.1 }],
    },
  },
  haetae: {
    fanWind: {
      name: '정의의 일격',
      effects: [{ kind: 'hit', area: { kind: 'front', range: 150 }, type: 'melee', damage: 60, stun: 2 }],
    },
    blessing: { name: '수호 진형', effects: [{ kind: 'aura', radius: 200, effect: { damageReduction: 0.35 }, duration: 8 }] },
    bladeDance: {
      name: '해태의 심판',
      effects: [
        { kind: 'hit', area: { kind: 'radius', radius: 300 }, type: 'magic', damage: 300, stun: 2 },
        { kind: 'shrineHeal', ratio: 0.1 },
      ],
    },
  },
  samjokgo: {
    fanWind: {
      name: '태양 깃',
      effects: [{ kind: 'hit', area: { kind: 'nearest', count: 3 }, type: 'ranged', damage: 45, burnPerSec: 6 }],
    },
    blessing: { name: '태양 오라', effects: [{ kind: 'aura', radius: 250, effect: { attack: 0.5 }, duration: 10 }] },
    bladeDance: {
      name: '일식',
      effects: [{ kind: 'hit', area: { kind: 'radius', radius: 600 }, type: 'magic', damage: 220, burnPerSec: 12 }],
    },
  },
  magpieFlock: {
    fanWind: {
      name: '까치 떼 쇄도',
      effects: [{ kind: 'hit', area: { kind: 'front', range: 400, limit: 5 }, type: 'ranged', damage: 35, flyingMultiplier: 2 }],
    },
    blessing: {
      name: '길조',
      effects: [{ kind: 'buff', radius: 250, effect: { attackSpeed: 0.4 }, duration: 8 }],
    },
    bladeDance: {
      name: '오작교',
      effects: [
        { kind: 'summon', unitId: 'magpieFlock', count: 6 },
        { kind: 'hit', area: { kind: 'radius', radius: 600 }, type: 'ranged', stun: 2, flyingOnly: true },
      ],
    },
  },
  yeongdeungWind: {
    fanWind: {
      name: '돌개바람',
      effects: [{ kind: 'hit', area: { kind: 'front', range: 250 }, type: 'magic', damage: 45, knockback: 120 }],
    },
    blessing: {
      name: '순풍',
      effects: [{ kind: 'aura', radius: 250, effect: { moveSpeed: 0.4, attackSpeed: 0.4 }, duration: 10, missChance: 0.5 }],
    },
    bladeDance: {
      name: '영등 폭풍',
      effects: [
        { kind: 'hit', area: { kind: 'radius', radius: 350 }, type: 'magic', damage: 260, knockback: 200, slow: { ratio: 0.5, duration: 4 } },
      ],
    },
  },
};

/** 유닛의 빙의 스킬 (알 수 없는 유닛 id면 null) */
export function possessionSkillsOf(unitId: string): PossessionSkillSet | null {
  return POSSESSION_SKILLS[unitId] ?? null;
}
