import { ALLIES } from '../data/allies';

/** 기본 소환 순서 = 아군 데이터 순서 (유닛 id 10개) */
export function defaultSummonOrder(): string[] {
  return ALLIES.map((a) => a.id);
}

/** 아군 id 10개의 순열이어야 유효하다. 아니면 기본 순서 */
export function sanitizeSummonOrder(raw: unknown): string[] {
  const base = defaultSummonOrder();
  if (!Array.isArray(raw) || raw.length !== base.length) return base;
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== 'string' || !base.includes(id) || seen.has(id)) return base;
    seen.add(id);
  }
  return [...raw] as string[];
}

/** 유닛을 delta칸(-1 앞으로, +1 뒤로) 옮긴 새 순서. 끝에서는 제자리 */
export function moveInOrder(order: readonly string[], unitId: string, delta: number): string[] {
  const from = order.indexOf(unitId);
  const to = from + delta;
  const next = [...order];
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** 소환 버튼(키) i번 → 아군 데이터 인덱스 (Battle.summon이 받는 번호). 범위 밖이면 -1 */
export function allyIndexForSlot(order: readonly string[], slot: number): number {
  const id = order[slot];
  return id === undefined ? -1 : ALLIES.findIndex((a) => a.id === id);
}

/** 소환 버튼(키) i번 → 유닛 id (범위 밖이면 undefined) */
export function unitIdForSlot(order: readonly string[], slot: number): string | undefined {
  return order[slot];
}

/** 저장되는 소환 순서. 바뀌면 알림을 보낸다 (저장 칸과 무관한 전역 설정) */
export class SummonOrder {
  private current: string[];

  constructor(
    initial: unknown = undefined,
    private readonly onChange: () => void = () => {},
  ) {
    this.current = sanitizeSummonOrder(initial);
  }

  get order(): readonly string[] {
    return this.current;
  }

  /** 버튼 slot번이 소환할 아군 데이터 인덱스 */
  allyIndexAt(slot: number): number {
    return allyIndexForSlot(this.current, slot);
  }

  move(unitId: string, delta: number): boolean {
    const next = moveInOrder(this.current, unitId, delta);
    if (next.every((id, i) => id === this.current[i])) return false;
    this.current = next;
    this.onChange();
    return true;
  }

  reset(): void {
    this.current = defaultSummonOrder();
    this.onChange();
  }

  toData(): string[] {
    return [...this.current];
  }
}
