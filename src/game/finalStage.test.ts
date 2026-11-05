import { describe, expect, it } from 'vitest';
import { GHOST_GATE_TUNING } from '../data/finalStage';
import { SINMYEONG_PURCHASE } from '../data/rewards';
import {
  allUpgradesTotalCost, getUpgradeNode, nodesOfTree, possessionNodeId, UPGRADE_NODES, YOGOE_UNIT_IDS, yogoeNodeIds, type TreeId,
} from '../data/upgrades';
import { BuildBook } from './build';
import { computeBuildEffects, parseUpgradeQuery } from './buildEffects';
import { allocateFailureText, deallocateFailureText, HIDDEN_NODE_NAME } from './buildText';
import { MemoryProgress } from './progress';
import { parseSave, SAVE_VERSION } from './save';
import { MemoryPurse, Wallet } from './wallet';

// numbers.md 8장 신명 구매 변경, 11장 강림·귀문개방 노드·해금·배타

const DESCENT = 'descent';
const GATE = 'ghostGate';
const FOX = 'foxfireArcher';

function makeBook(total: number): BuildBook {
  return new BuildBook({ totalSinmyeong: () => total });
}

/** 트리를 모두 찍는다 (최종 단계 노드는 건너뛴다). 레벨 노드는 최대, 스킬 갈래는 첫째 쪽 */
function fillTree(book: BuildBook, tree: TreeId): void {
  for (const n of nodesOfTree(tree).filter((m) => !m.finalStage)) {
    while (book.current.getLevel(n.id) < n.maxLevel && book.allocate(n.id).ok) {
      /* 최대 레벨까지 */
    }
  }
}

/** 요괴 유닛 count종의 ①②③을 찍는다 (앞에서부터) */
function fillUnits(book: BuildBook, count: number): void {
  for (const unitId of YOGOE_UNIT_IDS.slice(0, count)) {
    for (const id of Object.values(yogoeNodeIds(unitId))) expect(book.allocate(id)).toEqual({ ok: true });
  }
}

/** 강림 해금 조건(무당 + 살림)을 채운 장부. 31 + 21 = 52점 사용 */
function descentReady(total: number): BuildBook {
  const book = makeBook(total);
  fillTree(book, 'mudang');
  fillTree(book, 'salim');
  return book;
}

/** 귀문개방 해금 조건(요괴 units종 + 연계)을 채운 장부. 5종이면 50 + 46 = 96점 사용 */
function gateReady(total: number, units = 5): BuildBook {
  const book = makeBook(total);
  fillUnits(book, units);
  fillTree(book, 'yeongye');
  return book;
}

const failureText = (book: BuildBook, nodeId: string) => {
  const check = book.canAllocate(nodeId);
  if (check.ok) return null;
  return allocateFailureText(check.reason, getUpgradeNode(nodeId)!, {
    build: book.current, available: book.availableSinmyeong(), allNodes: UPGRADE_NODES,
  });
};

describe('신명 구매 (12-0): 100 엽전 고정, 최대 50회', () => {
  const setup = () => {
    const wallet = new Wallet(new MemoryProgress(), new MemoryPurse());
    wallet.addYeopjeon(100000);
    return wallet;
  };

  it('수치는 가격 100, 최대 50회', () => {
    expect(SINMYEONG_PURCHASE).toEqual({ price: 100, maxPurchases: 50 });
  });

  it('구매 버튼 가격(nextPrice)은 횟수와 관계없이 100이고 50회 후에만 null', () => {
    const wallet = setup();
    for (let i = 0; i < 50; i++) {
      expect(wallet.nextPrice(), `${i}회 구매 후`).toBe(100);
      expect(wallet.buySinmyeong()).toEqual({ ok: true, price: 100 });
    }
    expect(wallet.nextPrice()).toBeNull();
    expect(wallet.buySinmyeong()).toEqual({ ok: false, reason: 'maxPurchases' });
    expect(wallet.yeopjeon).toBe(100000 - 5000);
    expect(wallet.totalSinmyeong()).toBe(50);
  });

  it('엽전이 100 미만이면 실패하고 아무것도 바뀌지 않는다', () => {
    const wallet = new Wallet(new MemoryProgress(), new MemoryPurse());
    wallet.addYeopjeon(99);
    expect(wallet.buySinmyeong()).toEqual({ ok: false, reason: 'notEnoughYeopjeon' });
    expect(wallet.yeopjeon).toBe(99);
    expect(wallet.purchases).toBe(0);
  });

  it('저장 보정 상한 50: 51은 50, 25 이하의 기존 저장은 그대로, 음수는 0', () => {
    const load = (purchases: number) => parseSave(JSON.stringify({ version: SAVE_VERSION, purchases })).purchases;
    expect(load(51)).toBe(50);
    expect(load(999)).toBe(50);
    expect(load(50)).toBe(50);
    expect(load(25)).toBe(25);
    expect(load(1)).toBe(1);
    expect(load(-3)).toBe(0);
  });
});

