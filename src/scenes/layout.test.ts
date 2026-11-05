import { describe, expect, it } from 'vitest';
import { MAX_TIER, TREE_IDS, nodesOfTree, possessionNodeId, YOGOE_UNIT_IDS, yogoeNodeIds } from '../data/upgrades';
import {
  battleButtons, battleDisplays, BATTLE_LAYOUT, centeredRow, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, MAP_LAYOUT,
  MIN_TOUCH, minimapX, BUILD_LAYOUT, dialogButtons, nodeCells, tierLabelRect, PAUSE_BUTTON, RESULT_LAYOUT, type Rect,
} from './layout';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, outer: Rect) =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
const screen: Rect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };

/** 서로 겹치는 이름 쌍 */
function overlapPairs(items: { name: string; rect: Rect }[]): string[] {
  const out: string[] = [];
  items.forEach((a, i) => {
    for (const b of items.slice(i + 1)) if (overlaps(a.rect, b.rect)) out.push(`${a.name}/${b.name}`);
  });
  return out;
}

describe('전투 HUD 배치', () => {
  const buttons = battleButtons();

  it('버튼은 소환 10 + 스킬 3 + 이동 2 + 기운 모으기 + 일시정지 + 설명', () => {
    expect(buttons).toHaveLength(18);
    expect(BATTLE_LAYOUT.summon).toHaveLength(10);
    expect(BATTLE_LAYOUT.skills).toHaveLength(3);
  });

  it('모든 버튼이 66x66 이상', () => {
    for (const { name, rect } of buttons) {
      expect(rect.w, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(rect.h, name).toBeGreaterThanOrEqual(MIN_TOUCH);
    }
  });

  it('모든 버튼과 표시가 화면 안에 있다', () => {
    for (const { name, rect } of [...buttons, ...battleDisplays()]) expect(inside(rect, screen), name).toBe(true);
  });

  it('버튼끼리 겹치지 않는다', () => {
    expect(overlapPairs(buttons)).toEqual([]);
  });

  it('표시끼리, 버튼과 표시도 겹치지 않는다 (보스 표시는 위쪽 띠 아래)', () => {
    const displays = battleDisplays();
    expect(overlapPairs(displays)).toEqual([]);
    for (const b of buttons) for (const d of displays) expect(overlaps(b.rect, d.rect), `${b.name}/${d.name}`).toBe(false);
    const strip = BATTLE_LAYOUT.topStrip;
    for (const name of ['bossName', 'bossBar', 'bossChips']) {
      const d = displays.find((x) => x.name === name)!;
      expect(d.rect.y, name).toBeGreaterThanOrEqual(strip.y + strip.h);
    }
  });

  it('소환 버튼은 2줄 x 5칸, 아래 패널 안에 있다', () => {
    const rows = new Set(BATTLE_LAYOUT.summon.map((r) => r.y));
    expect(rows.size).toBe(2);
    expect(BATTLE_LAYOUT.summon.filter((r) => r.y === [...rows][0])).toHaveLength(5);
    for (const { name, rect } of buttons.filter((b) => b.name !== 'pause')) expect(inside(rect, BATTLE_LAYOUT.panel), name).toBe(true);
  });

  it('위쪽 띠 안에 위쪽 표시와 일시정지가 들어가고, 땅은 아래 패널 위에 있다', () => {
    const strip = BATTLE_LAYOUT.topStrip;
    for (const r of [BATTLE_LAYOUT.talismanBar, BATTLE_LAYOUT.spiritBar, BATTLE_LAYOUT.minimap, BATTLE_LAYOUT.pause]) {
      expect(inside(r, strip)).toBe(true);
    }
    expect(overlaps(strip, BATTLE_LAYOUT.panel)).toBe(false);
    expect(GROUND_Y).toBeLessThanOrEqual(BATTLE_LAYOUT.panel.y);
  });
});

describe('일시정지·결과 화면 버튼', () => {
  it('일시정지: 66x66 이상, 화면 안, 겹치지 않음', () => {
    const row = centeredRow(2, PAUSE_BUTTON.w, PAUSE_BUTTON.gap, PAUSE_BUTTON.y);
    row.forEach((r) => {
      expect(r.w).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(r, screen)).toBe(true);
    });
    expect(overlaps(row[0], row[1])).toBe(false);
  });

  it('결과: 버튼 2~3개가 패널 안에 들어가고 66x66 이상, 겹치지 않음', () => {
    const { w, gap, y } = RESULT_LAYOUT.button;
    for (const count of [2, 3]) {
      const row = centeredRow(count, w, gap, y);
      row.forEach((r, i) => {
        expect(r.w).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(inside(r, RESULT_LAYOUT.panel)).toBe(true);
        if (i > 0) expect(overlaps(row[i - 1], r)).toBe(false);
      });
    }
  });
});

