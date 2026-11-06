import { WAVE_RULES } from '../data/waves';
import { getEnemyDef } from '../data/enemies';
import type { StageDef } from '../data/stages';
import type { Rng } from './rng';
import { getStageDef, getStageInfo } from './stage';

export interface SpawnRequest {
  enemyId: string;
  elite: boolean;
}

export interface WavePreview {
  number: number;
  seconds: number;
  label: string;
  hint: string;
  enemyId: string;
}

/** 순환 공세. 그 스테이지에 해금된 적 안에서만 중심 병종을 고른다. */
export function waveFormation(stageNumber: number, waveIndex: number): Pick<WavePreview, 'label' | 'hint' | 'enemyId'> {
  const ids = availableEnemyIds(stageNumber);
  const choose = (...choices: string[]) => choices.find((id) => ids.includes(id)) ?? ids[0];
  if (waveIndex % 3 === 0) return { label: '무리 공세', hint: '범위 공격으로 저지', enemyId: choose('eggGhost') };
  if (waveIndex % 3 === 1) {
    const enemyId = choose('gangcheol', 'jangseungSpirit', 'geuseundae', 'maidenGhost', 'waterGhostThrower');
    const armor = getEnemyDef(enemyId).traits.includes('armor');
    if (armor) return { label: '장갑 돌파', hint: '방어 파괴로 돌파', enemyId };
    if (enemyId === 'geuseundae') return { label: '성장 공세', hint: '커지기 전에 집중 처치', enemyId };
    if (enemyId === 'maidenGhost') return { label: '후방 돌격', hint: '후방 보호·불 공격 준비', enemyId };
    return { label: '투척 공세', hint: '밀집 피해 주의·원거리 적 처치', enemyId };
  }
  const enemyId = choose('eodduksini', 'maidenGhost', 'waterGhostThrower');
  if (enemyId === 'eodduksini') return { label: '공중 습격', hint: '대공 병력 준비', enemyId };
  if (enemyId === 'maidenGhost') return { label: '후방 습격', hint: '후방 보호·불 공격 준비', enemyId };
  return { label: '원거리 공세', hint: '원거리 적 우선 처치', enemyId };
}

/** 웨이브 예산 = 6 + 2*순서 + 3*(장-1) + (장 안 순서-1) */
export function waveBudget(stageNumber: number, waveOrder: number): number {
  const info = getStageInfo(stageNumber);
  const b = WAVE_RULES.budget;
  return b.base + b.perWave * waveOrder + b.perChapter * (info.chapter - 1) + b.perOrder * (info.order - 1);
}

/** 그 스테이지에 등장 가능한 적 id 목록 */
export function availableEnemyIds(stageNumber: number): string[] {
  return [...getStageDef(stageNumber).enemyIds];
}

/** 웨이브 타이밍과 구성을 만들고, 적을 일정 간격으로 내보낸다 */
export class WaveDirector {
  private elapsed = 0;
  private nextWaveTime: number;
  private readonly def: StageDef;
  private spawnCooldown = 0;
  private queue: SpawnRequest[] = [];
  private startedWaves = 0;

  constructor(
    private readonly stageNumber: number,
    private readonly rng: Rng,
  ) {
    this.def = getStageDef(stageNumber);
    this.nextWaveTime = this.def.firstWaveTime;
  }

  /** 지금까지 시작된 웨이브 수 */
  get waveCount(): number {
    return this.startedWaves;
  }

  /** 아직 내보내지 않은 적 수 */
  get pendingCount(): number {
    return this.queue.length;
  }

  get nextWave(): WavePreview {
    return { number: this.startedWaves + 1, seconds: Math.max(0, this.nextWaveTime - this.elapsed),
      ...waveFormation(this.stageNumber, this.startedWaves) };
  }

  /**
   * 이번 틱에 내보낼 적을 돌려준다. capacity는 지금 전장에 더 둘 수 있는 적 수(기본 무제한).
   * 자리가 없으면 대기열에 남고, 자리가 나면 0.8초 간격으로 나온다.
   */
  update(dt: number, capacity = Infinity): SpawnRequest[] {
    this.elapsed += dt;
    while (this.elapsed >= this.nextWaveTime) {
      this.enqueue(this.composeWave(this.startedWaves));
      this.startedWaves += 1;
      this.nextWaveTime += this.def.waveInterval;
    }
    this.spawnCooldown -= dt;
    const out: SpawnRequest[] = [];
    while (this.queue.length > 0 && this.spawnCooldown <= 0 && out.length < capacity) {
      out.push(this.queue.shift()!);
      this.spawnCooldown += WAVE_RULES.spawnInterval;
    }
    // 대기열이 비었거나 자리가 없어 막힌 동안은 간격이 쌓이지 않게 한다 (자리가 나도 한 번에 쏟아내지 않음)
    if (this.spawnCooldown < 0) this.spawnCooldown = 0;
    return out;
  }

  /** 대기열 최대 길이까지만 담고 넘치는 적은 버린다. 정예는 자리가 없으면 대기 중인 일반 적 하나를 밀어내고 들어간다 */
  private enqueue(requests: SpawnRequest[]): void {
    for (const r of requests) {
      if (this.queue.length >= WAVE_RULES.maxQueue) {
        if (!r.elite) continue;
        const evict = this.queue.map((q) => q.elite).lastIndexOf(false);
        if (evict < 0) continue;
        this.queue.splice(evict, 1);
      }
      this.queue.push(r);
    }
  }

  /** 웨이브 구성: 예산 안에서 가중 무작위로 고른다 (공개: 테스트용) */
  composeWave(waveIndex: number): SpawnRequest[] {
    const lastIndex = this.def.waveCount - 1;
    const order = Math.min(waveIndex, lastIndex); // 이후엔 마지막 웨이브 구성 반복
    const info = getStageInfo(this.stageNumber);
    const ids = availableEnemyIds(this.stageNumber);
    const theme = this.def.themeEnemyId;
    const picks: SpawnRequest[] = [];
    let budget = waveBudget(this.stageNumber, order);

    // 예산의 40%까지 중심 병종을 먼저 배치하고 나머지는 기존 테마 가중 무작위로 채운다.
    const formation = getEnemyDef(waveFormation(this.stageNumber, waveIndex).enemyId);
    const formationCount = Math.max(1, Math.floor(budget * 0.4 / formation.waveScore));
    for (let i = 0; i < formationCount && budget >= formation.waveScore; i++) {
      picks.push({ enemyId: formation.id, elite: false });
      budget -= formation.waveScore;
    }

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
