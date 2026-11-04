import type { Affinity, CombatStats } from './types';

// numbers.md 6장 보스. 수치는 스테이지 성장 공식을 적용하지 않고 그대로 쓴다

/** 보스 공통 규칙 */
export const BOSS_RULES = {
  /** 보스 스테이지에서 전투 시작 후 보스가 등장하는 시각(초) */
  appearAt: 60,
  /** 등장 위치: 원귀의 성 x에서 왼쪽으로 이만큼 */
  spawnOffset: 100,
  /** 처치 시 받는 부적 (문서에 없어 이번에 정함) */
  killTalisman: 100,
} as const;

/** 보스별 패턴 수치. kind가 구현 클래스를 정한다 */
export type BossPatternDef =
  | { kind: 'summon'; interval: number; enemyId: string; count: number; spread: number }
  | { kind: 'armor'; interval: number; reductionPerStack: number; maxStacks: number }
  | {
      kind: 'serpent';
      /** 이 태그가 붙은 피해를 받으면 그만큼 회복 */
      healFromTags: readonly ('fire')[];
      /** 가뭄: 부적 충전 속도 감소 비율 */
      droughtPenalty: number;
      tail: { interval: number; radius: number; damage: number; knockback: number };
    }
  | { kind: 'descend'; interval: number; duration: number; radius: number; damage: number; flyHeight: number }
  | {
      kind: 'suppress';
      pulse: { interval: number; dispelDuration: number; damage: number };
    };

export interface BossDef extends CombatStats {
  id: string;
  name: string;
  /** 장 1~5 */
  chapter: number;
  killTalisman: number;
  weakness: Affinity;
  resistance: Affinity;
  /** 화면 칩용 이름 */
  weaknessLabels: readonly string[];
  resistanceLabels: readonly string[];
  pattern: BossPatternDef;
}

export const BOSSES: readonly BossDef[] = [
  { id: 'giantWonGwi', name: '거대 원귀', chapter: 1, maxHp: 3000, attack: 40, attackInterval: 2.0,
    range: 40, speed: 20, attackType: 'melee', width: 90, height: 120, killTalisman: BOSS_RULES.killTalisman,
    weakness: { tags: ['fire'] }, resistance: { attackTypes: ['melee'] },
    weaknessLabels: ['불'], resistanceLabels: ['근접'],
    pattern: { kind: 'summon', interval: 10, enemyId: 'eggGhost', count: 5, spread: 30 } },
  { id: 'ironJangseung', name: '철갑 장승왕', chapter: 2, maxHp: 4500, attack: 50, attackInterval: 2.2,
    range: 40, speed: 15, attackType: 'melee', width: 100, height: 140, killTalisman: BOSS_RULES.killTalisman,
    weakness: { attackTypes: ['melee'], defenseBreak: true },
    resistance: { attackTypes: ['ranged', 'magic'] },
    weaknessLabels: ['근접', '방어 파괴'], resistanceLabels: ['원거리', '마법'],
    pattern: { kind: 'armor', interval: 10, reductionPerStack: 0.08, maxStacks: 6 } },
  { id: 'imugiGangcheol', name: '이무기 강철이', chapter: 3, maxHp: 6000, attack: 55, attackInterval: 2.0,
    range: 60, speed: 18, attackType: 'melee', width: 120, height: 110, killTalisman: BOSS_RULES.killTalisman,
    weakness: { tags: ['wind'], attackTypes: ['melee'] }, resistance: { tags: ['fire'] },
    weaknessLabels: ['바람', '근접'], resistanceLabels: ['불'],
    pattern: {
      kind: 'serpent', healFromTags: ['fire'], droughtPenalty: 0.4,
      tail: { interval: 12, radius: 100, damage: 80, knockback: 100 },
    } },
  { id: 'eodduksiniKing', name: '어둑시니 대왕', chapter: 4, maxHp: 7000, attack: 60, attackInterval: 2.5,
    range: 200, speed: 20, attackType: 'ranged', width: 90, height: 90, killTalisman: BOSS_RULES.killTalisman,
    weakness: { attackTypes: ['ranged'], flyingAttacker: true }, resistance: { attackTypes: ['melee'] },
    weaknessLabels: ['원거리', '비행 유닛'], resistanceLabels: ['근접'],
    pattern: { kind: 'descend', interval: 15, duration: 3, radius: 120, damage: 120, flyHeight: 70 } },
  { id: 'chasaKing', name: '차사왕', chapter: 5, maxHp: 10000, attack: 70, attackInterval: 2.0,
    range: 50, speed: 15, attackType: 'melee', width: 100, height: 150, killTalisman: BOSS_RULES.killTalisman,
    weakness: { tags: ['hero'] }, resistance: {},
    weaknessLabels: ['영웅'], resistanceLabels: [],
    pattern: { kind: 'suppress', pulse: { interval: 20, dispelDuration: 3, damage: 30 } } },
];

/** 장(1~5)의 보스 */
export function getBossDef(chapter: number): BossDef {
  const def = BOSSES.find((b) => b.chapter === chapter);
  if (!def) throw new Error(`unknown boss chapter: ${chapter}`);
  return def;
}

/** id로 보스를 찾는다 */
export function getBossById(id: string): BossDef {
  const def = BOSSES.find((b) => b.id === id);
  if (!def) throw new Error(`unknown boss id: ${id}`);
  return def;
}