describe('장과 관문 선택', () => {
  it('장 탭과 다섯 관문의 터치 영역은 화면 안에 있고 서로 겹치지 않는다', () => {
    const M = MAP_LAYOUT;
    expect(M.chapters).toHaveLength(5);
    expect(M.nodes).toHaveLength(5);
    const buttons = [...M.chapters, ...M.nodes].map((rect, i) => ({ name: String(i), rect }));
    for (const { rect } of buttons) {
      expect(rect.w).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(rect.h).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(rect, screen)).toBe(true);
      expect(overlaps(rect, M.preview)).toBe(false);
    }
    expect(overlapPairs(buttons)).toEqual([]);
    for (const rect of M.nodes) expect(inside(rect, M.route)).toBe(true);
    expect(inside(M.route, screen)).toBe(true);
    expect(inside(M.preview, screen)).toBe(true);
    expect(overlaps(M.route, M.preview)).toBe(false);
  });
});

describe('미니맵 좌표', () => {
  const map = BATTLE_LAYOUT.minimap;
  it('전장 양 끝이 미니맵 양 끝이고 범위 밖은 잘린다', () => {
    expect(minimapX(0, 2400, map)).toBe(map.x);
    expect(minimapX(2400, 2400, map)).toBe(map.x + map.w);
    expect(minimapX(1200, 2400, map)).toBe(map.x + map.w / 2);
    expect(minimapX(-50, 2400, map)).toBe(map.x);
    expect(minimapX(9999, 2400, map)).toBe(map.x + map.w);
  });
});

