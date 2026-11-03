import type { EnemyDef } from './types';

// numbers.md 5장 (스테이지 1-1 기준 기본값)
export const ENEMIES: readonly EnemyDef[] = [
  { id: 'eggGhost', name: '달걀귀신', traits: ['swarm'], attackType: 'melee',
    maxHp: 70, attack: 9, attackInterval: 0.8, range: 18, speed: 65, killTalisman: 3, waveScore: 1,
    width: 20, height: 28, ability: '없음 (수가 많음)' },
  { id: 'waterGhostThrower', name: '물귀신 투척병', traits: [], attackType: 'ranged',
    maxHp: 60, attack: 9, attackInterval: 1.4, range: 160, speed: 45, killTalisman: 5, waveScore: 2,
    width: 20, height: 32, ability: '맞은 대상 이동 속도 -30%, 2초' },
  { id: 'maidenGhost', name: '처녀귀신', traits: ['ghost'], attackType: 'melee',
    maxHp: 90, attack: 14, attackInterval: 1.0, range: 20, speed: 100, killTalisman: 6, waveScore: 2,
    width: 22, height: 38, ability: '근접 유닛에 막히지 않고 지나가며 원거리·마법 유닛을 먼저 노림' },
  { id: 'jangseungSpirit', name: '장승 망령', traits: ['armor'], attackType: 'melee',
    maxHp: 400, attack: 20, attackInterval: 1.6, range: 24, speed: 30, killTalisman: 12, waveScore: 4,
    width: 36, height: 52, ability: '없음 (단단한 탱커)' },
  { id: 'eodduksini', name: '어둑시니', traits: ['flying'], attackType: 'ranged',
    maxHp: 80, attack: 10, attackInterval: 1.2, range: 100, speed: 60, killTalisman: 6, waveScore: 2,
    width: 24, height: 24, ability: '비행 (근접 공격 대상이 안 됨)' },
  { id: 'geuseundae', name: '그슨대', traits: [], attackType: 'melee',
    maxHp: 150, attack: 14, attackInterval: 1.2, range: 24, speed: 40, killTalisman: 10, waveScore: 3,
    width: 28, height: 46, ability: '5초마다 최대 체력·공격력 +15% (최대 6회). 몸집도 커짐' },
  { id: 'sonGakshi', name: '손각시', traits: ['ghost'], attackType: 'ranged',
    maxHp: 70, attack: 8, attackInterval: 1.5, range: 170, speed: 45, killTalisman: 7, waveScore: 2,
    width: 20, height: 34, ability: '맞은 대상 회복 차단 4초' },
  { id: 'grimReaper', name: '저승사자', traits: [], attackType: 'melee',
    maxHp: 180, attack: 12, attackInterval: 1.2, range: 22, speed: 45, killTalisman: 12, waveScore: 4,
    width: 24, height: 44, ability: '6초마다 반경 120 아군 버프 해제 3초' },
  { id: 'gangcheol', name: '강철이', traits: ['armor'], attackType: 'melee',
    maxHp: 300, attack: 18, attackInterval: 1.3, range: 22, speed: 40, killTalisman: 14, waveScore: 4,
    width: 34, height: 44, ability: '불 피해와 화상 무효' },
  { id: 'dueoksini', name: '두억시니', traits: [], attackType: 'melee',
    maxHp: 260, attack: 30, attackInterval: 1.5, range: 24, speed: 55, killTalisman: 15, waveScore: 5,
    width: 32, height: 48, ability: '유닛과 영웅에 막히지 않고 서낭당으로 직진, 서낭당에 피해 x2' },
];

export function getEnemyDef(id: string): EnemyDef {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new Error(`unknown enemy: ${id}`);
  return def;
}
