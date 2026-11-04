import { describe, expect, it } from 'vitest';
import { evaluateStage } from '../battle/result';
import { STAGES } from '../data/stages';
import { MemoryProgress } from './progress';
import { ResultRecorder } from './resultRecorder';
import { MemoryPurse, purchasePrice, Wallet } from './wallet';

function setup() {
  const progress = new MemoryProgress();
  const wallet = new Wallet(progress, new MemoryPurse());
  return { progress, wallet };
}

describe('Wallet', () => {
  it('신명 총량 = 최고 별 합 + 구매 횟수', () => {
    const { progress, wallet } = setup();
    progress.recordResult(0, 3);
    progress.recordResult(1, 2);
    progress.recordResult(1, 1);
    expect(wallet.totalSinmyeong()).toBe(5);
    wallet.addYeopjeon(100);
    wallet.buySinmyeong();
    expect(wallet.totalSinmyeong()).toBe(6);
  });

  it('모든 스테이지 별 3개 + 25회 구매면 최대 100', () => {
    const { progress, wallet } = setup();
    for (const s of STAGES) progress.recordResult(s.number, 3);
    expect(wallet.totalSinmyeong()).toBe(75);
    wallet.addYeopjeon(1e6);
    for (let i = 0; i < 25; i++) expect(wallet.buySinmyeong().ok).toBe(true);
    expect(wallet.totalSinmyeong()).toBe(100);
  });

  it('구매 가격 수열 100, 150, 200', () => {
    expect([1, 2, 3, 25].map(purchasePrice)).toEqual([100, 150, 200, 1300]);
    const { wallet } = setup();
    wallet.addYeopjeon(1000);
    expect(wallet.buySinmyeong()).toEqual({ ok: true, price: 100 });
    expect(wallet.buySinmyeong()).toEqual({ ok: true, price: 150 });
    expect(wallet.nextPrice()).toBe(200);
    expect(wallet.yeopjeon).toBe(750);
  });

  it('엽전이 부족하면 실패하고 아무것도 바뀌지 않는다', () => {
    const { wallet } = setup();
    wallet.addYeopjeon(99);
    expect(wallet.buySinmyeong()).toEqual({ ok: false, reason: 'notEnoughYeopjeon' });
    expect(wallet.yeopjeon).toBe(99);
    expect(wallet.purchases).toBe(0);
  });

  it('26번째 구매는 횟수 초과로 실패', () => {
    const { wallet } = setup();
    wallet.addYeopjeon(1e6);
    for (let i = 0; i < 25; i++) wallet.buySinmyeong();
    expect(wallet.nextPrice()).toBeNull();
    expect(wallet.buySinmyeong()).toEqual({ ok: false, reason: 'maxPurchases' });
  });

  it('이상한 엽전 값은 무시한다', () => {
    const { wallet } = setup();
    wallet.addYeopjeon(-5);
    wallet.addYeopjeon(NaN);
    wallet.addYeopjeon(10.9);
    expect(wallet.yeopjeon).toBe(10);
  });
});

describe('결과 기록과 엽전', () => {
  const stage = STAGES[0];
  const win = (prev: number) =>
    evaluateStage({ victory: true, elapsed: 100, shrineHpRatio: 1, stage, previousBestStars: prev });

  it('반복 클리어도 엽전이 쌓이고 신명은 최고 별 기준', () => {
    const { progress, wallet } = setup();
    const per = win(0).yeopjeon;
    new ResultRecorder(progress, wallet).settle(0, win);
    new ResultRecorder(progress, wallet).settle(0, win);
    expect(wallet.yeopjeon).toBe(per * 2);
    expect(wallet.totalSinmyeong()).toBe(3);
  });

  it('같은 판 결과는 한 번만 지급한다', () => {
    const { progress, wallet } = setup();
    const rec = new ResultRecorder(progress, wallet);
    rec.settle(0, win);
    rec.settle(0, win);
    expect(wallet.yeopjeon).toBe(win(0).yeopjeon);
  });

  it('패배는 엽전 0', () => {
    const { progress, wallet } = setup();
    new ResultRecorder(progress, wallet).settle(0, (prev) =>
      evaluateStage({ victory: false, elapsed: 50, shrineHpRatio: 0, stage, previousBestStars: prev }),
    );
    expect(wallet.yeopjeon).toBe(0);
  });
});
