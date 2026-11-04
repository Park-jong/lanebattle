// 툴팁 위치 계산 (Phaser에 의존하지 않는다)
import type { Rect } from '../scenes/layout';

export interface Size {
  w: number;
  h: number;
}

/**
 * 버튼 위쪽 가운데에 툴팁을 놓고, 화면 밖으로 잘리면 안으로 밀어 넣는다.
 * 위쪽 공간이 모자라면 버튼 아래쪽에 놓는다. 반환값은 툴팁의 왼쪽 위 좌표
 */
export function placeTooltip(anchor: Rect, tip: Size, screen: Size, gap = 6, margin = 4): { x: number; y: number } {
  let x = anchor.x + anchor.w / 2 - tip.w / 2;
  let y = anchor.y - gap - tip.h;
  if (y < margin) y = anchor.y + anchor.h + gap;
  x = Math.max(margin, Math.min(screen.w - tip.w - margin, x));
  y = Math.max(margin, Math.min(screen.h - tip.h - margin, y));
  return { x, y };
}
