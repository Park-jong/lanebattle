import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { getUpgradeNode, nodesOfTree, POSSESSION_COST, possessionNodeId, UPGRADE_NODES, YOGOE_UNIT_IDS, yogoeNodeIds } from '../data/upgrades';
import { Build, BuildBook } from './build';
import { computeBuildEffects, parseUpgradeQuery } from './buildEffects';
import { allocateFailureText, deallocateFailureText, HIDDEN_NODE_NAME, HIDDEN_NODE_TEXT } from './buildText';

const FOX = 'foxfireArcher';
const FOX_POSSESS = possessionNodeId(FOX);

function makeBook(total: number): BuildBook {
  return new BuildBook({ totalSinmyeong: () => total });
}

/** 무당 트리를 모두 찍는다 (레벨 노드는 최대, 스킬 갈래는 첫째 쪽). 31점 */
function fillMudang(book: BuildBook): void {
  for (const n of nodesOfTree('mudang')) {
    while (book.current.getLevel(n.id) < n.maxLevel && book.allocate(n.id).ok) {
      /* 최대 레벨까지 */
    }
  }
}

/** 유닛 ①②③을 찍는다. 10점 */
function fillUnit(book: BuildBook, unitId: string): void {
  const ids = yogoeNodeIds(unitId);
  for (const id of [ids.basic, ids.core, ids.awaken]) expect(book.allocate(id)).toEqual({ ok: true });
}

const failureText = (book: BuildBook, nodeId: string) => {
  const check = book.canAllocate(nodeId);
  if (check.ok) return null;
  return allocateFailureText(check.reason, getUpgradeNode(nodeId)!, {
    build: book.current, available: book.availableSinmyeong(), allNodes: UPGRADE_NODES,
  });
};

describe('빙의 노드 데이터', () => {
  it('유닛마다 하나씩 10개, 최대 레벨 1, 비용 50, 한 배타 그룹, ③ 각성이 선행', () => {
    const nodes = UPGRADE_NODES.filter((n) => n.possessionOf);
    expect(nodes).toHaveLength(10);
    expect(nodes.map((n) => n.possessionOf)).toEqual(YOGOE_UNIT_IDS);
    expect(new Set(nodes.map((n) => n.exclusiveGroup)).size).toBe(1);
    for (const n of nodes) {
      expect(n.id).toBe(`${n.possessionOf}Possess`);
      expect(n.tree).toBe('yogoe');
      expect([n.maxLevel, n.costPerLevel]).toEqual([1, POSSESSION_COST]);
      expect(n.requires).toBe(yogoeNodeIds(n.possessionOf!).awaken);
      expect(n.name).toBe(`빙의: ${ALLIES.find((a) => a.id === n.possessionOf)!.name}`);
    }
    expect(POSSESSION_COST).toBe(50);
  });
});

describe('빙의 해금 조건', () => {
  it('① 그 유닛 ①②③을 안 찍었으면 거부하고 "각성을 먼저" 문구를 보인다', () => {
    const book = makeBook(200);
    fillMudang(book);
    expect(book.allocate(FOX_POSSESS)).toEqual({ ok: false, reason: 'prerequisite' });
    expect(failureText(book, FOX_POSSESS)).toBe('여우불 사수 각성을 먼저 찍어야 합니다');
    // ①②만 찍은 상태도 같다
    book.allocate(yogoeNodeIds(FOX).basic);
    book.allocate(yogoeNodeIds(FOX).core);
    expect(book.allocate(FOX_POSSESS)).toEqual({ ok: false, reason: 'prerequisite' });
  });

  it('② 무당 트리를 다 안 찍었으면 거부한다 (레벨 노드 하나, 갈래 하나가 빠져도)', () => {
    const book = makeBook(200);
    fillUnit(book, FOX);
    expect(book.allocate(FOX_POSSESS)).toEqual({ ok: false, reason: 'mudangIncomplete' });
    expect(failureText(book, FOX_POSSESS)).toBe('무당 트리를 모두 찍어야 합니다');

    fillMudang(book);
    expect(book.canAllocate(FOX_POSSESS)).toEqual({ ok: true });
    // 단단한 몸 한 레벨 부족
    book.deallocate('deepSpirit');
    book.deallocate('mudangAwakening');
    book.deallocate('bladeDanceBlades');
    expect(book.canAllocate(FOX_POSSESS)).toEqual({ ok: false, reason: 'mudangIncomplete' });
    book.allocate('bladeDancePossession'); // 갈래는 어느 쪽이든 하나면 된다
    book.allocate('mudangAwakening');
    book.allocate('deepSpirit');
    expect(book.canAllocate(FOX_POSSESS)).toEqual({ ok: true });
  });

  it('③ 사용 가능 신명이 50 미만이면 거부, 50이면 찍힌다 (총 91)', () => {
    const book = makeBook(90);
    fillMudang(book);
    fillUnit(book, FOX);
    expect(book.availableSinmyeong()).toBe(49);
    expect(book.allocate(FOX_POSSESS)).toEqual({ ok: false, reason: 'notEnoughSinmyeong' });
    expect(failureText(book, FOX_POSSESS)).toContain('필요 50, 남은 49');

    const enough = makeBook(91);
    fillMudang(enough);
    fillUnit(enough, FOX);
    expect(enough.allocate(FOX_POSSESS)).toEqual({ ok: true });
    expect(enough.current.getLevel(FOX_POSSESS)).toBe(1);
    expect(enough.availableSinmyeong()).toBe(0);
    expect(enough.allocate(FOX_POSSESS)).toEqual({ ok: false, reason: 'maxLevel' });
  });
});

