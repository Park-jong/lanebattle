import { WAVE_RULES, CHAPTER_ENEMIES, CHAPTER_THEME } from '../data/waves';
import { getEnemyDef } from '../data/enemies';
import type { Rng } from './rng';
import { getStageInfo } from './stage';

export interface SpawnRequest {
  enemyId: string;
  elite: boolean;
}

/** 웨이브 예산 = 6 + 2*순서 + 3*(장-1) + (장 안 순서-1) */
export function waveBudget(stageNumber: number, waveOrder: number): number {
  const info = getStageInfo(stageNumber);
  const b = WAVE_RULES.budget;
  return b.base + b.perWave * waveOrder + b.perChapter * (info.chapter - 1) + b.perOrder * (info.order - 1);
}

/** 그 스테이지에 등장 가능한 적 id 목록 */
export function availableEnemyIds(stageNumber: number): string[] {
  const info = getStageInfo(stageNumber);
  return CHAPTER_ENEMIES[info.chapter - 1]
    .filter((e) => e.fromOrder <= info.order)
    .map((e) => e.enemyId);
}

/** 웨이브 타이밍과 구성을 만들고, 적을 일정 간격으로 내보낸다 */
export class WaveDirector {
  private elapsed = 0;
  private nextWaveTime: number = WAVE_RULES.firstWaveTime;
  private spawnCooldown = 0;
  private queue: SpawnRequest[] = [];
  private startedWaves = 0;

  constructor(
    private readonly stageNumber: number,
    private readonly rng: Rng,
  ) {}

  /** 지금까지 시작된 웨이브 수 */
  get waveCount(): number {
    return this.startedWaves;
  }

  /** 아직 내보내지 않은 적 수 */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** 이번 틱에 내보낼 적을 돌려준다 */
  update(dt: number): SpawnRequest[] {
    this.elapsed += dt;
    while (this.elapsed >= this.nextWaveTime) {
      this.queue.push(...this.composeWave(this.startedWaves));
      this.startedWaves += 1;
      this.nextWaveTime += WAVE_RULES.waveInterval;
    }
    this.spawnCooldown -= dt;
    const out: SpawnRequest[] = [];
    while (this.queue.length > 0 && this.spawnCooldown <= 0) {
      out.push(this.queue.shift()!);
      this.spawnCooldown += WAVE_RULES.spawnInterval;
    }
    // 대기열이 비어 있으면 간격 누적 방지
    if (this.queue.length === 0 && this.spawnCooldown < 0) this.spawnCooldown = 0;
    return out;
  }

  /** 웨이브 구성: 예산 안에서 가중 무작위로 고른다 (공개: 테스트용) */
  composeWave(waveIndex: number): SpawnRequest[] {
    const lastIndex = WAVE_RULES.normalWaveCount - 1;
    const order = Math.min(waveIndex, lastIndex); // 이후엔 마지막 웨이브 구성 반복
    const info = getStageInfo(this.stageNumber);
    const ids = availableEnemyIds(this.stageNumber);
    const theme = CHAPTER_THEME[info.chapter - 1];
    const picks: SpawnRequest[] = [];
    let budget = waveBudget(this.stageNumber, order);

    for (;;) {
      const candidates = ids.filter((id) => getEnemyDef(id).waveScore <= budget);
      if (candidates.length === 0) break;
      const id = this.pickEnemy(candidates, theme);
      picks.push({ enemyId: id, elite: false });
      budget -= getEnemyDef(id).waveScore;
    }

    // 정예: 일반 스테이지의 9번째 웨이브에만 1마리 추가 (예산과 별개, 테마 적 가중치 적용)
    if (waveIndex === lastIndex && !info.isBossStage) {
      picks.push({ enemyId: this.pickEnemy(ids, theme), elite: true });
    }
    return picks;
  }

  /** 테마 적에 가중치를 주어 한 종류를 고른다 */
  private pickEnemy(candidates: string[], theme: string): string {
    const weights = candidates.map((id) => (id === theme ? WAVE_RULES.themeWeight : 1));
    return candidates[this.pickWeighted(weights)];
  }

  private pickWeighted(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rng.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}