describe('최종 단계 노드 데이터', () => {
  it('강림은 무당 트리·비용 40·최대 1, 귀문개방은 연계 트리·비용 1·최대 1', () => {
    const d = getUpgradeNode(DESCENT)!;
    const g = getUpgradeNode(GATE)!;
    expect([d.tree, d.costPerLevel, d.maxLevel, d.finalStage]).toEqual(['mudang', 40, 1, 'descent']);
    expect([g.tree, g.costPerLevel, g.maxLevel, g.finalStage]).toEqual(['yeongye', 1, 1, 'ghostGate']);
  });

  it('빙의 10개 + 강림 + 귀문개방이 하나의 배타 그룹이다', () => {
    const finals = UPGRADE_NODES.filter((n) => n.finalStage);
    expect(finals).toHaveLength(12);
    expect(new Set(finals.map((n) => n.exclusiveGroup)).size).toBe(1);
    expect(finals.map((n) => n.id)).toEqual(expect.arrayContaining([DESCENT, GATE, ...YOGOE_UNIT_IDS.map(possessionNodeId)]));
  });

  it('전체 비용은 최종 단계 중 가장 비싼 빙의 50만 세어 248이다', () => {
    expect(allUpgradesTotalCost()).toBe(248);
  });
});

describe('강림 해금 조건', () => {
  it('무당 트리가 비면 거부한다', () => {
    const book = makeBook(300);
    fillTree(book, 'salim');
    expect(book.allocate(DESCENT)).toEqual({ ok: false, reason: 'mudangIncomplete' });
    expect(failureText(book, DESCENT)).toBe('무당 트리를 모두 찍어야 합니다');
  });

  it('살림 트리가 비면 거부한다', () => {
    const book = makeBook(300);
    fillTree(book, 'mudang');
    expect(book.allocate(DESCENT)).toEqual({ ok: false, reason: 'salimIncomplete' });
    expect(failureText(book, DESCENT)).toBe('살림 트리를 모두 찍어야 합니다');
  });

  it('살림을 한 레벨이라도 덜 찍으면 거부한다', () => {
    const book = descentReady(300);
    expect(book.deallocate('charmPouch')).toEqual({ ok: true });
    expect(book.allocate(DESCENT)).toEqual({ ok: false, reason: 'salimIncomplete' });
  });

  it('신명이 모자라면 거부한다 (52 + 40 = 92 필요)', () => {
    const book = descentReady(91);
    expect(book.current.spent()).toBe(52);
    expect(book.allocate(DESCENT)).toEqual({ ok: false, reason: 'notEnoughSinmyeong' });
    expect(failureText(book, DESCENT)).toBe('신명이 부족합니다 (필요 40, 남은 39)');
  });

  it('조건을 채우면 찍힌다 (총 92). 단 해금 기준은 따로 보지 않는다', () => {
    const book = descentReady(92);
    expect(book.allocate(DESCENT)).toEqual({ ok: true });
    expect(book.current.spent()).toBe(92);
    expect(book.current.isValid()).toBe(true);
  });

  it('자기 자신은 무당 트리 완료 판정에서 빠진다 (찍은 뒤에도 무당 트리는 완료)', () => {
    const book = descentReady(100);
    book.allocate(DESCENT);
    expect(book.current.isTreeComplete('mudang')).toBe(true);
  });
});

