// 툴팁 문구 공통 타입과 숫자 서식 (Phaser에 의존하지 않는다)

export interface TooltipText {
  title: string;
  lines: string[];
}

/** 매 프레임 바뀌는 상태 줄. ok면 초록, 아니면 빨강 */
export interface TooltipStatus {
  text: string;
  ok: boolean;
}

/** 소수 둘째 자리까지 반올림하고 불필요한 0을 뗀다 (84.00000000000001 -> 84) */
export function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** 비율 0.25 -> "25%" */
export function pct(ratio: number): string {
  return `${fmt(ratio * 100)}%`;
}
