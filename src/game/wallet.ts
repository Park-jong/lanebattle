import { SINMYEONG_PURCHASE } from '../data/rewards';
import { STAGES } from '../data/stages';
import type { ProgressStore } from './progress';

/** 엽전·구매 횟수 보관소 (저장 방식은 구현이 정한다) */
export interface PurseStore {
  getYeopjeon(): number;
  setYeopjeon(value: number): void;
  getPurchases(): number;
  setPurchases(value: number): void;
}

export class MemoryPurse implements PurseStore {
  private yeopjeon = 0;
  private purchases = 0;

  getYeopjeon(): number {
    return this.yeopjeon;
  }

  setYeopjeon(value: number): void {
    this.yeopjeon = value;
  }

  getPurchases(): number {
    return this.purchases;
  }

  setPurchases(value: number): void {
    this.purchases = value;
  }
}

/** n번째(1부터) 신명 구매 가격 */
export function purchasePrice(n: number): number {
  return SINMYEONG_PURCHASE.basePrice + SINMYEONG_PURCHASE.priceStep * (n - 1);
}

export type PurchaseResult =
  | { ok: true; price: number }
  | { ok: false; reason: 'maxPurchases' | 'notEnoughYeopjeon' };

/** 신명 총량 공급자 (빌드가 의존하는 작은 인터페이스) */
export interface SinmyeongSource {
  totalSinmyeong(): number;
}

/** 판 밖 재화: 신명 총량, 엽전, 신명 구매 */
export class Wallet implements SinmyeongSource {
  constructor(
    private readonly progress: ProgressStore,
    private readonly purse: PurseStore,
    /** 별·구매와 별개로 더하는 신명 (테스트 모드용, 저장하지 않음) */
    private readonly bonusSinmyeong = 0,
  ) {}

  get yeopjeon(): number {
    return this.purse.getYeopjeon();
  }

  get purchases(): number {
    return this.purse.getPurchases();
  }

  /** 스테이지별 최고 별의 합 (처음 얻은 별만 센다는 규칙과 같다) */
  starSinmyeong(): number {
    let sum = 0;
    for (const s of STAGES) sum += this.progress.getBestStars(s.number);
    return sum;
  }

  /** 신명 총량 = 별 합 + 구매 횟수 + 보너스(기본 0) */
  totalSinmyeong(): number {
    return this.starSinmyeong() + this.purchases + this.bonusSinmyeong;
  }

  /** 클리어 엽전을 더한다. 0 이하·숫자가 아닌 값은 무시 */
  addYeopjeon(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.purse.setYeopjeon(this.purse.getYeopjeon() + Math.floor(amount));
  }

  /** 다음 구매 가격. 횟수가 찼으면 null */
  nextPrice(): number | null {
    return this.purchases >= SINMYEONG_PURCHASE.maxPurchases ? null : purchasePrice(this.purchases + 1);
  }

  /** 엽전으로 신명 1을 산다. 실패하면 아무것도 바뀌지 않는다 */
  buySinmyeong(): PurchaseResult {
    const price = this.nextPrice();
    if (price === null) return { ok: false, reason: 'maxPurchases' };
    if (this.yeopjeon < price) return { ok: false, reason: 'notEnoughYeopjeon' };
    this.purse.setYeopjeon(this.yeopjeon - price);
    this.purse.setPurchases(this.purchases + 1);
    return { ok: true, price };
  }
}
