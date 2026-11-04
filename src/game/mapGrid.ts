import { STAGES } from '../data/stages';
import { WAVE_RULES } from '../data/waves';

// 지도 칸 이동 계산 (Phaser 비의존). 줄 = 장, 칸 = 장 안 순서

export const MAP_COLUMNS = WAVE_RULES.stagesPerChapter;
export const MAP_ROWS = Math.ceil(STAGES.length / MAP_COLUMNS);

export type MapDirection = 'left' | 'right' | 'up' | 'down';

export interface GridPosition {
  row: number;
  col: number;
}

export function gridPosition(stage: number): GridPosition {
  return { row: Math.floor(stage / MAP_COLUMNS), col: stage % MAP_COLUMNS };
}

export function stageAt(row: number, col: number): number {
  return row * MAP_COLUMNS + col;
}

/** 방향키 이동. 가장자리에서는 제자리에 머문다 (순환 없음) */
export function moveSelection(stage: number, direction: MapDirection): number {
  const safe = Math.max(0, Math.min(STAGES.length - 1, Math.floor(stage) || 0));
  const { row, col } = gridPosition(safe);
  const dRow = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  const dCol = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const nextRow = row + dRow;
  const nextCol = col + dCol;
  if (nextRow < 0 || nextRow >= MAP_ROWS || nextCol < 0 || nextCol >= MAP_COLUMNS) return safe;
  const next = stageAt(nextRow, nextCol);
  return next < STAGES.length ? next : safe;
}
