import { describe, expect, it } from 'vitest';
import { ALLIES } from '../../data/allies';
import { UPGRADE_NODES, getUpgradeNode } from '../../data/upgrades';
import { BUILD_THEMES, MILITARY_UNITS, buildCopy, buildNodeName, nodeIcon } from './theme';

describe('성장 화면 스킨', () => {
  it('기본 표시명·원본 데이터와 수치는 유지하고 군용 표시는 별도로 매핑한다', () => {
    const before = JSON.stringify(UPGRADE_NODES);
    for (const node of UPGRADE_NODES) {
      expect(buildNodeName(node, 'default')).toBe(node.name);
      expect(buildNodeName(node, 'military').length).toBeGreaterThan(0);
      expect(nodeIcon(node, 'default')).toBeTruthy();
      expect(nodeIcon(node, 'military')).toBeTruthy();
    }
    expect(buildNodeName(getUpgradeNode('bellTraining')!, 'military')).toBe('대검 전투 교범');
    expect(buildNodeName(getUpgradeNode('haetaePossess')!, 'military')).toBe('직접 통제: 세이라');
    expect(JSON.stringify(UPGRADE_NODES)).toBe(before);
  });

  it('기획 문서의 병과 대응을 지키며 재화·잠금 안내를 스킨에 맞춰 표시한다', () => {
    expect(Object.keys(MILITARY_UNITS).sort()).toEqual(ALLIES.map(a => a.id).sort());
    expect(MILITARY_UNITS.oneLegGoblin).toBe('하야테');
    expect(MILITARY_UNITS.sumoGoblin).toBe('미카');
    expect(buildCopy('무당 트리를 모두 찍어야 합니다', 'military')).toBe('지휘관 트리를 모두 찍어야 합니다');
    expect(buildCopy('신명 2 / 엽전 50', 'military')).toBe('강화 포인트 2 / 크레딧 50');
    expect(BUILD_THEMES.default.tabs.yogoe).toBe('요괴');
    expect(BUILD_THEMES.military.tabs.yogoe).toBe('병과');
  });
});
