import { describe, expect, it } from 'vitest';
import { ALLIES } from './allies';
import { DESCENT_TUNING, GHOST_GATE_TUNING } from './finalStage';
import { ALL_SYNERGY_IDS } from './synergy';
import {
  getUpgradeNode,
  nodesOfTree,
  TREE_IDS,
  TIER_UNLOCK_SPENT,
  allUpgradesTotalCost,
  treeTotalCost,
  UPGRADE_NODES,
  YOGOE_UNIT_IDS,
  yogoeNodeIds,
} from './upgrades';

describe('업그레이드 트리 데이터', () => {
  it('트리별 합계(트리 안 배타 그룹은 하나) 71/150/47/21, 전체 248 (최종 단계는 트리를 넘는 한 그룹이라 가장 비싼 빙의 50만 센다)', () => {
    expect(treeTotalCost('mudang')).toBe(31 + 40); // + 강림 40
    expect(treeTotalCost('yogoe')).toBe(150); // 빙의 50 포함
    expect(treeTotalCost('yeongye')).toBe(46 + 1); // + 귀문개방 1
    expect(treeTotalCost('salim')).toBe(21);
    // 트리별 합계를 더하면 최종 단계가 겹쳐 세어지므로 전체는 따로 센다
    expect(TREE_IDS.reduce((s, t) => s + treeTotalCost(t), 0)).toBe(289);
    expect(allUpgradesTotalCost()).toBe(248);
  });

  it('노드 id는 중복이 없다', () => {
    expect(new Set(UPGRADE_NODES.map((n) => n.id)).size).toBe(UPGRADE_NODES.length);
  });

  it('연계 노드와 synergy id가 1:1이다', () => {
    const ids = nodesOfTree('yeongye').filter((n) => !n.finalStage).map((n) => n.id).sort();
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

describe('최종 단계 설명은 수치 상수에서 만든다', () => {
  it('귀문개방: 소환 비용 상수가 들어가고 옛 값 30은 없다', () => {
    const d = getUpgradeNode(GHOST_GATE_TUNING.nodeId)!.description;
    expect(d).toContain(`${GHOST_GATE_TUNING.summonCost}으로 고정`);
    expect(d).not.toContain('30');
  });

  it('귀문개방: 쿨타임 배율 0.5는 절반으로 표시', () => {
    expect(GHOST_GATE_TUNING.summonCooldownMultiplier).toBe(0.5);
    expect(getUpgradeNode(GHOST_GATE_TUNING.nodeId)!.description).toContain('절반');
  });

  it('강림: 배율과 쿨타임 상수가 들어간다', () => {
    const t = DESCENT_TUNING;
    const d = getUpgradeNode(t.nodeId)!.description;
    expect(d).toContain(`체력 x${t.hpMultiplier}`);
    expect(d).toContain(`신력 충전 x${t.spiritChargeMultiplier}`);
    expect(d).toContain(`피해 x${t.damageMultiplier}`);
    expect(d).toContain(`Q ${t.cooldowns.fanWind}초·W ${t.cooldowns.blessing}초·E ${t.cooldowns.bladeDance}초`);
  });
});
