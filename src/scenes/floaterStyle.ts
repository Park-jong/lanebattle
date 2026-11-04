import type { DamageEvent } from '../battle/damageEvents';
import { FLOATER_COLORS } from './palette';

/** 데미지 숫자 한 개의 표시 방법 */
export interface FloaterStyle {
  text: string;
  color: string;
  /** 글자 크기 배율 (보통 1) */
  scale: number;
}

/** 피해 기록 -> 표시 방법: 면역 > 화상 > 아군 피해 > 약점 > 저항 > 보통 */
export function floaterStyle(e: DamageEvent): FloaterStyle {
  if (e.kind === 'immune') return { text: '면역', color: FLOATER_COLORS.immune, scale: 0.9 };
  const text = String(e.amount);
  if (e.kind === 'burn') {
    return { text, color: e.friendly ? FLOATER_COLORS.friendly : FLOATER_COLORS.burn, scale: 0.7 };
  }
  if (e.friendly) return { text, color: FLOATER_COLORS.friendly, scale: 1 };
  if (e.kind === 'weak') return { text, color: FLOATER_COLORS.weak, scale: 1.4 };
  if (e.kind === 'resist') return { text, color: FLOATER_COLORS.resist, scale: 0.8 };
  return { text, color: FLOATER_COLORS.normal, scale: 1 };
}

/** 최대 개수를 지키는 목록: 넘치면 가장 오래된 것부터 내보낸다 */
export class CappedList<T> {
  private readonly items: T[] = [];

  constructor(private readonly max: number) {}

  get size(): number {
    return this.items.length;
  }

  /** 추가하고, 자리가 모자라 밀려난 항목들을 돌려준다 */
  add(item: T): T[] {
    this.items.push(item);
    return this.items.splice(0, Math.max(0, this.items.length - this.max));
  }

  /** 조건에 맞지 않는 항목을 빼고 빠진 항목들을 돌려준다 */
  keep(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (!predicate(this.items[i])) removed.unshift(...this.items.splice(i, 1));
    }
    return removed;
  }

  forEach(fn: (item: T) => void): void {
    this.items.forEach(fn);
  }
}
