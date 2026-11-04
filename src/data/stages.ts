import { BOSSES } from './bosses';
import { COMBAT } from './combat';
import { CHAPTER_ENEMIES, CHAPTER_THEME, WAVE_RULES } from './waves';

// numbers.md 7장 스테이지 표. 25개 스테이지를 한 번에 만들어 둔다

/** 별 3개 제한 시간(초) */
export const THREE_STAR_SECONDS = { normal: 200, boss: 300 } as const;

export interface StageDef {
  /** 스테이지 번호 0~24 */
  number: number;
  /** 장 1~5 */
  chapter: number;
  /** 장 안 순서 1~5 */
  order: number;
  /** 표시용 코드 (예: "1-1") */
  code: string;
  name: string;
  castleHp: number;
  isBossStage: boolean;
  /** 보스 스테이지의 보스 id (일반 스테이지는 없음) */
  bossId?: string;
  waveCount: number;
  firstWaveTime: number;
  waveInterval: number;
  /** ★3 제한 시간(초) */
  threeStarSeconds: number;
  /** 확률 2배인 테마 적 */
  themeEnemyId: string;
  /** 등장 가능한 적 id */
  enemyIds: readonly string[];
}

/** 인덱스 = 장-1, 안쪽 인덱스 = 장 안 순서-1 */
const STAGE_NAMES: readonly (readonly string[])[] = [
  ['등불 켜진 장터', '솟대 늘어선 골목', '달밤의 우물가', '문 닫힌 주막', '거대 원귀의 굿판'],
  ['장승 서 있는 길목', '돌무더기 서낭재', '안개 낀 고갯마루', '부러진 장승 터', '철갑 장승왕의 관문'],
  ['갈라진 나루터', '말라붙은 여울', '빈 배 묻힌 모래톱', '바닥 드러난 소', '이무기 강철이의 소굴'],
  ['바람 우는 대숲 어귀', '죽순 돋는 오솔길', '달그림자 드리운 죽림', '안개 속 대나무 미로', '어둑시니 대왕의 둥지'],
  ['혼불 떠도는 길', '삼도천 건널목', '문지기 없는 돌계단', '저승 문 앞마당', '차사왕의 심판대'],
];

function buildStage(number: number): StageDef {
  const per = WAVE_RULES.stagesPerChapter;
  const chapter = Math.floor(number / per) + 1;
  const order = (number % per) + 1;
  const isBossStage = order === per;
  return {
    number,
    chapter,
    order,
    code: `${chapter}-${order}`,
    name: STAGE_NAMES[chapter - 1][order - 1],
    castleHp: COMBAT.castle.baseHp + COMBAT.castle.hpPerStage * number,
    isBossStage,
    bossId: isBossStage ? BOSSES.find((b) => b.chapter === chapter)?.id : undefined,
    waveCount: WAVE_RULES.normalWaveCount,
    firstWaveTime: WAVE_RULES.firstWaveTime,
    waveInterval: WAVE_RULES.waveInterval,
    threeStarSeconds: isBossStage ? THREE_STAR_SECONDS.boss : THREE_STAR_SECONDS.normal,
    themeEnemyId: CHAPTER_THEME[chapter - 1],
    enemyIds: CHAPTER_ENEMIES[chapter - 1].filter((e) => e.fromOrder <= order).map((e) => e.enemyId),
  };
}

export const STAGES: readonly StageDef[] = Array.from(
  { length: CHAPTER_ENEMIES.length * WAVE_RULES.stagesPerChapter },
  (_, i) => buildStage(i),
);
