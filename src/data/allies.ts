import type { AllyDef } from './types';

// numbers.md 4장. 순서 = 소환 키 1~0
export const ALLIES: readonly AllyDef[] = [
  { id: 'clubGoblin', name: '도깨비 방망이병', tags: ['dokkaebi'], attackType: 'melee', flying: false,
    cost: 30, cooldown: 1.5, maxHp: 120, attack: 14, attackInterval: 0.8, range: 20, speed: 60,
    width: 22, height: 34, ability: '없음' },
  { id: 'oneLegGoblin', name: '외다리 도깨비', tags: ['dokkaebi', 'wind'], attackType: 'melee', flying: false,
    cost: 55, cooldown: 4, maxHp: 150, attack: 18, attackInterval: 1.0, range: 22, speed: 110,
    width: 22, height: 36, ability: '돌격: 소환 후 첫 공격 피해 x3' },
  { id: 'sumoGoblin', name: '씨름 도깨비', tags: ['dokkaebi'], attackType: 'melee', flying: false,
    cost: 60, cooldown: 5, maxHp: 220, attack: 16, attackInterval: 1.2, range: 22, speed: 55,
    width: 32, height: 40, ability: '메치기: 3번째 공격마다 넉백 60 + 기절 0.5초' },
  { id: 'foxfireArcher', name: '여우불 사수', tags: ['fire'], attackType: 'ranged', flying: false,
    cost: 50, cooldown: 3, maxHp: 70, attack: 10, attackInterval: 1.2, range: 180, speed: 50,
    width: 20, height: 32, burnPerSec: 4,
    ability: '화상 초당 4' },
  { id: 'gumiho', name: '구미호', tags: ['fire'], attackType: 'magic', flying: false,
    cost: 120, cooldown: 10, maxHp: 160, attack: 22, attackInterval: 2.0, range: 160, speed: 45,
    width: 24, height: 38, burnPerSec: 6, areaRadius: 60,
    ability: '대상 주변 반경 60 범위 피해, 화상 초당 6' },
  { id: 'bulgasari', name: '불가사리', tags: ['divine'], attackType: 'melee', flying: false,
    cost: 110, cooldown: 10, maxHp: 300, attack: 20, attackInterval: 1.3, range: 24, speed: 45,
    width: 34, height: 36, ability: '공격마다 방어 파괴 1중첩' },
  { id: 'haetae', name: '해태', tags: ['divine'], attackType: 'melee', flying: false,
    cost: 140, cooldown: 15, maxHp: 700, attack: 18, attackInterval: 1.5, range: 24, speed: 35,
    width: 44, height: 48, ability: '붙잡기: 8초마다 앞의 적 하나를 2초 붙잡음' },
  { id: 'samjokgo', name: '삼족오', tags: ['divine', 'fire'], attackType: 'ranged', flying: true,
    cost: 150, cooldown: 20, maxHp: 180, attack: 14, attackInterval: 1.4, range: 170, speed: 45,
    width: 28, height: 28, burnPerSec: 4,
    ability: '비행. 오라: 반경 150 아군 공격력 +20%. 화상 초당 4' },
  { id: 'magpieFlock', name: '까치 떼', tags: ['wind'], attackType: 'ranged', flying: true,
    cost: 25, cooldown: 2, maxHp: 50, attack: 7, attackInterval: 0.7, range: 140, speed: 80,
    width: 20, height: 20, ability: '비행. 비행 적에게 피해 x2' },
  { id: 'yeongdeungWind', name: '영등 바람', tags: ['wind'], attackType: 'magic', flying: false,
    cost: 70, cooldown: 8, maxHp: 90, attack: 8, attackInterval: 1.0, range: 150, speed: 50,
    width: 24, height: 34, areaRadius: 40,
    ability: '오라: 반경 180 아군 이동·공격 속도 +15%, 적 투사체 25% 빗나감. 범위 반경 40' },
];

export function getAllyDef(id: string): AllyDef {
  const def = ALLIES.find((a) => a.id === id);
  if (!def) throw new Error(`unknown ally: ${id}`);
  return def;
}
