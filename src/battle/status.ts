import { STATUS } from '../data/status';

/** 버프 수치. 모두 합산한다 (0.2 = +20%) */
export interface BuffEffect {
  attack?: number;
  moveSpeed?: number;
  attackSpeed?: number;
  damageReduction?: number;
}

/** 오라: 소유자 주변 반경 안의 아군에게 매 틱 적용 */
export interface AuraDef {
  radius: number;
  effect: BuffEffect;
}

interface Timed {
  remaining: number;
}
interface Burn extends Timed {
  dps: number;
}
interface Slow extends Timed {
  ratio: number;
}
interface TimedBuff extends Timed {
  effect: BuffEffect;
}

const alive = (t: Timed) => t.remaining > STATUS.epsilon;

/** 유닛·영웅 하나에 걸린 상태 효과 모음. 기지는 갖지 않는다 */
export class StatusSet {
  private burns: Burn[] = [];
  private slows: Slow[] = [];
  private stunRemaining = 0;
  private breakStacks = 0;
  private breakRemaining = 0;
  private buffs: TimedBuff[] = [];
  private auraEffects: BuffEffect[] = [];
  private dispelRemaining = 0;
  private healBlockRemaining = 0;

  // ----- 부여 -----

  /** 화상. 가득 찼으면 가장 오래된 중첩의 시간만 갱신한다 (초당 피해는 큰 쪽) */
  applyBurn(dps: number, maxStacks: number = STATUS.burn.maxStacks): void {
    if (this.burns.length < maxStacks) {
      this.burns.push({ dps, remaining: STATUS.burn.duration });
      return;
    }
    const oldest = this.burns.reduce((a, b) => (b.remaining < a.remaining ? b : a));
    oldest.remaining = STATUS.burn.duration;
    oldest.dps = Math.max(oldest.dps, dps);
  }

  /** 감속. 비율 0.3 = 이동 속도 -30%. 여러 개면 가장 강한 것만 적용된다 */
  applySlow(ratio: number, duration: number): void {
    this.slows.push({ ratio, remaining: duration });
  }

  /** 기절·붙잡기. 보스는 짧은 경직으로 대체한다 */
  stun(duration: number, isBoss: boolean): void {
    const effective = isBoss ? STATUS.bossStagger : duration;
    this.stunRemaining = Math.max(this.stunRemaining, effective);
  }

  /** 방어 파괴: 1중첩을 더하고 시간을 갱신한다 */
  applyDefenseBreak(maxStacks: number = STATUS.defenseBreak.maxStacks): void {
    this.breakStacks = Math.min(maxStacks, this.breakStacks + 1);
    this.breakRemaining = STATUS.defenseBreak.duration;
  }

  /** 버프 부여. 버프 해제 중이면 무시하고 false */
  addBuff(effect: BuffEffect, duration: number): boolean {
    if (this.buffsDisabled) return false;
    this.buffs.push({ effect, remaining: duration });
    return true;
  }

  /** 이번 틱에만 유효한 오라 효과. 버프 해제 중이면 무시하고 false */
  addAuraEffect(effect: BuffEffect): boolean {
    if (this.buffsDisabled) return false;
    this.auraEffects.push(effect);
    return true;
  }

  /** 매 틱 오라를 다시 걸기 전에 지운다 */
  clearAuraEffects(): void {
    this.auraEffects = [];
  }

  /** 버프와 오라 효과를 지정 시간 동안 끈다 */
  dispel(duration: number): void {
    this.buffs = [];
    this.auraEffects = [];
    this.dispelRemaining = Math.max(this.dispelRemaining, duration);
  }

  /** 지정 시간 동안 모든 회복을 막는다 */
  blockHeal(duration: number): void {
    this.healBlockRemaining = Math.max(this.healBlockRemaining, duration);
  }

  /** 모든 효과 제거 (부활 시) */
  clear(): void {
    this.burns = [];
    this.slows = [];
    this.stunRemaining = 0;
    this.breakStacks = 0;
    this.breakRemaining = 0;
    this.buffs = [];
    this.auraEffects = [];
    this.dispelRemaining = 0;
    this.healBlockRemaining = 0;
  }

  // ----- 진행 -----

  /** 시간을 진행하고, 이번 dt 동안의 화상 기본 피해 총합을 돌려준다 */
  update(dt: number): number {
    let burnDamage = 0;
    for (const b of this.burns) {
      const t = Math.min(dt, b.remaining);
      burnDamage += b.dps * t;
      b.remaining -= t;
    }
    this.burns = this.burns.filter(alive);
    for (const s of this.slows) s.remaining -= dt;
    this.slows = this.slows.filter(alive);
    this.stunRemaining = Math.max(0, this.stunRemaining - dt);
    if (this.breakRemaining > 0) {
      this.breakRemaining -= dt;
      if (this.breakRemaining <= STATUS.epsilon) {
        this.breakRemaining = 0;
        this.breakStacks = 0;
      }
    }
    for (const b of this.buffs) b.remaining -= dt;
    this.buffs = this.buffs.filter(alive);
    this.dispelRemaining = Math.max(0, this.dispelRemaining - dt);
    this.healBlockRemaining = Math.max(0, this.healBlockRemaining - dt);
    return burnDamage;
  }

  // ----- 조회 -----

  get burning(): boolean {
    return this.burns.length > 0;
  }

  /** 걸려 있는 화상 중 가장 센 초당 피해 (없으면 0) */
  get burnDps(): number {
    return this.burns.reduce((m, b) => Math.max(m, b.dps), 0);
  }

  get burnStacks(): number {
    return this.burns.length;
  }

  get slowed(): boolean {
    return this.slows.length > 0;
  }

  /** 가장 강한 감속 비율 */
  get slowRatio(): number {
    return this.slows.reduce((m, s) => Math.max(m, s.ratio), 0);
  }

  get stunned(): boolean {
    return this.stunRemaining > STATUS.epsilon;
  }

  get defenseBreakStacks(): number {
    return this.breakStacks;
  }

  get buffsDisabled(): boolean {
    return this.dispelRemaining > STATUS.epsilon;
  }

  get healBlocked(): boolean {
    return this.healBlockRemaining > STATUS.epsilon;
  }

  get buffed(): boolean {
    return this.buffs.length > 0 || this.auraEffects.length > 0;
  }

  private sum(key: keyof BuffEffect): number {
    let total = 0;
    for (const b of this.buffs) total += b.effect[key] ?? 0;
    for (const e of this.auraEffects) total += e[key] ?? 0;
    return total;
  }

  get attackBonus(): number {
    return this.sum('attack');
  }

  get attackSpeedBonus(): number {
    return this.sum('attackSpeed');
  }

  get damageReduction(): number {
    return this.sum('damageReduction');
  }

  /** 이동 속도 배율: (1 - 감속) x (1 + 이동 속도 버프). 기절 중에는 호출 쪽에서 0 처리 */
  get moveMultiplier(): number {
    return Math.max(0, 1 - this.slowRatio) * Math.max(0, 1 + this.sum('moveSpeed'));
  }
}
