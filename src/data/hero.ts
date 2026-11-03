import type { AttackType, Tag } from './types';

// numbers.md 2장 (스킬 제외)
export const HERO = {
  name: '꼬마 무당',
  maxHp: 300,
  regenPerSec: 3,
  speed: 160,
  width: 24,
  height: 40,
  attack: {
    damage: 25,
    interval: 0.6,
    range: 50,
    type: 'melee' as AttackType,
    tags: ['hero'] as Tag[],
  },
  /** 부활 시간 = base + 위협 단계, 최대 max */
  respawn: { base: 4, max: 10 },
  /** 부활 위치 (서낭당 앞) */
  respawnX: 130,
} as const;
