import { CLEAR_REWARD, STAR_RULES } from '../data/rewards';
import type { StageDef } from '../data/stages';

export interface StageResultInput {
  victory: boolean;
  /** 전투 경과 시간(초, 일시정지 제외) */
  elapsed: number;
  /** 결과가 난 시점의 서낭당 체력 비율 0~1 */
  shrineHpRatio: number;
  stage: StageDef;
  /** 이전 최고 별 수 (저장 연결 전에는 0) */
  previousBestStars?: number;
}

/** 별 조건 달성 여부 (결과 화면 표시용). 패배면 모두 false */
export interface StarConditions {
  clear: boolean;
  shrineHp: boolean;
  time: boolean;
}

export interface StageResult {
  victory: boolean;
  stars: number;
  conditions: StarConditions;
  /** 획득 엽전 */
  yeopjeon: number;
  /** 새로 얻는 신명 (이번 별 - 이전 최고 별, 최소 0) */
  sinmyeong: number;
}

/** 별 판정과 보상 계산 (순수 함수) */
export function evaluateStage(input: StageResultInput): StageResult {
  const { victory, elapsed, shrineHpRatio, stage } = input;
  const clear = victory;
  const shrineHp = clear && shrineHpRatio >= STAR_RULES.shrineHpRatio;
  const time = shrineHp && elapsed <= stage.threeStarSeconds + STAR_RULES.timeTolerance;
  const stars = time ? 3 : shrineHp ? 2 : clear ? 1 : 0;

  const r = CLEAR_REWARD.yeopjeon;
  const base = r.base + r.perChapter * (stage.chapter - 1) + r.perStar * stars;
  const yeopjeon = victory ? Math.floor(base * (stage.isBossStage ? r.bossMultiplier : 1)) : 0;
  const sinmyeong = Math.max(0, stars - (input.previousBestStars ?? 0));
  return { victory, stars, conditions: { clear, shrineHp, time }, yeopjeon, sinmyeong };
}