describe('빌드 화면 배치', () => {
  const B = BUILD_LAYOUT;
  /** 탭과 상관없이 늘 보이는 버튼 */
  const fixedButtons = [
    { name: 'back', rect: B.back },
    { name: 'buy', rect: B.buy },
    ...B.slotTabs.map((rect, i) => ({ name: `slot${i}`, rect })),
    { name: 'copy', rect: B.copy },
    { name: 'reset', rect: B.reset },
    ...B.treeTabs.map((rect, i) => ({ name: `tab${i}`, rect })),
    { name: 'allocate', rect: B.allocate },
    { name: 'deallocate', rect: B.deallocate },
  ];
  const fixedDisplays = [
    { name: 'wallet', rect: B.wallet },
    { name: 'boss', rect: B.boss },
    { name: 'detailText', rect: B.detailText },
    { name: 'message', rect: B.message },
  ];

  it('고정 버튼은 66x66 이상, 화면 안, 서로·표시와 겹치지 않는다', () => {
    for (const { name, rect } of fixedButtons) {
      expect(rect.w, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(rect.h, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(rect, screen), name).toBe(true);
    }
    for (const { name, rect } of fixedDisplays) expect(inside(rect, screen), name).toBe(true);
    expect(overlapPairs([...fixedButtons, ...fixedDisplays])).toEqual([]);
  });

  it('위쪽 띠 버튼은 띠 안, 보스 줄과 탭은 띠 아래, 노드 영역은 탭 아래', () => {
    for (const r of [B.back, B.buy, ...B.slotTabs, B.copy, B.reset, B.wallet]) expect(inside(r, B.strip)).toBe(true);
    expect(B.boss.y).toBeGreaterThanOrEqual(B.strip.h);
    expect(B.treeTabs[0].y).toBeGreaterThanOrEqual(B.boss.y + B.boss.h);
    expect(B.nodeArea.y).toBeGreaterThanOrEqual(B.treeTabs[0].y + B.treeTabs[0].h);
    expect(inside(B.nodeArea, screen)).toBe(true);
    expect(overlaps(B.nodeArea, B.detail)).toBe(false);
    for (const r of [...B.treeTabs, B.detailText, B.allocate, B.deallocate, B.message]) expect(r.x + r.w).toBeLessThanOrEqual(screen.w);
    for (const r of [B.detailText, B.allocate, B.deallocate, B.message]) expect(inside(r, B.detail)).toBe(true);
  });

  it('트리 탭마다 노드 칸이 66x66 이상, 화면·노드 영역 안, 겹치지 않는다', () => {
    for (const tree of TREE_IDS) {
      const cells = nodeCells(tree);
      expect(cells.map((c) => c.nodeId).sort()).toEqual(nodesOfTree(tree).map((n) => n.id).sort());
      const items = cells.map((c) => ({ name: c.nodeId, rect: c.rect }));
      const labels =
        tree === 'yogoe'
          ? []
          : Array.from({ length: MAX_TIER }, (_, i) => ({ name: `tier${i + 1}`, rect: tierLabelRect(i + 1) }));
      for (const { name, rect } of [...items, ...labels]) {
        expect(rect.w, name).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(rect.h, name).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(inside(rect, screen), `${tree}/${name}`).toBe(true);
        expect(inside(rect, BUILD_LAYOUT.nodeArea), `${tree}/${name}`).toBe(true);
      }
      expect(overlapPairs([...items, ...labels, ...fixedButtons, ...fixedDisplays]), tree).toEqual([]);
    }
  });

  it('요괴는 40칸(유닛 10종 x ①②③④, 2열 x 5줄), 배타 갈래 쌍은 붙어 있다', () => {
    const yogoe = nodeCells('yogoe');
    expect(yogoe).toHaveLength(40);
    expect(new Set(yogoe.map((c) => c.rect.y)).size).toBe(5);
    expect(new Set(yogoe.map((c) => c.rect.x >= 340)).size).toBe(2);
    const m = nodeCells('mudang');
    const rect = (id: string) => m.find((c) => c.nodeId === id)!.rect;
    const pairGap = rect('fanWindGust').x - (rect('fanWindTornado').x + rect('fanWindTornado').w);
    const groupGap = rect('blessingGrandRite').x - (rect('fanWindGust').x + rect('fanWindGust').w);
    expect(pairGap).toBeLessThan(groupGap);
  });

  it('요괴 탭은 유닛마다 ①②③④ 4칸이 한 줄에 놓이고 ④는 빙의 노드다', () => {
    const cells = nodeCells('yogoe');
    for (const unitId of YOGOE_UNIT_IDS) {
      const row = cells.filter((c) => c.nodeId.startsWith(unitId));
      expect(row.map((c) => c.nodeId)).toEqual([...Object.values(yogoeNodeIds(unitId)), possessionNodeId(unitId)]);
      expect(new Set(row.map((c) => c.rect.y)).size).toBe(1);
      expect(row[3].rect.x).toBeGreaterThan(row[2].rect.x);
    }
  });

  it('소환 순서 탭: 10칸·기본 순서 버튼이 66x66 이상, 화면 안, 겹치지 않는다', () => {
    expect(B.orderCells).toHaveLength(10);
    const items = [
      ...B.orderCells.map((rect, i) => ({ name: `order${i}`, rect })),
      { name: 'orderReset', rect: B.orderReset },
    ];
    for (const { name, rect } of items) {
      expect(rect.w, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(rect.h, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(rect, B.nodeArea), name).toBe(true);
    }
    expect(inside(B.orderHint, B.nodeArea)).toBe(true);
    expect(overlapPairs([...items, { name: 'hint', rect: B.orderHint }, ...fixedButtons, ...fixedDisplays])).toEqual([]);
  });

  it('확인창 버튼은 패널 안, 66x66 이상, 겹치지 않는다', () => {
    for (const count of [2, 3]) {
      const row = dialogButtons(count);
      row.forEach((r, i) => {
        expect(r.w).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(inside(r, B.dialogPanel)).toBe(true);
        if (i > 0) expect(overlaps(row[i - 1], r)).toBe(false);
      });
    }
    expect(inside(B.dialogPanel, screen)).toBe(true);
  });
});
