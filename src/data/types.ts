// 데이터 공통 타입

/** 태그 (오방색 규칙과 연결). 'hero'는 영웅 전용 */
export type Tag = 'dokkaebi' | 'fire' | 'divine' | 'wind' | 'hero';
export type AttackType = 'melee' | 'ranged' | 'magic';
/** 적 특성: 무리 / 영체 / 갑옷 / 비행 */
export type EnemyTrait = 'swarm' | 'ghost' | 'armor' | 'flying';
export type Team = 'ally' | 'enemy';
/** 공격자 종류 */
export type AttackSource = 'ally' | 'enemy' | 'hero';

/** 공격 유형·태그 목록 (보스 약점·저항 등). 하나라도 맞으면 해당 */
export interface Affinity {
  attackTypes?: readonly AttackType[];
  tags?: readonly Tag[];
  /** 방어 파괴를 거는 공격 */
  defenseBreak?: boolean;
  /** 공격자가 비행 유닛 */
  flyingAttacker?: boolean;
}

/** 전투 능력치 공통 필드 */
export interface CombatStats {
  maxHp: number;
  attack: number;
  /** 공격 사이 시간(초) */
  attackInterval: number;
  range: number;
  /** px/초 */
  speed: number;
  attackType: AttackType;
  /** 도형 그리기용 크기 */
  width: number;
  height: number;
}

export interface AllyDef extends CombatStats {
  id: string;
  name: string;
  tags: Tag[];
  /** 비행 여부 */
  flying: boolean;
  /** 부적 비용 */
  cost: number;
  /** 재소환 대기(초) */
  cooldown: number;
  /** 고유 능력 설명 (구현은 3단계) */
  ability: string;
  /** 이 유닛 공격이 거는 화상의 초당 피해 (불 태그 유닛) */
  burnPerSec?: number;
  /** 마법 공격의 범위 반경 */
  areaRadius?: number;
  /** 한 번 소환에 나오는 마리 수 (기본 1, 까치 떼 ② 핵심은 2) */
  summonCount?: number;
}

export interface EnemyDef extends CombatStats {
  /** 투사체가 명중한 위치 주변에 주는 범위 피해 */
  areaRadius?: number;
  id: string;
  name: string;
  traits: EnemyTrait[];
  /** 처치 시 받는 부적 */
  killTalisman: number;
  /** 웨이브 예산에서 차지하는 점수 */
  waveScore: number;
  /** 고유 능력 설명 (구현은 3단계) */
  ability: string;
}
