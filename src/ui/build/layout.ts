import { MAX_TIER, nodesOfTree, possessionNodeId, YOGOE_UNIT_IDS, yogoeNodeIds, type TreeId } from '../../data/upgrades';
import type { Rect } from '../../scenes/layout';

export const BUILD_LAYOUT = {
  back: { x: 12, y: 12, w: 66, h: 66 },
  wallet: { x: 278, y: 13, w: 152, h: 60 },
  buy: { x: 438, y: 12, w: 96, h: 66 },
  slotTabs: Array.from({ length: 3 }, (_, i) => ({ x: 550 + i * 72, y: 12, w: 66, h: 66 })),
  menu: { x: 774, y: 12, w: 66, h: 66 },
  skin: { x: 848, y: 12, w: 100, h: 66 },
  treeTabs: Array.from({ length: 5 }, (_, i) => ({ x: 12, y: 104 + i * 80, w: 80, h: 72 })),
  nodeArea: { x: 104, y: 154, w: 560, h: 350 },
  detail: { x: 680, y: 100, w: 268, h: 404 },
  detailText: { x: 696, y: 218, w: 236, h: 160 },
  allocate: { x: 694, y: 432, w: 154, h: 66 },
  deallocate: { x: 858, y: 432, w: 76, h: 66 },
  message: { x: 696, y: 394, w: 236, h: 32 },
  unitCells: Array.from({ length: 10 }, (_, i) => ({ x: 114 + i % 5 * 108, y: 166 + Math.floor(i / 5) * 83, w: 100, h: 76 })),
  orderCells: Array.from({ length: 10 }, (_, i) => ({ x: 114 + i % 5 * 108, y: 166 + Math.floor(i / 5) * 100, w: 100, h: 90 })),
  orderReset: { x: 114, y: 398, w: 144, h: 66 },
  orderHint: { x: 278, y: 406, w: 366, h: 70 },
  dialogPanel: { x: 218, y: 142, w: 524, h: 254 },
  dialogButtonY: 308,
} satisfies Record<string, Rect | Rect[] | number>;

export function dialogButtons(count: number): Rect[] {
  const w = 140, gap = 12, start = (960 - count * w - (count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: start + i * (w + gap), y: BUILD_LAYOUT.dialogButtonY, w, h: 66 }));
}

export function tierRowY(tier: number): number { return 156 + (tier - 1) * 70; }
export function tierLabelRect(tier: number): Rect { return { x: 110, y: tierRowY(tier), w: 32, h: 66 }; }

/** Only the selected unit's chain is rendered. All ten units remain in the portrait picker. */
export function nodeCells(tree: TreeId, unitId = YOGOE_UNIT_IDS[0]): { nodeId: string; rect: Rect }[] {
  if (tree === 'yogoe') {
    if (!YOGOE_UNIT_IDS.includes(unitId)) return [];
    return [...Object.values(yogoeNodeIds(unitId)), possessionNodeId(unitId)].map((nodeId, i) => ({
      nodeId, rect: { x: 128 + i * 133, y: 386, w: 112, h: 102 },
    }));
  }
  return Array.from({ length: MAX_TIER + 1 }, (_, i) => i + 1).flatMap(tier => {
    const nodes = nodesOfTree(tree).filter(n => (n.finalStage ? MAX_TIER + 1 : n.tier) === tier);
    const gaps = nodes.slice(1).map((n, i) => n.exclusiveGroup && n.exclusiveGroup === nodes[i].exclusiveGroup ? 6 : 16);
    const width = nodes.length * 76 + gaps.reduce((a, b) => a + b, 0);
    let x = tier === MAX_TIER + 1 ? 148 : 148 + (508 - width) / 2;
    return nodes.map((n, i) => {
      if (i > 0) x += gaps[i - 1];
      const cell = { nodeId: n.id, rect: { x, y: tierRowY(tier), w: n.finalStage ? 112 : 76, h: 66 } };
      x += 76;
      return cell;
    });
  });
}
