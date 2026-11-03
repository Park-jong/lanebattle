import { RESOURCES } from '../data/resources';

/** 부적·신력과 기운 모으기 단계를 관리한다 */
export class Resources {
  talisman: number = RESOURCES.talisman.start;
  spirit: number = RESOURCES.spirit.start;
  private level = 0;

  get gatherLevel(): number {
    return this.level;
  }

  get maxTalisman(): number {
    return RESOURCES.talisman.max + this.level * RESOURCES.gather.maxBonusPerLevel;
  }

  get talismanPerSec(): number {
    return RESOURCES.talisman.chargePerSec + this.level * RESOURCES.gather.chargeBonusPerLevel;
  }

  get maxSpirit(): number {
    return RESOURCES.spirit.max;
  }

  /** 다음 기운 모으기 비용. 최대 단계면 null */
  get nextGatherCost(): number | null {
    return RESOURCES.gather.costs[this.level] ?? null;
  }

  step(dt: number): void {
    this.addTalisman(this.talismanPerSec * dt);
    this.addSpirit(RESOURCES.spirit.chargePerSec * dt);
  }

  addTalisman(amount: number): void {
    this.talisman = Math.min(this.maxTalisman, this.talisman + amount);
  }

  addSpirit(amount: number): void {
    this.spirit = Math.min(this.maxSpirit, this.spirit + amount);
  }

  spendTalisman(amount: number): boolean {
    if (this.talisman < amount) return false;
    this.talisman -= amount;
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
