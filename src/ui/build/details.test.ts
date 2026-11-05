import { describe, expect, it } from 'vitest';
import { getUpgradeNode, UPGRADE_NODES } from '../../data/upgrades';
import { levelEffectPreview } from './details';

describe('성장 수치 미리보기', () => {
  it('반복 투자 노드 모두에 현재와 다음 누적 효과를 보여준다', () => {
    for (const node of UPGRADE_NODES.filter(n => n.maxLevel > 1)) {
      expect(levelEffectPreview(node, 0)).toContain('→');
      expect(levelEffectPreview(node, node.maxLevel)).toContain('최대');
      expect(levelEffectPreview(node, node.maxLevel)).not.toContain('→');
    }
  });
  it('최종 수치를 레벨당 증가량과 혼동하지 않고 백분율·소수·감소를 표시한다', () => {
    expect(levelEffectPreview(getUpgradeNode('bellTraining')!, 2)).toBe('공격력  +20% → +30%');
    expect(levelEffectPreview(getUpgradeNode('qiCycle')!, 1)).toBe('부적 충전  +1.5/초 → +3/초');
    expect(levelEffectPreview(getUpgradeNode('quickRevive')!, 0)).toBe('부활 시간  −0초 → −1초');
    expect(levelEffectPreview(getUpgradeNode('thriftyLiving')!, 1)).toBe('기운 모으기 비용  −20% → −40%');
    expect(levelEffectPreview(getUpgradeNode('mudangAwakening')!, 0)).toBeNull();
  });
});
