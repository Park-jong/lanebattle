// numbers.md 1장 전투 공통 (+ 정예, 성장, 2단계 구현용 보조값)
export const COMBAT = {
  battlefieldLength: 2400,
  shrine: { x: 80, maxHp: 1000, width: 50, height: 90 },
  castle: { x: 2320, baseHp: 1200, hpPerStage: 150, width: 70, height: 130 },
  maxAllies: 30,
  /** 동시에 살아 있는 적 상한 (보스 제외) */
  maxEnemies: 60,
  /** 전투 시작 후 이 시간(초)마다 위협 단계 +1 (1부터 시작) */
  threatInterval: 30,
  threatStart: 1,
  minDamage: 1,
  /** 스테이지 번호당 적 수치 성장 */
  enemyGrowth: { hpPerStage: 0.12, attackPerStage: 0.06 },
  elite: { hpMultiplier: 4, attackMultiplier: 1.5, sizeMultiplier: 1.5 },
  /** 소환 위치: 아군은 서낭당 앞, 적은 원귀의 성 앞 */
  allySpawnX: 130,
  enemySpawnOffset: 40,
  projectileSpeed: 420,
  /** 시뮬레이션 1틱 최대 시간 */
  maxStepSeconds: 0.05,
  /** 승패가 난 뒤 이 시간(초) 동안은 재시작 입력을 무시 */
  resultInputDelay: 1,
  /** 화상 지속 피해 숫자를 묶어서 보여 주는 간격(초) */
  burnNumberInterval: 0.5,
} as const;
