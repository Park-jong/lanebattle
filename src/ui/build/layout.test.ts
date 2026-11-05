import { describe, expect, it } from 'vitest';
import { MAX_TIER, TREE_IDS, YOGOE_UNIT_IDS, nodesOfTree, yogoeNodeIds, possessionNodeId } from '../../data/upgrades';
import { MIN_TOUCH, type Rect } from '../../scenes/layout';
import { BUILD_LAYOUT as L, dialogButtons, nodeCells, tierLabelRect } from './layout';

const screen = { x: 0, y: 0, w: 960, h: 540 };
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlap = (items: Rect[]) => items.forEach((a, i) => items.slice(i + 1).forEach(b => expect(overlaps(a, b), JSON.stringify([a, b])).toBe(false)));
const fixed = [L.back, L.buy, ...L.slotTabs, L.menu, L.skin, ...L.treeTabs, L.allocate, L.deallocate];
const displays = [L.wallet, L.detailText, L.message];

describe('아이콘 성장 화면의 터치 배치', () => {
  it('모든 고정 조작부는 휴대폰 터치 크기를 유지하고 서로·본문과 겹치지 않는다', () => {
    fixed.forEach(r => {
      expect(r.w).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(r, screen)).toBe(true);
    });
    noOverlap([...fixed, ...displays]);
  });

  it('일반 트리 전체 노드는 중복·누락 없이 표시되고 배타 갈래가 모여 있다', () => {
    for (const tree of TREE_IDS.filter(t => t !== 'yogoe')) {
      const cells = nodeCells(tree);
      expect(cells.map(c => c.nodeId).sort()).toEqual(nodesOfTree(tree).map(n => n.id).sort());
      for (const { rect } of cells) {
        expect(inside(rect, L.nodeArea)).toBe(true);
        expect(rect.w).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(rect.h).toBeGreaterThanOrEqual(MIN_TOUCH);
      }
      const labels = Array.from({ length: MAX_TIER }, (_, i) => tierLabelRect(i + 1));
      noOverlap([...cells.map(c => c.rect), ...labels, ...fixed, ...displays]);
    }
    const rect = (id: string) => nodeCells('mudang').find(c => c.nodeId === id)!.rect;
    expect(rect('fanWindGust').x - rect('fanWindTornado').x).toBeLessThan(rect('blessingGrandRite').x - rect('fanWindGust').x);
  });

  it('유닛 10종 각각의 4단계 경로가 선택 가능하며 초상화·조작부와 겹치지 않는다', () => {
    for (const unit of YOGOE_UNIT_IDS) {
      const cells = nodeCells('yogoe', unit);
      expect(cells.map(c => c.nodeId)).toEqual([...Object.values(yogoeNodeIds(unit)), possessionNodeId(unit)]);
      for (const r of [...L.unitCells, ...cells.map(c => c.rect)]) {
        expect(inside(r, L.nodeArea)).toBe(true);
        expect(r.w).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH);
      }
      noOverlap([...L.unitCells, ...cells.map(c => c.rect), ...fixed, ...displays]);
    }
    expect(nodeCells('yogoe', 'unknown')).toEqual([]);
  });

  it('소환 순서 10칸과 모달은 터치 크기를 유지하고 화면 안에 배치된다', () => {
    expect(L.orderCells).toHaveLength(10);
    const order = [...L.orderCells, L.orderReset, L.orderHint];
    order.forEach(r => expect(inside(r, L.nodeArea)).toBe(true));
    noOverlap([...order, ...fixed, ...displays]);
    for (const count of [2, 3]) {
      const buttons = dialogButtons(count);
      buttons.forEach(r => { expect(inside(r, L.dialogPanel)).toBe(true); expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH); });
      noOverlap(buttons);
    }
  });
});
