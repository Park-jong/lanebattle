import { describe, expect, it } from 'vitest';
import { gridPosition, MAP_COLUMNS, MAP_ROWS, moveSelection, stageAt } from './mapGrid';

describe('mapGrid', () => {
  it('5장 × 5칸', () => {
    expect(MAP_COLUMNS).toBe(5);
    expect(MAP_ROWS).toBe(5);
  });

  it('번호와 칸 위치가 서로 맞는다', () => {
    for (let s = 0; s < 25; s++) {
      const { row, col } = gridPosition(s);
      expect(stageAt(row, col)).toBe(s);
    }
    expect(gridPosition(7)).toEqual({ row: 1, col: 2 });
  });

  it('방향키로 한 칸씩 이동한다', () => {
    expect(moveSelection(7, 'left')).toBe(6);
    expect(moveSelection(7, 'right')).toBe(8);
    expect(moveSelection(7, 'up')).toBe(2);
    expect(moveSelection(7, 'down')).toBe(12);
  });

  it('가장자리에서는 제자리', () => {
    expect(moveSelection(0, 'left')).toBe(0);
    expect(moveSelection(0, 'up')).toBe(0);
    expect(moveSelection(4, 'right')).toBe(4);
    expect(moveSelection(24, 'down')).toBe(24);
    expect(moveSelection(24, 'right')).toBe(24);
  });

  it('범위 밖 번호는 가까운 칸으로 맞춘다', () => {
    expect(moveSelection(-3, 'right')).toBe(1);
    expect(moveSelection(99, 'left')).toBe(23);
  });
});
