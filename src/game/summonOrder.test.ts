import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { allyIndexForSlot, defaultSummonOrder, moveInOrder, sanitizeSummonOrder, SummonOrder, unitIdForSlot } from './summonOrder';
import { GameSave, SAVE_KEY, type StorageLike } from './save';

class FakeStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

const ids = ALLIES.map((a) => a.id);

describe('소환 순서 이동', () => {
  it('앞으로/뒤로 한 칸 옮긴다', () => {
    const o = moveInOrder(ids, ids[3], -1);
    expect(o[2]).toBe(ids[3]);
    expect(o[3]).toBe(ids[2]);
    const p = moveInOrder(ids, ids[3], 1);
    expect(p[4]).toBe(ids[3]);
    expect(p[3]).toBe(ids[4]);
  });

  it('끝에서는 제자리이고 원본을 바꾸지 않는다', () => {
    expect(moveInOrder(ids, ids[0], -1)).toEqual(ids);
    expect(moveInOrder(ids, ids[9], 1)).toEqual(ids);
    expect(moveInOrder(ids, 'nobody', 1)).toEqual(ids);
  });

  it('SummonOrder는 바뀔 때만 알린다', () => {
    let n = 0;
    const s = new SummonOrder(undefined, () => n++);
    expect(s.move(ids[0], -1)).toBe(false);
    expect(n).toBe(0);
    expect(s.move(ids[0], 1)).toBe(true);
    expect(n).toBe(1);
    expect(s.order[0]).toBe(ids[1]);
    s.reset();
    expect(s.order).toEqual(ids);
  });
});

describe('소환 순서 보정', () => {
  it('중복·누락·모르는 id·길이 다름·형식 오류는 기본 순서', () => {
    const dup = [...ids];
    dup[1] = ids[0];
    expect(sanitizeSummonOrder(dup)).toEqual(ids);
    expect(sanitizeSummonOrder(ids.slice(1))).toEqual(ids);
    expect(sanitizeSummonOrder([...ids.slice(1), 'ghost'])).toEqual(ids);
    expect(sanitizeSummonOrder([...ids.slice(1), 3])).toEqual(ids);
    expect(sanitizeSummonOrder('x')).toEqual(ids);
    expect(sanitizeSummonOrder(undefined)).toEqual(ids);
  });

  it('올바른 순열은 그대로 쓴다', () => {
    const rev = [...ids].reverse();
    expect(sanitizeSummonOrder(rev)).toEqual(rev);
  });
});

describe('버튼 i -> 유닛 매핑', () => {
  it('기본 순서에서는 i번 = ALLIES i번', () => {
    for (let i = 0; i < ids.length; i++) {
      expect(allyIndexForSlot(defaultSummonOrder(), i)).toBe(i);
      expect(unitIdForSlot(defaultSummonOrder(), i)).toBe(ids[i]);
    }
  });

  it('순서를 바꾸면 버튼이 바뀐 유닛을 가리킨다', () => {
    const o = moveInOrder(ids, ids[0], 1); // 0번과 1번 교환
    expect(unitIdForSlot(o, 0)).toBe(ids[1]);
    expect(allyIndexForSlot(o, 0)).toBe(1);
    expect(allyIndexForSlot(o, 1)).toBe(0);
    expect(allyIndexForSlot(o, 10)).toBe(-1);
    expect(unitIdForSlot(o, -1)).toBeUndefined();
  });
});

describe('소환 순서 저장', () => {
  it('저장 왕복', () => {
    const storage = new FakeStorage();
    const a = new GameSave({ storage });
    a.summonOrder.move(ids[4], -1);
    const expected = [...a.summonOrder.order];
    const b = new GameSave({ storage });
    expect(b.summonOrder.order).toEqual(expected);
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).version).toBe(1);
  });

  it('필드가 없거나 손상된 저장은 기본 순서', () => {
    const storage = new FakeStorage();
    storage.map.set(SAVE_KEY, JSON.stringify({ version: 1, stars: [], summonOrder: ['a', 'b'] }));
    expect(new GameSave({ storage }).summonOrder.order).toEqual(ids);
    storage.map.set(SAVE_KEY, JSON.stringify({ version: 1 }));
    expect(new GameSave({ storage }).summonOrder.order).toEqual(ids);
  });
});
