import { STAGE_COUNT, WAVE_RULES } from '../data/waves';

export interface StageInfo {
  /** 스테이지 번호 0~24 */
  number: number;
  /** 장 1~5 */
  chapter: number;
  /** 장 안 순서 1~5 */
  order: number;
  isBossStage: boolean;
}

/** 스테이지 번호 → 장/순서 */
export function getStageInfo(stageNumber: number): StageInfo {
  if (!Number.isInteger(stageNumber) || stageNumber < 0 || stageNumber >= STAGE_COUNT) {
    throw new RangeError(`스테이지 번호는 0 이상 ${STAGE_COUNT - 1} 이하의 정수여야 합니다: ${stageNumber}`);
  }
  const per = WAVE_RULES.stagesPerChapter;
  const order = (stageNumber % per) + 1;
  return {
    number: stageNumber,
    chapter: Math.floor(stageNumber / per) + 1,
    order,
    isBossStage: order === per,
  };
}
