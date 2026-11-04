import { COMBAT } from '../data/combat';
import { getEnemyDef } from '../data/enemies';
import type { BossDef } from '../data/bosses';
import { Fighter } from './entities';

/** 스테이지 번호와 정예 여부를 반영해 적 유닛을 만든다 */
export function createEnemy(enemyId: string, stageNumber: number, elite: boolean, x: number): Fighter {
  const def = getEnemyDef(enemyId);
  const growth = COMBAT.enemyGrowth;
  let maxHp = def.maxHp * (1 + growth.hpPerStage * stageNumber);
  let attack = def.attack * (1 + growth.attackPerStage * stageNumber);
  let scale = 1;
  if (elite) {
    maxHp *= COMBAT.elite.hpMultiplier;
    attack *= COMBAT.elite.attackMultiplier;
    scale = COMBAT.elite.sizeMultiplier;
  }
  return new Fighter(
    'enemy',
    def.id,
    {
      ...def,
      maxHp,
      attack,
      tags: [],
      flying: def.traits.includes('flying'),
      scale,
      elite,
    },
    x,
  );
}

/** 보스를 만든다. 스테이지 성장 공식은 적용하지 않고 데이터 수치를 그대로 쓴다 */
export function createBoss(def: BossDef, x: number): Fighter {
  const { pattern } = def;
  return new Fighter(
    'enemy',
    def.id,
    {
      ...def,
      tags: [],
      traits: [],
      flying: false,
      scale: 1,
      elite: false,
      boss: true,
      healFromTags: pattern.kind === 'serpent' ? pattern.healFromTags : undefined,
    },
    x,
  );
}
