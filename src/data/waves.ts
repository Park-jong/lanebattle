// numbers.md 7장 웨이브 규칙과 장별 적 목록
export const WAVE_RULES = {
  firstWaveTime: 5,
  waveInterval: 20,
  /** 같은 웨이브 안에서 적을 내보내는 간격 */
  spawnInterval: 0.8,
  /** 적 상한 때문에 대기하는 적의 최대 수. 넘치는 적은 버린다 */
  maxQueue: 60,
  /** 예산 = base + perWave * 웨이브 순서(0~) + perChapter * (장-1) + perOrder * (장 안 순서-1) */
  budget: { base: 6, perWave: 2, perChapter: 3, perOrder: 1 },
  /** 일반 스테이지 웨이브 수. 이후엔 마지막 웨이브 구성을 반복 */
  normalWaveCount: 9,
  /** 테마 적을 뽑을 확률 가중치 */
  themeWeight: 2,
  stagesPerChapter: 5,
} as const;

/** 성 체력이 문턱 비율 이하로 처음 내려갈 때 나오는 대규모 웨이브(raid) 규칙 */
export const RAID_RULES = {
  /** 성 체력 비율 문턱. 인덱스가 raidIndex */
  thresholds: [0.8, 0.6, 0.4, 0.2, 0.05],
  /** 예산 = (base + perStage * 스테이지 번호) * (1 + perRaid * raidIndex), 반올림 */
  budget: { base: 16, perStage: 2, perRaid: 0.15 },
  /** raid 적은 일반 대기열과 별개로 이 수만큼 묶어 동시에 내보낸다 */
  groupSize: 5,
  /** 묶음과 묶음 사이 간격(초) */
  groupInterval: 1,
  /** 같은 묶음 안에서 순번마다 성 반대쪽으로 벌리는 거리(px) */
  groupSpreadX: 16,
  /** 마지막 문턱 raid에는 정예 1마리를 예산과 별개로 추가 */
  eliteOnLast: true,
} as const;

export interface ChapterEnemyEntry {
  enemyId: string;
  /** 장 안에서 처음 나오는 스테이지 순서(1~5) */
  fromOrder: number;
}

// 이전 장에서 나온 적은 다음 장부터 처음부터 등장
const unlocked = (list: ChapterEnemyEntry[]): ChapterEnemyEntry[] =>
  list.map((e) => ({ ...e, fromOrder: 1 }));

const CH1: ChapterEnemyEntry[] = [
  { enemyId: 'eggGhost', fromOrder: 1 },
  { enemyId: 'waterGhostThrower', fromOrder: 1 },
  { enemyId: 'maidenGhost', fromOrder: 3 },
  { enemyId: 'geuseundae', fromOrder: 4 },
];
const CH2: ChapterEnemyEntry[] = [
  ...unlocked(CH1),
  { enemyId: 'jangseungSpirit', fromOrder: 1 },
  { enemyId: 'eodduksini', fromOrder: 3 },
];
const CH3: ChapterEnemyEntry[] = [
  ...unlocked(CH2),
  { enemyId: 'sonGakshi', fromOrder: 1 },
  { enemyId: 'gangcheol', fromOrder: 3 },
];
const CH4: ChapterEnemyEntry[] = [
  ...unlocked(CH3),
  { enemyId: 'grimReaper', fromOrder: 1 },
  { enemyId: 'dueoksini', fromOrder: 2 },
];
const CH5: ChapterEnemyEntry[] = unlocked(CH4);

/** 인덱스 0 = 1장 */
export const CHAPTER_ENEMIES: readonly (readonly ChapterEnemyEntry[])[] = [CH1, CH2, CH3, CH4, CH5];

/** 전체 스테이지 수 (장 수 x 장당 스테이지 수) */
export const STAGE_COUNT = CHAPTER_ENEMIES.length * WAVE_RULES.stagesPerChapter;

/** 장별 테마 적 (확률 2배) */
export const CHAPTER_THEME: readonly string[] = [
  'maidenGhost', 'jangseungSpirit', 'gangcheol', 'eodduksini', 'grimReaper',
];
