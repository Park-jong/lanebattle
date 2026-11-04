import { STAGES, type StageDef } from '../data/stages';

export interface StageInfo {
  /** 스테이지 번호 0~24 */
  number: number;
  /** 장 1~5 */
  chapter: number;
  /** 장 안 순서 1~5 */
  order: number;
  isBossStage: boolean;
}

/** 스테이지 정의 표에서 한 줄을 읽는다. 범위 밖이면 RangeError */
export function getStageDef(stageNumber: number): StageDef {
  const def = Number.isInteger(stageNumber) ? STAGES[stageNumber] : undefined;
  if (!def) {
    throw new RangeError(`스테이지 번호는 0 이상 ${STAGES.length - 1} 이하의 정수여야 합니다: ${stageNumber}`);
  }
  return def;
}

/** 스테이지 번호 → 장/순서 */
export function getStageInfo(stageNumber: number): StageInfo {
  const { number, chapter, order, isBossStage } = getStageDef(stageNumber);
  return { number, chapter, order, isBossStage };
}