describe('귀문개방 해금 조건', () => {
  it('요괴 4종이면 거부하고 문구를 보인다', () => {
    const book = gateReady(300, 4);
    expect(book.allocate(GATE)).toEqual({ ok: false, reason: 'yogoeUnitsIncomplete' });
    expect(failureText(book, GATE)).toBe('요괴 유닛 5종 이상을 각성(③)까지 찍어야 합니다 (지금 4종)');
  });

  it('유닛 한 종이 ①②만이면 그 유닛은 세지 않는다', () => {
    const book = gateReady(300, 4);
    const ids = yogoeNodeIds(YOGOE_UNIT_IDS[4]);
    book.allocate(ids.basic);
    book.allocate(ids.core);
    expect(book.current.awakenedUnitCount()).toBe(4);
    expect(book.allocate(GATE)).toEqual({ ok: false, reason: 'yogoeUnitsIncomplete' });
  });

  it('연계 트리가 비면 거부한다', () => {
    const book = makeBook(300);
    fillUnits(book, 5);
    expect(book.allocate(GATE)).toEqual({ ok: false, reason: 'yeongyeIncomplete' });
    expect(failureText(book, GATE)).toBe('연계 트리를 모두 찍어야 합니다');
  });

  it('신명이 모자라면 거부한다 (50 + 46 + 1 = 97 필요)', () => {
    const book = gateReady(96);
    expect(book.current.spent()).toBe(96);
    expect(book.allocate(GATE)).toEqual({ ok: false, reason: 'notEnoughSinmyeong' });
  });

  it('조건을 채우면 찍힌다 (총 97). 빙의 ④나 무당 트리는 필요 없다', () => {
    const book = gateReady(97);
    expect(book.allocate(GATE)).toEqual({ ok: true });
    expect(book.current.spent()).toBe(97);
    expect(book.current.isValid()).toBe(true);
    expect(book.current.getLevel('bellTraining')).toBe(0);
  });

  it('6종 이상 찍어도 되고, 자기 자신은 연계 트리 완료 판정에서 빠진다', () => {
    const book = gateReady(300, 7);
    expect(book.allocate(GATE)).toEqual({ ok: true });
    expect(book.current.isTreeComplete('yeongye')).toBe(true);
  });
});

describe('최종 단계 배타 (빙의 / 강림 / 귀문개방 중 하나)', () => {
  /** 세 조건을 모두 채운 장부 (무당 + 살림 + 요괴 5종 + 연계) */
  function allReady(): BuildBook {
    const book = makeBook(1000);
    fillTree(book, 'mudang');
    fillTree(book, 'salim');
    fillTree(book, 'yeongye');
    fillUnits(book, 5);
    return book;
  }

  it('빙의를 찍으면 강림을 거부한다', () => {
    const book = allReady();
    expect(book.allocate(possessionNodeId(FOX))).toEqual({ ok: true });
    expect(book.allocate(DESCENT)).toEqual({ ok: false, reason: 'exclusive' });
    expect(failureText(book, DESCENT)).toBe('이미 최종 단계("빙의: 여우불 사수")를 골랐습니다. 최종 단계는 하나만 고를 수 있습니다');
  });

  it('강림을 찍으면 귀문개방을 거부한다', () => {
    const book = allReady();
    expect(book.allocate(DESCENT)).toEqual({ ok: true });
    expect(book.allocate(GATE)).toEqual({ ok: false, reason: 'exclusive' });
    expect(failureText(book, GATE)).toContain('이미 최종 단계("강림")를 골랐습니다');
  });

  it('귀문개방을 찍으면 빙의를 거부한다', () => {
    const book = allReady();
    expect(book.allocate(GATE)).toEqual({ ok: true });
    expect(book.allocate(possessionNodeId(FOX))).toEqual({ ok: false, reason: 'exclusive' });
    expect(failureText(book, possessionNodeId(FOX))).toContain('이미 최종 단계("귀문개방")를 골랐습니다');
  });

  it('나머지 방향도 거부한다: 강림 -> 빙의, 귀문개방 -> 강림, 빙의 -> 귀문개방', () => {
    const a = allReady();
    a.allocate(DESCENT);
    expect(a.allocate(possessionNodeId(FOX))).toEqual({ ok: false, reason: 'exclusive' });
    const b = allReady();
    b.allocate(GATE);
    expect(b.allocate(DESCENT)).toEqual({ ok: false, reason: 'exclusive' });
    const c = allReady();
    c.allocate(possessionNodeId(FOX));
    expect(c.allocate(GATE)).toEqual({ ok: false, reason: 'exclusive' });
  });

  it('빼면 다른 최종 단계로 바꿀 수 있다', () => {
    const book = allReady();
    book.allocate(DESCENT);
    expect(book.deallocate(DESCENT)).toEqual({ ok: true });
    expect(book.allocate(GATE)).toEqual({ ok: true });
  });

  it('저장 검증: 최종 단계가 둘 이상 들어 있으면 안전장치가 칸을 비운다', () => {
    const book = allReady();
    book.allocate(DESCENT);
    const levels = { ...book.current.toData(), [GATE]: 1 };
    const broken = new BuildBook(
      { totalSinmyeong: () => 1000 },
      { slots: [{ name: '', levels }, { name: '', levels: {} }, { name: '', levels: {} }], activeSlot: 0 },
    );
    expect(broken.repair()).toBe(true);
    expect(broken.current.toData()).toEqual({});
  });
});

