// 데이터 공통 타입

/** 태그 (오방색 규칙과 연결). 'hero'는 영웅 전용 */
export type Tag = 'dokkaebi' | 'fire' | 'divine' | 'wind' | 'hero';
export type AttackType = 'melee' | 'ranged' | 'magic';
/** 적 특성: 무리 / 영체 / 갑옷 / 비행 */
export type EnemyTrait = 'swarm' | 'ghost' | 'armor' | 'flying';
export type Team = 'ally' | 'enemy';

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
  /** 비행 여부 (판정은 3단계) */
  flying: boolean;
  /** 부적 비용 */
  cost: number;
  /** 재소환 대기(초) */
  cooldown: number;
  /** 고유 능력 설명 (구현은 3단계) */
  ability: string;
}

export interface EnemyDef extends CombatStats {
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
