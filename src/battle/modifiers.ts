import { SKILL_EFFECTS } from '../data/skills';
import type { SynergyId } from '../data/synergy';
import { noResourceModifiers, type ResourceModifiers } from './resources';

/** 노드 params를 그대로 담은 수치 묶음 */
export type UnitParams = Readonly<Record<string, number>>;

/** 요괴 유닛 하나의 업그레이드 결과 */
export interface UnitModifiers {
  /** ① 기본: 체력 배율 */
  hpMultiplier: number;
  /** ① 기본: 공격력 배율 */
  attackMultiplier: number;
  /** ② 핵심을 찍었으면 그 노드의 params */
  core: UnitParams | null;
  /** ③ 각성을 찍었으면 그 노드의 params */
  awaken: UnitParams | null;
}

export interface HeroModifiers {
  /** 기본 공격력 배율 (방울 단련) */
  attackMultiplier: number;
  /** 최대 체력 배율 (단단한 몸) */
  hpMultiplier: number;
  /** 부활 시간 감소(초) (빠른 부활) */
  reviveReduction: number;
  /** 신력 시간 충전 배율 (신력 샘) */
  spiritChargeMultiplier: number;
  /** 신력 최대 증가 (깊은 신기) */
  maxSpiritBonus: number;
  /** 무당 각성: 기본 공격 everyNth번째마다 충격파 (없으면 null) */
  awakening: { everyNth: number; radius: number; attackMultiplier: number } | null;
  /** 빙의한 유닛 id (없으면 null). 영웅이 그 유닛으로 변신한다 */
  possession: string | null;
}

export interface SkillModifiers {
  fanWind: { rangeMultiplier: number; damageMultiplier: number; knockbackMultiplier: number };
  blessing: { rangeMultiplier: number; healRatio: number; attackBonus: number };
  bladeDance: {
    cooldownMultiplier: number;
    /** 맞은 적에게 duration초 동안 초당 damagePerSec 추가 피해 (0이면 없음) */
    extraDuration: number;
    extraDamagePerSec: number;
  };
}

/** 전투에 적용할 빌드 효과 전체. 기본값(noModifiers)은 효과 없음 */
export interface BattleModifiers {
  hero: HeroModifiers;
  skills: SkillModifiers;
  /** 유닛 id → 보정. 업그레이드가 없는 유닛은 키가 없다 */
  units: Readonly<Record<string, UnitModifiers>>;
  synergies: readonly SynergyId[];
  /** 부적·기운 모으기 보정. 신력 충전·최대는 hero 쪽 값이 우선한다 */
  economy: ResourceModifiers;
}

export function noModifiers(): BattleModifiers {
  return {
    hero: {
      attackMultiplier: 1,
      hpMultiplier: 1,
      reviveReduction: 0,
      spiritChargeMultiplier: 1,
      maxSpiritBonus: 0,
      awakening: null,
      possession: null,
    },
    skills: {
      fanWind: { rangeMultiplier: 1, damageMultiplier: 1, knockbackMultiplier: 1 },
      blessing: {
        rangeMultiplier: 1,
        healRatio: SKILL_EFFECTS.blessing.healRatio,
        attackBonus: SKILL_EFFECTS.blessing.attackBonus,
      },
      bladeDance: { cooldownMultiplier: 1, extraDuration: 0, extraDamagePerSec: 0 },
    },
    units: {},
    synergies: [],
    economy: noResourceModifiers(),
  };
}