describe('강림 중 빼기 제한 / 초기화', () => {
  function descended(): BuildBook {
    const book = descentReady(200);
    expect(book.allocate(DESCENT)).toEqual({ ok: true });
    return book;
  }

  it('무당·살림 노드를 뺄 수 없다 (강림이 필요로 한다)', () => {
    const book = descended();
    for (const tree of ['mudang', 'salim'] as const) {
      for (const n of nodesOfTree(tree).filter((m) => !m.finalStage && book.current.getLevel(m.id) > 0)) {
        expect(book.canDeallocate(n.id), n.id).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: DESCENT });
      }
    }
    expect(deallocateFailureText(book.canDeallocate('deepSpirit'))).toBe('"강림"이(가) 이 노드를 필요로 합니다');
  });

  it('연계 노드는 영향 없이 찍고 뺄 수 있다', () => {
    const book = descended();
    expect(book.allocate('emberI')).toEqual({ ok: true });
    expect(book.deallocate('emberI')).toEqual({ ok: true });
  });

  it('강림을 빼면 무당·살림 노드도 다시 뺄 수 있다', () => {
    const book = descended();
    expect(book.deallocate(DESCENT)).toEqual({ ok: true });
    expect(book.deallocate('deepSpirit')).toEqual({ ok: true });
  });

  it('초기화는 강림 중에도 동작한다 (92가 돌아온다)', () => {
    const book = descended();
    expect(book.current.spent()).toBe(92);
    expect(book.reset()).toBe(92);
    expect(book.current.toData()).toEqual({});
    expect(book.availableSinmyeong()).toBe(200);
  });
});

describe('귀문개방 중 빼기 제한 / 초기화', () => {
  it('연계 노드를 뺄 수 없다', () => {
    const book = gateReady(300);
    expect(book.allocate(GATE)).toEqual({ ok: true });
    for (const n of nodesOfTree('yeongye').filter((m) => !m.finalStage)) {
      expect(book.canDeallocate(n.id), n.id).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: GATE });
    }
  });

  it('정확히 5종이면 요괴 ①②③을 뺄 수 없다', () => {
    const book = gateReady(300, 5);
    book.allocate(GATE);
    const ids = yogoeNodeIds(YOGOE_UNIT_IDS[0]);
    expect(book.canDeallocate(ids.awaken)).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: GATE });
    expect(book.canDeallocate(ids.basic).ok).toBe(false);
  });

  it('6종이면 한 종을 빼도 5종이 유지되므로 허용하고, 5종이 깨지는 순간부터 거부한다', () => {
    const book = gateReady(300, 6);
    book.allocate(GATE);
    const first = yogoeNodeIds(YOGOE_UNIT_IDS[0]);
    expect(book.deallocate(first.awaken)).toEqual({ ok: true }); // 5종 유지
    expect(book.current.awakenedUnitCount()).toBe(5);
    const second = yogoeNodeIds(YOGOE_UNIT_IDS[1]);
    expect(book.canDeallocate(second.awaken)).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: GATE });
    // ③을 뺀 유닛의 ②는 5종 조건과 무관하므로 뺄 수 있다
    expect(book.deallocate(first.core)).toEqual({ ok: true });
  });

  it('초기화는 언제든 가능하다 (97이 돌아온다)', () => {
    const book = gateReady(300);
    book.allocate(GATE);
    expect(book.reset()).toBe(97);
    expect(book.current.toData()).toEqual({});
  });
});

