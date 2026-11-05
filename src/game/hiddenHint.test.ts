import { describe, expect, it } from 'vitest';
import { FINAL_STAGE_HINTS } from '../data/finalStage';
import { getUpgradeNode, possessionNodeId, YOGOE_UNIT_IDS } from '../data/upgrades';
import { HIDDEN_NODE_TEXT, hiddenNodeDetailText } from './buildText';

// numbers.md 11장 "??? 힌트": 숨겨진 최종 단계 칸에만 종류별 한 줄 힌트

describe('숨겨진 칸 힌트 문구', () => {
  it('숨겨진 최종 단계는 기본 문구 아래에 종류별 힌트가 붙는다', () => {
    const possession = getUpgradeNode(possessionNodeId(YOGOE_UNIT_IDS[0]))!;
    const descent = getUpgradeNode('descent')!;
    const gate = getUpgradeNode('ghostGate')!;
    expect(hiddenNodeDetailText(possession, false)).toBe(`${HIDDEN_NODE_TEXT}\n${FINAL_STAGE_HINTS.possession}`);
    expect(hiddenNodeDetailText(descent, false)).toContain('하늘에서 무언가 내려온다');
    expect(hiddenNodeDetailText(gate, false)).toContain('닫힌 문이 열린다');
    expect(FINAL_STAGE_HINTS.possession).toContain('둘은 하나가 된다');
  });

  it('빙의 노드 10개는 모두 같은 힌트를 쓴다', () => {
    for (const unitId of YOGOE_UNIT_IDS) {
      expect(hiddenNodeDetailText(getUpgradeNode(possessionNodeId(unitId))!, false)).toContain(FINAL_STAGE_HINTS.possession);
    }
  });

  it('공개 상태에서는 힌트가 없다', () => {
    for (const id of ['descent', 'ghostGate']) {
      expect(hiddenNodeDetailText(getUpgradeNode(id)!, true)).toBe('');
    }
  });

  it('최종 단계가 아닌 노드는 힌트가 없다', () => {
    const text = hiddenNodeDetailText(getUpgradeNode('emberI')!, false);
    expect(text).toBe(HIDDEN_NODE_TEXT);
    for (const hint of Object.values(FINAL_STAGE_HINTS)) expect(text).not.toContain(hint);
  });
});
