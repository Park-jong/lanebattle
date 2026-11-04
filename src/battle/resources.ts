import { RESOURCES } from '../data/resources';

/** 업그레이드(살림·무당)가 바꾸는 자원 보정값. 기본은 효과 없음 */
export interface ResourceModifiers {
  /** 시작 부적에 더하는 값 */
  startTalisman: number;
  /** 부적 최대치에 더하는 값 */
  maxTalismanBonus: number;
  /** 초당 부적 충전에 더하는 값 */
  chargePerSecBonus: number;
  /** 기운 모으기 비용 배율 (0.6 = -40%) */
  gatherCostMultiplier: number;
  /** 기운 모으기 최대 단계 */
  gatherMaxLevel: number;
  /** 처치 부적 배율 (1.5 = +50%) */
  killTalismanMultiplier: number;
  /** 부적을 unit만큼 쓸 때마다 신력 spirit 충전 (null이면 없음) */
  spiritPerCharm: { unit: number; spirit: number } | null;
  /** 신력 시간 충전 배율 */
  spiritChargeMultiplier: number;
  /** 신력 최대치에 더하는 값 */
  maxSpiritBonus: number;
}

export function noResourceModifiers(): ResourceModifiers {
  return {
    startTalisman: 0,
    maxTalismanBonus: 0,
    chargePerSecBonus: 0,
    gatherCostMultiplier: 1,
    gatherMaxLevel: RESOURCES.gather.baseMaxLevel,
    killTalismanMultiplier: 1,
    spiritPerCharm: null,
    spiritChargeMultiplier: 1,
    maxSpiritBonus: 0,
  };
}

/** 부적·신력과 기운 모으기 단계를 관리한다 */
export class Resources {
  talisman: number;
  spirit: number = RESOURCES.spirit.start;
  private level = 0;
  /** 부적 충전 속도 배율 (이무기 강철이의 가뭄: 0.6) */
  private chargeFactor = 1;
  /** 신력 부적용: 아직 신력으로 바뀌지 않은 부적 지출 누적 */
  private spentCharm = 0;

  constructor(private readonly mods: ResourceModifiers = noResourceModifiers()) {
    this.talisman = RESOURCES.talisman.start + mods.startTalisman;
  }

  setTalismanChargeFactor(factor: number): void {
    this.chargeFactor = factor;
  }

  get gatherLevel(): number {
    return this.level;
  }

  /** 기운 모으기 최대 단계 (큰 살림이면 7) */
  get maxGatherLevel(): number {
    return Math.min(this.mods.gatherMaxLevel, RESOURCES.gather.costs.length);
  }

  get maxTalisman(): number {
    return RESOURCES.talisman.max + this.mods.maxTalismanBonus + this.level * RESOURCES.gather.maxBonusPerLevel;
  }

  /** 초당 부적 충전. 가뭄은 보너스까지 합친 전체에 곱해진다 */
  get talismanPerSec(): number {
    const base = RESOURCES.talisman.chargePerSec + this.mods.chargePerSecBonus;
    return (base + this.level * RESOURCES.gather.chargeBonusPerLevel) * this.chargeFactor;
  }

  get maxSpirit(): number {
    return RESOURCES.spirit.max + this.mods.maxSpiritBonus;
  }

  /** 다음 기운 모으기 비용(절감 반영). 최대 단계면 null */
  get nextGatherCost(): number | null {
    if (this.level >= this.maxGatherLevel) return null;
    return Math.round(RESOURCES.gather.costs[this.level] * this.mods.gatherCostMultiplier);
  }

  step(dt: number): void {
    this.addTalisman(this.talismanPerSec * dt);
    this.addSpirit(RESOURCES.spirit.chargePerSec * this.mods.spiritChargeMultiplier * dt);
  }

  addTalisman(amount: number): void {
    this.talisman = Math.min(this.maxTalisman, this.talisman + amount);
  }

  /** 적 처치 보상 (전리품 배율 적용) */
  addKillReward(amount: number): void {
    this.addTalisman(amount * this.mods.killTalismanMultiplier);
  }

  addSpirit(amount: number): void {
    this.spirit = Math.min(this.maxSpirit, this.spirit + amount);
  }

  /** 부적을 쓴다. 쓴 만큼 신력 부적 누적이 쌓인다 (소환·기운 모으기 공통) */
  spendTalisman(amount: number): boolean {
    if (this.talisman < amount) return false;
    this.talisman -= amount;
    this.convertSpentCharm(amount);
    return true;
  }

  private convertSpentCharm(amount: number): void {
    const rule = this.mods.spiritPerCharm;
    if (!rule) return;
    this.spentCharm += amount;
    while (this.spentCharm >= rule.unit) {
      this.spentCharm -= rule.unit;
      this.addSpirit(rule.spirit);
    }
  }

  spendSpirit(amount: number): boolean {
    if (this.spirit < amount) return false;
    this.spirit -= amount;
    return true;
  }

  /** 기운 모으기: 부적을 쓰고 단계를 올린다 */
  gather(): boolean {
    const cost = this.nextGatherCost;
    if (cost === null || !this.spendTalisman(cost)) return false;
    this.level += 1;
    return true;
  }
}