describe('빙의 배타·빼기 제한·초기화', () => {
  function possessed(total = 200): BuildBook {
    const book = makeBook(total);
    fillMudang(book);
    fillUnit(book, FOX);
    expect(book.allocate(FOX_POSSESS)).toEqual({ ok: true });
    return book;
  }

  it('한 유닛만 빙의할 수 있다: 두 번째 빙의는 조건을 다 채워도 거부', () => {
    const book = possessed();
    fillUnit(book, 'gumiho');
    expect(book.allocate(possessionNodeId('gumiho'))).toEqual({ ok: false, reason: 'exclusive' });
    expect(failureText(book, possessionNodeId('gumiho'))).toContain('빙의: 여우불 사수');
    // 빼면 다른 유닛으로 바꿀 수 있다
    expect(book.deallocate(FOX_POSSESS)).toEqual({ ok: true });
    expect(book.allocate(possessionNodeId('gumiho'))).toEqual({ ok: true });
  });

  it('빙의 중에는 그 유닛 ①②③을 뺄 수 없다', () => {
    const book = possessed();
    const ids = yogoeNodeIds(FOX);
    expect(book.deallocate(ids.awaken)).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: FOX_POSSESS });
    expect(book.deallocate(ids.core).ok).toBe(false);
    expect(book.deallocate(ids.basic).ok).toBe(false);
    expect(deallocateFailureText(book.canDeallocate(ids.awaken))).toBe('"빙의: 여우불 사수"이(가) 이 노드를 필요로 합니다');
    expect(book.current.getLevel(ids.awaken)).toBe(1);
  });

  it('빙의 중에는 무당 트리 노드를 뺄 수 없다', () => {
    const book = possessed();
    for (const n of nodesOfTree('mudang').filter((m) => book.current.getLevel(m.id) > 0)) {
      const check = book.canDeallocate(n.id);
      expect(check, n.id).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: FOX_POSSESS });
    }
    expect(book.current.getLevel('bellTraining')).toBe(3);
  });

  it('빙의를 빼면 다시 빼기 가능, 다른 트리 노드는 영향 없음', () => {
    const book = possessed();
    book.allocate('generousStart');
    expect(book.deallocate('generousStart')).toEqual({ ok: true });
    expect(book.deallocate(FOX_POSSESS)).toEqual({ ok: true });
    expect(book.deallocate(yogoeNodeIds(FOX).awaken)).toEqual({ ok: true });
    expect(book.deallocate('deepSpirit')).toEqual({ ok: true });
  });

  it('초기화는 빙의 중에도 그대로 동작한다 (신명 91이 돌아온다)', () => {
    const book = possessed();
    expect(book.current.spent()).toBe(91);
    expect(book.reset()).toBe(91);
    expect(book.current.toData()).toEqual({});
    expect(book.availableSinmyeong()).toBe(200);
  });

  it('저장 데이터 검증: 무당 트리 없이 빙의만 있으면 무효, 안전장치가 칸을 비운다', () => {
    const bad = { [FOX_POSSESS]: 1, ...Object.fromEntries(Object.values(yogoeNodeIds(FOX)).map((id) => [id, 1])) };
    expect(new Build(bad).isValid()).toBe(false);
    const book = new BuildBook({ totalSinmyeong: () => 500 }, { slots: [{ name: '', levels: bad }, { name: '', levels: {} }, { name: '', levels: {} }], activeSlot: 0 });
    expect(book.repair()).toBe(true);
    expect(book.current.toData()).toEqual({});
  });
});

describe('빙의 노드 숨김 ("???")', () => {
  const node = getUpgradeNode(FOX_POSSESS)!;

  it('①②③과 무당 트리를 채우기 전에는 숨겨지고, 신명이 모자라도 채우면 드러난다', () => {
    const book = makeBook(41);
    expect(book.current.isRevealed(node)).toBe(false);
    fillMudang(book);
    expect(book.current.isRevealed(node)).toBe(false); // 유닛 미충족
    fillUnit(book, FOX);
    expect(book.current.isRevealed(node)).toBe(true); // 신명 1이 남아 50 미만이어도 이름은 드러난다
    expect(book.canAllocate(FOX_POSSESS)).toEqual({ ok: false, reason: 'notEnoughSinmyeong' });
  });

  it('유닛만 채우고 무당이 비면 숨김, 일반 노드는 항상 드러남', () => {
    const book = makeBook(100);
    fillUnit(book, FOX);
    expect(book.current.isRevealed(node)).toBe(false);
    expect(book.current.isRevealed(getUpgradeNode('bellTraining')!)).toBe(true);
    expect(HIDDEN_NODE_NAME).toBe('???');
    expect(HIDDEN_NODE_TEXT).toContain('숨겨진 힘');
  });
});

describe('빙의 전투 보정값', () => {
  it('빙의 노드 하나가 hero.possession에 유닛 id를 담고, 없으면 null', () => {
    expect(computeBuildEffects({}).hero.possession).toBeNull();
    expect(computeBuildEffects({ [FOX_POSSESS]: 1 }).hero.possession).toBe(FOX);
    for (const unitId of YOGOE_UNIT_IDS) {
      expect(computeBuildEffects({ [possessionNodeId(unitId)]: 1 }).hero.possession).toBe(unitId);
    }
  });

  it('?upg= 쿼리로 조건 없이 켠다', () => {
    const levels = parseUpgradeQuery('foxfireArcherPossess');
    expect(levels).toEqual({ [FOX_POSSESS]: 1 });
    expect(computeBuildEffects(levels).hero.possession).toBe(FOX);
  });

  it('빙의는 유닛 업그레이드(①②③) 보정과 별개다', () => {
    const m = computeBuildEffects({ [FOX_POSSESS]: 1 });
    expect(m.units).toEqual({});
  });
});
