import { STAGES } from '../data/stages';
import { STAR_RULES } from '../data/rewards';

/** 진행 기록 저장소 인터페이스 (영구 저장 구현은 save.ts) */
export interface ProgressStore {
  /** 스테이지 최고 별 0~3. 범위 밖 스테이지는 0 */
  getBestStars(stage: number): number;
  /** 최고값만 갱신한다. 범위 밖 스테이지는 RangeError */
  recordResult(stage: number, stars: number): void;
  reset(): void;
}

function isValidStage(stage: number): boolean {
  return Number.isInteger(stage) && stage >= 0 && stage < STAGES.length;
}

/** 메모리에만 보관하는 진행 기록 */
export class MemoryProgress implements ProgressStore {
  private readonly best = new Map<number, number>();

  getBestStars(stage: number): number {
    return this.best.get(stage) ?? 0;
  }

  recordResult(stage: number, stars: number): void {
    if (!isValidStage(stage)) {
      throw new RangeError(`스테이지 번호가 범위 밖입니다: ${stage}`);
    }
    const clamped = Number.isFinite(stars) ? Math.max(0, Math.min(STAR_RULES.maxStars, Math.floor(stars))) : 0;
    if (clamped > this.getBestStars(stage)) this.best.set(stage, clamped);
  }

  reset(): void {
    this.best.clear();
  }
}

