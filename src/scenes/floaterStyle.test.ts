import { describe, expect, it } from 'vitest';
import { Base } from '../battle/entities';
import type { DamageEvent, HitKind } from '../battle/damageEvents';
import { CappedList, floaterStyle } from './floaterStyle';
import { FLOATER_COLORS } from './palette';

const target = new Base('enemy', 0, 100, 10, 10);
const ev = (kind: HitKind, friendly = false, amount = 12): DamageEvent => ({ target, x: 0, amount, kind, friendly });

describe('데미지 숫자 표시', () => {
  it('약점은 노란색 큰 숫자', () => {
    expect(floaterStyle(ev('weak'))).toEqual({ text: '12', color: FLOATER_COLORS.weak, scale: 1.4 });
  });
  it('저항은 회색 작은 숫자', () => {
    expect(floaterStyle(ev('resist'))).toEqual({ text: '12', color: FLOATER_COLORS.resist, scale: 0.8 });
  });
  it('보통은 흰색', () => {
    expect(floaterStyle(ev('normal'))).toEqual({ text: '12', color: FLOATER_COLORS.normal, scale: 1 });
  });
  it('아군이 받은 피해는 빨간색', () => {
    expect(floaterStyle(ev('normal', true)).color).toBe(FLOATER_COLORS.friendly);
  });
  it('면역은 "면역" 글자', () => {
    expect(floaterStyle(ev('immune', false, 0)).text).toBe('면역');
  });
  it('화상은 작고 주황색, 아군 화상은 작고 빨간색', () => {
    const burn = floaterStyle(ev('burn'));
    expect(burn.color).toBe(FLOATER_COLORS.burn);
    expect(burn.scale).toBeLessThan(1);
    expect(floaterStyle(ev('burn', true)).color).toBe(FLOATER_COLORS.friendly);
  });
});

describe('CappedList (동시 표시 수 상한)', () => {
  it('상한을 넘으면 오래된 것부터 내보낸다', () => {
    const list = new CappedList<number>(3);
    expect(list.add(1)).toEqual([]);
    list.add(2);
    list.add(3);
    expect(list.add(4)).toEqual([1]);
    expect(list.add(5)).toEqual([2]);
    expect(list.size).toBe(3);
    const seen: number[] = [];
    list.forEach((n) => seen.push(n));
    expect(seen).toEqual([3, 4, 5]);
  });

  it('keep은 조건에 맞지 않는 항목을 순서대로 돌려주며 뺀다', () => {
    const list = new CappedList<number>(10);
    [1, 2, 3, 4, 5, 6].forEach((n) => list.add(n));
    expect(list.keep((n) => n % 2 === 0)).toEqual([1, 3, 5]);
    expect(list.size).toBe(3);
  });

  it('많이 넣어도 상한을 넘지 않는다', () => {
    const list = new CappedList<number>(60);
    for (let i = 0; i < 500; i++) list.add(i);
    expect(list.size).toBe(60);
  });
});
