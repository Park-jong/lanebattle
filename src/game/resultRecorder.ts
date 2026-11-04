import type { StageResult } from '../battle/result';
import type { ProgressStore } from './progress';

/** 한 번의 전투 결과를 계산하고 기록은 딱 한 번만 하는 래퍼 */
export class ResultRecorder {
  private settled: StageResult | null = null;

  constructor(private readonly store: ProgressStore) {}

  /**
   * 결과가 났으면(evaluate가 null이 아니면) 이전 최고 별로 계산해 기록하고 캐시한다.
   * 이후 호출은 같은 결과를 돌려주고 다시 기록하지 않는다.
   */
  settle(stage: number, evaluate: (previousBestStars: number) => StageResult | null): StageResult | null {
    if (this.settled) return this.settled;
    const result = evaluate(this.store.getBestStars(stage));
    if (!result) return null;
    this.store.recordResult(stage, result.stars);
    this.settled = result;
    return result;
  }
}
