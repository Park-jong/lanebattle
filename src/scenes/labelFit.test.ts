import { describe, expect, it } from 'vitest';
import { fitFontSize } from './labelFit';

describe('fitFontSize (줄 수 실측 주입)', () => {
  it('11px에서 3줄, 10px에서 2줄이면 10', () => {
    expect(fitFontSize(2, 11, 8, (s) => (s >= 11 ? 3 : 2))).toBe(10);
  });

  it('모든 크기에서 3줄이면 최소 크기 8', () => {
    expect(fitFontSize(2, 11, 8, () => 3)).toBe(8);
  });

  it('11px에서 이미 2줄이면 11', () => {
    expect(fitFontSize(2, 11, 8, () => 2)).toBe(11);
  });
});

// 검증에서 실측한 11px 기준 폭(px). 글자 크기에 비례한다고 본다
const MEASURED_11: Record<string, number> = { 'W ': 14, '회오리 ': 37, '발차기': 33 };
const LINE_WIDTH = 50;

/** 테스트 전용: 단어(뒤 공백 포함) 단위로 채우는 줄바꿈. measure는 크기/11에 비례 */
function wrapTokens(tokens: string[], size: number, measure: (token: string, size: number) => number): string[][] {
  const lines: string[][] = [[]];
  let used = 0;
  for (const t of tokens) {
    const w = measure(t, size);
    if (used + w > LINE_WIDTH && used > 0) {
      lines.push([]);
      used = 0;
    }
    lines[lines.length - 1].push(t);
    used += w;
  }
  return lines;
}

describe('외다리 "W 회오리 발차기" (실측 폭 고정치)', () => {
  const tokens = ['W ', '회오리 ', '발차기'];
  const measure = (token: string, size: number): number => (MEASURED_11[token] * size) / 11;
  const countLines = (size: number): number => wrapTokens(tokens, size, measure).length;

  it('"W 회오리"의 실측 폭은 51로 줄 폭 50을 넘는다', () => {
    expect(MEASURED_11['W '] + MEASURED_11['회오리 ']).toBe(51);
    expect(51).toBeGreaterThan(LINE_WIDTH);
  });

  it('11px에서는 3줄이다', () => {
    expect(countLines(11)).toBe(3);
  });

  it('맞춘 크기는 10 이하이고 그 크기에서 2줄 이하다', () => {
    const size = fitFontSize(2, 11, 8, countLines);
    expect(size).toBeLessThanOrEqual(10);
    expect(countLines(size)).toBeLessThanOrEqual(2);
  });
});
