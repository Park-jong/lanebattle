import { describe, expect, it } from 'vitest';
import { ALLIES } from './allies';
import { ALL_SYNERGY_IDS } from './synergy';
import {
  getUpgradeNode,
  nodesOfTree,
  TREE_IDS,
  TIER_UNLOCK_SPENT,
  treeTotalCost,
  UPGRADE_NODES,
  YOGOE_UNIT_IDS,
  yogoeNodeIds,
} from './upgrades';

describe('업그레이드 트리 데이터', () => {
  it('트리별 합계 31/100/46/21, 전체 198', () => {
    expect(treeTotalCost('mudang')).toBe(31);
    expect(treeTotalCost('yogoe')).toBe(100);
    expect(treeTotalCost('yeongye')).toBe(46);
    expect(treeTotalCost('salim')).toBe(21);
    const all = TREE_IDS.reduce((s, t) => s + treeTotalCost(t), 0);
    expect(all).toBe(198);
  });

  it('노드 id는 중복이 없다', () => {
    expect(new Set(UPGRADE_NODES.map((n) => n.id)).size).toBe(UPGRADE_NODES.length);
  });

  it('연계 노드와 synergy id가 1:1이다', () => {
    const ids = nodesOfTree('yeongye').map((n) => n.id).sort();
    expect(ids).toEqual([...ALL_SYNERGY_IDS].sort());
  });

  it('요괴 유닛 10종이 아군 id와 같고 ①②③ 단·선행이 맞다', () => {
    expect([...YOGOE_UNIT_IDS].sort()).toEqual(ALLIES.map((a) => a.id).sort());
    for (const unit of YOGOE_UNIT_IDS) {
      const ids = yogoeNodeIds(unit);
      const basic = getUpgradeNode(ids.basic)!;
      const core = getUpgradeNode(ids.core)!;
      const awaken = getUpgradeNode(ids.awaken)!;
      expect([basic.tier, core.tier, awaken.tier]).toEqual([1, 2, 3]);
      expect([basic.costPerLevel, core.costPerLevel, awaken.costPerLevel]).toEqual([2, 3, 5]);
      expect(core.requires).toBe(basic.id);
      expect(awaken.requires).toBe(core.id);
    }
  });

  it('선행 노드가 실제로 있고 더 낮은 단이다', () => {
    for (const n of UPGRADE_NODES) {
      if (!n.requires) continue;
      const pre = getUpgradeNode(n.requires)!;
      expect(pre.tree).toBe(n.tree);
      expect(pre.tier).toBeLessThan(n.tier);
    }
  });

  it('스킬 갈래 3쌍은 배타 그룹이다', () => {
    for (const g of ['fanWind', 'blessing', 'bladeDance']) {
      expect(UPGRADE_NODES.filter((n) => n.exclusiveGroup === g)).toHaveLength(2);
    }
  });

  it('단 해금 기준 5/12/20', () => {
    expect(TIER_UNLOCK_SPENT).toEqual({ 1: 0, 2: 5, 3: 12, 4: 20 });
  });
});
