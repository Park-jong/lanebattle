import { ALLIES } from '../data/allies';
import { SINMYEONG_PURCHASE } from '../data/rewards';
import { getUpgradeNode, POSSESSION_GROUP, TIER_UNLOCK_SPENT, TREE_IDS, TREE_NAMES, type TreeId, type UpgradeNode } from '../data/upgrades';
import type { AllocateCheck, AllocateFailure, Build, DeallocateCheck } from './build';
import type { PurchaseResult } from './wallet';

// 빌드 화면에 보여 줄 글을 만드는 순수 함수 모음

/** 빌드 화면 탭: 트리 4개 + 소환 순서 */
export type BuildTab = TreeId | 'order';
export const BUILD_TABS: readonly BuildTab[] = [...TREE_IDS, 'order'];
export const ORDER_TAB_NAME = '소환 순서';

export function tabName(tab: BuildTab): string {
  return tab === 'order' ? ORDER_TAB_NAME : TREE_NAMES[tab];
}

/** 노드 칸의 상태 색 구분 */
export type NodeStatus = 'allocated' | 'available' | 'locked' | 'blocked';

/** 노드 이름 (모르는 id면 id 그대로) */
function nameOf(id: string | undefined): string {
  return (id && getUpgradeNode(id)?.name) || id || '';
}

function unitNameOf(unitId: string): string {
  return ALLIES.find((a) => a.id === unitId)?.name ?? unitId;
}

/** 빙의 노드가 아직 숨겨져 있을 때 칸에 보이는 이름 */
export const HIDDEN_NODE_NAME = '???';
/** 숨겨진 빙의 노드의 상세 패널 문구 */
export const HIDDEN_NODE_TEXT = '숨겨진 힘이 잠들어 있다…';

/** 단 해금 조건 문구. 1단은 조건이 없어 null */
export function tierUnlockText(tier: number): string | null {
  const need = TIER_UNLOCK_SPENT[tier];
  return need && need > 0 ? `낮은 단에 ${need}점 필요` : null;
}

/** 같은 배타 그룹의 다른 노드 이름 */
function exclusiveOtherName(build: Build, node: UpgradeNode, allNodes: readonly UpgradeNode[]): string {
  const other = allNodes.find((o) => o.id !== node.id && o.exclusiveGroup === node.exclusiveGroup && build.getLevel(o.id) > 0);
  return other ? other.name : '다른 갈래';
}

/** 찍기 실패 사유 -> 한국어 */
export function allocateFailureText(
  reason: AllocateFailure,
  node: UpgradeNode,
  ctx: { build: Build; available: number; allNodes: readonly UpgradeNode[] },
): string {
  switch (reason) {
    case 'unknownNode':
      return '알 수 없는 노드입니다';
    case 'maxLevel':
      return '이미 최대 레벨입니다';
    case 'notEnoughSinmyeong':
      return `신명이 부족합니다 (필요 ${node.costPerLevel}, 남은 ${ctx.available})`;
    case 'tierLocked': {
      const need = TIER_UNLOCK_SPENT[node.tier] ?? 0;
      return `${node.tier}단이 잠겨 있습니다. 낮은 단에 ${need}점이 필요합니다 (지금 ${ctx.build.spentIn(node.tree, node.tier)}점)`;
    }
    case 'mudangIncomplete':
      return '무당 트리를 모두 찍어야 합니다';
    case 'prerequisite':
      if (node.possessionOf) return `${unitNameOf(node.possessionOf)} 각성을 먼저 찍어야 합니다`;
      return `먼저 "${nameOf(node.requires)}"을(를) 찍어야 합니다`;
    case 'exclusive':
      if (node.exclusiveGroup === POSSESSION_GROUP) {
        return `이미 "${exclusiveOtherName(ctx.build, node, ctx.allNodes)}"에 빙의했습니다. 한 유닛만 빙의할 수 있습니다`;
      }
      return `다른 갈래("${exclusiveOtherName(ctx.build, node, ctx.allNodes)}")를 이미 골랐습니다`;
  }
}

/** 빼기 실패 사유 -> 한국어 (성공이면 null) */
export function deallocateFailureText(check: DeallocateCheck): string | null {
  if (check.ok) return null;
  switch (check.reason) {
    case 'unknownNode':
      return '알 수 없는 노드입니다';
    case 'notAllocated':
      return '찍지 않은 노드입니다';
    case 'prerequisiteDependency':
      return `"${nameOf(check.dependentId)}"이(가) 이 노드를 필요로 합니다`;
    case 'tierDependency':
      return `"${nameOf(check.dependentId)}"이(가) 이 노드의 단 해금 점수를 필요로 합니다`;
  }
}

/** 신명 구매 결과 -> 한국어 */
export function purchaseText(result: PurchaseResult): string {
  if (result.ok) return `신명 1을 얻었습니다 (엽전 ${result.price})`;
  return result.reason === 'maxPurchases'
    ? `신명은 엽전으로 최대 ${SINMYEONG_PURCHASE.maxPurchases}번까지 살 수 있습니다`
    : '엽전이 부족합니다';
}

/** 노드 칸의 상태. 이미 찍었으면 allocated, 아니면 찍기 가능 여부로 나눈다 */
export function nodeStatus(build: Build, node: UpgradeNode, check: AllocateCheck): NodeStatus {
  if (build.getLevel(node.id) > 0) return 'allocated';
  if (check.ok || check.reason === 'notEnoughSinmyeong') return 'available';
  return check.reason === 'exclusive' ? 'blocked' : 'locked';
}
