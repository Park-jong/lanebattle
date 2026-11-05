import { describe, expect, it } from 'vitest';
import { UPGRADE_NODES, getUpgradeNode, possessionNodeId } from '../data/upgrades';
import { SINMYEONG_PURCHASE } from '../data/rewards';
import { Build } from './build';
import { allocateFailureText, deallocateFailureText, nodeStatus, purchaseButtonText, purchaseText, tierUnlockText } from './buildText';

const node = (id: string) => getUpgradeNode(id)!;
const ctx = (build: Build, available = 0) => ({ build, available, allNodes: UPGRADE_NODES });

describe('찍기 실패 사유 문구', () => {
  it('신명 부족, 최대 레벨', () => {
    const b = new Build();
    expect(allocateFailureText('notEnoughSinmyeong', node('bellTraining'), ctx(b, 0))).toContain('신명이 부족');
    expect(allocateFailureText('maxLevel', node('bellTraining'), ctx(b))).toContain('최대 레벨');
  });

  it('단 잠김은 필요한 점수와 현재 점수를 알려 준다', () => {
    const text = allocateFailureText('tierLocked', node('quickRevive'), ctx(new Build({ bellTraining: 2 })));
    expect(text).toContain('2단');
    expect(text).toContain('5점');
    expect(text).toContain('2점');
  });

  it('선행 필요는 선행 노드 이름', () => {
    expect(allocateFailureText('prerequisite', node('clubGoblinCore'), ctx(new Build()))).toContain('기본 강화');
  });

  it('다른 갈래 선택됨은 이미 고른 노드 이름', () => {
    const b = new Build({ fanWindGust: 1 });
    expect(allocateFailureText('exclusive', node('fanWindTornado'), ctx(b))).toContain('부채 바람: 돌풍');
  });
});

describe('최종 단계 거부 문구', () => {
  it('두 번째 최종 단계는 최종 단계 문구, 스킬 갈래 문구는 그대로', () => {
    const b = new Build({ [possessionNodeId('foxfireArcher')]: 1 });
    const text = allocateFailureText('exclusive', node(possessionNodeId('sumoGoblin')), ctx(b));
    expect(text).toBe('이미 최종 단계("빙의: 여우불 사수")를 골랐습니다. 최종 단계는 하나만 고를 수 있습니다');
    expect(text).not.toContain('갈래');
  });
});

describe('빼기 실패 사유 문구', () => {
  it('성공이면 null', () => {
    expect(deallocateFailureText({ ok: true })).toBeNull();
  });

  it('선행/단 해금을 구분하고 의존 노드 이름을 넣는다', () => {
    const pre = deallocateFailureText({ ok: false, reason: 'prerequisiteDependency', dependentId: 'clubGoblinCore' });
    expect(pre).toContain(node('clubGoblinCore').name);
    expect(pre).toContain('필요로');
    const tier = deallocateFailureText({ ok: false, reason: 'tierDependency', dependentId: 'quickRevive' });
    expect(tier).toContain(node('quickRevive').name);
    expect(tier).toContain('단 해금');
    expect(deallocateFailureText({ ok: false, reason: 'notAllocated' })).toContain('찍지 않은');
  });
});

describe('그 밖의 문구와 상태', () => {
  it('구매 결과 문구', () => {
    expect(purchaseText({ ok: false, reason: 'notEnoughYeopjeon' })).toContain('엽전이 부족');
    expect(purchaseText({ ok: false, reason: 'maxPurchases' })).toContain('최대');
    expect(purchaseText({ ok: true, price: 100 })).toContain('100');
  });

  it('단 해금 조건은 1단에 없고 2단부터 점수 표시', () => {
    expect(tierUnlockText(1)).toBeNull();
    expect(tierUnlockText(2)).toBe('낮은 단에 5점 필요');
  });

  it('노드 상태: 찍음 / 찍을 수 있음 / 잠김 / 배타로 막힘', () => {
    const b = new Build({ bellTraining: 3, sturdyBody: 3, quickRevive: 2, spiritSpring: 2, fanWindGust: 1 });
    const st = (id: string, avail: number) => nodeStatus(b, node(id), b.canAllocate(id, avail));
    expect(st('fanWindGust', 9)).toBe('allocated');
    expect(st('fanWindTornado', 9)).toBe('blocked');
    expect(st('mudangAwakening', 9)).toBe('locked');
    expect(st('blessingGrandRite', 9)).toBe('available');
    expect(st('blessingGrandRite', 0)).toBe('available');
  });
});

describe('신명 구매 버튼 문구', () => {
  const { price, maxPurchases } = SINMYEONG_PURCHASE;
  const remaining = (purchases: number) => `신명 구매
엽전 ${price}
남은 ${maxPurchases - purchases}/${maxPurchases}회`;

  it('0회: 남은 횟수가 상한과 같다', () => {
    expect(purchaseButtonText(0)).toBe(remaining(0));
  });

  it('중간: 남은 횟수가 줄어든다', () => {
    const mid = Math.floor(maxPurchases / 2);
    expect(purchaseButtonText(mid)).toBe(remaining(mid));
  });

  it('상한 직전: 남은 1회', () => {
    expect(purchaseButtonText(maxPurchases - 1)).toBe(remaining(maxPurchases - 1));
    expect(purchaseButtonText(maxPurchases - 1)).toContain(`남은 1/${maxPurchases}회`);
  });

  it('상한: 구매 완료를 분명히 알린다', () => {
    expect(purchaseButtonText(maxPurchases)).toBe(`신명 구매
최대 ${maxPurchases}회
구매 완료`);
  });
});