describe('강림·귀문개방 숨김 ("???")', () => {
  const descent = getUpgradeNode(DESCENT)!;
  const gate = getUpgradeNode(GATE)!;

  it('강림은 조건을 채우기 전에는 숨겨지고, 신명이 모자라도 조건을 채우면 드러난다', () => {
    const book = makeBook(60);
    expect(book.current.isRevealed(descent)).toBe(false);
    fillTree(book, 'mudang');
    expect(book.current.isRevealed(descent)).toBe(false); // 살림 미충족
    fillTree(book, 'salim');
    expect(book.current.isRevealed(descent)).toBe(true); // 신명 8이 남아 40 미만이어도 드러난다
    expect(book.canAllocate(DESCENT)).toEqual({ ok: false, reason: 'notEnoughSinmyeong' });
    expect(HIDDEN_NODE_NAME).toBe('???');
  });

  it('귀문개방은 요괴 5종 + 연계가 모두 채워져야 드러난다', () => {
    const book = makeBook(300);
    expect(book.current.isRevealed(gate)).toBe(false);
    fillTree(book, 'yeongye');
    expect(book.current.isRevealed(gate)).toBe(false); // 요괴 0종
    fillUnits(book, 4);
    expect(book.current.isRevealed(gate)).toBe(false); // 4종
    const fifth = yogoeNodeIds(YOGOE_UNIT_IDS[4]);
    for (const id of Object.values(fifth)) book.allocate(id);
    expect(book.current.isRevealed(gate)).toBe(true);
  });

  it('최종 단계가 아닌 노드는 항상 드러난다', () => {
    expect(makeBook(0).current.isRevealed(getUpgradeNode('emberI')!)).toBe(true);
  });
});

describe('?upg= 와 전투 보정값', () => {
  it('?upg=descent, ?upg=ghostGate 로 각각 켠다 (규칙·신명은 보지 않는다)', () => {
    expect(computeBuildEffects({}).hero.descent).toBe(false);
    expect(computeBuildEffects({}).ghostGate).toBe(false);
    expect(computeBuildEffects(parseUpgradeQuery('descent')).hero.descent).toBe(true);
    expect(computeBuildEffects(parseUpgradeQuery('descent')).ghostGate).toBe(false);
    expect(computeBuildEffects(parseUpgradeQuery('ghostGate')).ghostGate).toBe(true);
    expect(computeBuildEffects(parseUpgradeQuery('ghostGate')).hero.descent).toBe(false);
  });

  it('여럿이 들어오면 빙의 > 강림 > 귀문개방 순으로 하나만 쓴다', () => {
    const m = computeBuildEffects(parseUpgradeQuery(`${possessionNodeId(FOX)},descent,ghostGate`));
    expect(m.hero.possession).toBe(FOX);
    expect(m.hero.descent).toBe(false);
    expect(m.ghostGate).toBe(false);
    const both = computeBuildEffects({ descent: 1, ghostGate: 1 });
    expect([both.hero.descent, both.ghostGate]).toEqual([true, false]);
  });

  it('귀문개방 해금 수치는 5종', () => {
    expect(GHOST_GATE_TUNING.minAwakenedUnits).toBe(5);
  });
});
