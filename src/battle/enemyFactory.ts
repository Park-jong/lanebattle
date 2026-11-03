import { COMBAT } from '../data/combat';
import { getEnemyDef } from '../data/enemies';
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
