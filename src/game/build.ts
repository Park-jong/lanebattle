import { GHOST_GATE_TUNING } from '../data/finalStage';
import { BUILD_SLOTS } from '../data/rewards';
import {
  getUpgradeNode,
  YOGOE_UNIT_IDS,
  MAX_TIER,
  nodesOfTree,
  TIER_UNLOCK_SPENT,
  TREE_IDS,
  UPGRADE_NODES,
  yogoeNodeIds,
  type TreeId,
  type UpgradeNode,
} from '../data/upgrades';
import type { SinmyeongSource } from './wallet';

/** 최종 단계(빙의·강림·귀문개방) 해금 조건 실패 */
export type FinalStageFailure = 'mudangIncomplete' | 'salimIncomplete' | 'yeongyeIncomplete' | 'yogoeUnitsIncomplete';
export type AllocateFailure =
  | 'unknownNode' | 'maxLevel' | 'notEnoughSinmyeong' | 'tierLocked' | 'prerequisite' | 'exclusive' | FinalStageFailure;
export type DeallocateFailure = 'unknownNode' | 'notAllocated' | DependencyFailure;
/** 빼면 다른 노드의 단 해금이 깨짐 / 선행이 깨짐 (이때 dependentId에 필요로 하는 노드 id가 담긴다) */
export type DependencyFailure = 'tierDependency' | 'prerequisiteDependency';

export type AllocateCheck = { ok: true } | { ok: false; reason: AllocateFailure };
export type DeallocateCheck =
  | { ok: true }
  | { ok: false; reason: Exclude<DeallocateFailure, DependencyFailure> }
  | { ok: false; reason: DependencyFailure; dependentId: string };

/** 저장·복사용 순수 데이터: 노드 id → 레벨 (0은 생략) */
export type BuildLevels = Record<string, number>;

/**
 * 빌드 한 벌: 노드 id → 레벨.
 * 무당·연계·살림의 단 해금은 "그 트리에서 더 낮은 단들에 쓴 신명"으로 판정한다
 * (높은 단 점수로 낮은 단 기반을 빼내는 편법을 막기 위해).
 */
export class Build {
  private readonly levels = new Map<string, number>();

  constructor(levels: BuildLevels = {}) {
    for (const [id, lv] of Object.entries(levels)) {
      const node = getUpgradeNode(id);
      if (!node || !Number.isInteger(lv) || lv <= 0) continue;
      this.levels.set(id, Math.min(lv, node.maxLevel));
    }
  }

  getLevel(id: string): number {
    return this.levels.get(id) ?? 0;
  }

  toData(): BuildLevels {
    return Object.fromEntries(this.levels);
  }

  clone(): Build {
    return new Build(this.toData());
  }

  /** 전체 쓴 신명 */
  spent(): number {
    let sum = 0;
    for (const [id, lv] of this.levels) sum += lv * (getUpgradeNode(id)?.costPerLevel ?? 0);
    return sum;
  }

  /** 트리에 쓴 신명. belowTier를 주면 그 단 미만만 센다 */
  spentIn(tree: TreeId, belowTier: number = MAX_TIER + 1): number {
    let sum = 0;
    for (const [id, lv] of this.levels) {
      const node = getUpgradeNode(id);
      if (node && node.tree === tree && node.tier < belowTier) sum += lv * node.costPerLevel;
    }
    return sum;
  }

  isTierUnlocked(tree: TreeId, tier: number): boolean {
    // 요괴 트리는 단 기준이 없다 (같은 유닛의 ① → ② → ③ 선행만 확인한다)
    if (tree === 'yogoe') return true;
    return this.spentIn(tree, tier) >= (TIER_UNLOCK_SPENT[tier] ?? Infinity);
  }

  /** 노드의 단이 열려 있는가. 최종 단계 노드는 단 기준 대신 자기 해금 조건만 쓴다 */
  private isNodeTierOpen(node: UpgradeNode): boolean {
    return node.finalStage !== undefined || this.isTierUnlocked(node.tree, node.tier);
  }

  /** 해금된 가장 높은 단 (1~4) */
  unlockedTier(tree: TreeId): number {
    let top = 1;
    for (let t = 2; t <= MAX_TIER; t++) if (this.isTierUnlocked(tree, t)) top = t;
    return top;
  }

  /** available = 지금 쓸 수 있는 신명 */
  canAllocate(nodeId: string, available: number): AllocateCheck {
    const node = getUpgradeNode(nodeId);
    if (!node) return { ok: false, reason: 'unknownNode' };
    if (this.getLevel(nodeId) >= node.maxLevel) return { ok: false, reason: 'maxLevel' };
    if (!this.isNodeTierOpen(node)) return { ok: false, reason: 'tierLocked' };
    if (node.requires && this.getLevel(node.requires) < 1) return { ok: false, reason: 'prerequisite' };
    const finalFailure = this.finalStageFailure(node);
    if (finalFailure) return { ok: false, reason: finalFailure };
    if (this.exclusiveConflict(node)) return { ok: false, reason: 'exclusive' };
    if (available < node.costPerLevel) return { ok: false, reason: 'notEnoughSinmyeong' };
    return { ok: true };
  }

  allocate(nodeId: string, available: number): AllocateCheck {
    const check = this.canAllocate(nodeId, available);
    if (check.ok) this.levels.set(nodeId, this.getLevel(nodeId) + 1);
    return check;
  }

  /** 빼고 나면 다른 노드의 선행·단 해금·배타 조건이 깨지면 거부한다 (연쇄 제거 없음) */
  canDeallocate(nodeId: string): DeallocateCheck {
    if (!getUpgradeNode(nodeId)) return { ok: false, reason: 'unknownNode' };
    if (this.getLevel(nodeId) < 1) return { ok: false, reason: 'notAllocated' };
    const after = this.clone();
    after.setLevel(nodeId, this.getLevel(nodeId) - 1);
    const broken = after.firstBrokenDependency();
    return broken ? { ok: false, ...broken } : { ok: true };
  }

  deallocate(nodeId: string): DeallocateCheck {
    const check = this.canDeallocate(nodeId);
    if (check.ok) this.setLevel(nodeId, this.getLevel(nodeId) - 1);
    return check;
  }

  /**
   * 트리를 다 찍었는가: 레벨 노드는 최대 레벨, 배타 갈래는 각 그룹에서 한쪽 (최종 단계 해금 조건).
   * 최종 단계 노드(강림·귀문개방)는 자기 해금 조건에 쓰이므로 세지 않는다
   */
  isTreeComplete(tree: TreeId): boolean {
    const groupPicked = new Map<string, boolean>();
    for (const n of nodesOfTree(tree)) {
      if (n.finalStage) continue;
      const lv = this.getLevel(n.id);
      if (n.exclusiveGroup) groupPicked.set(n.exclusiveGroup, (groupPicked.get(n.exclusiveGroup) ?? false) || lv > 0);
      else if (lv < n.maxLevel) return false;
    }
    return [...groupPicked.values()].every(Boolean);
  }

  /** ①②③을 모두 찍은 요괴 유닛 수 (귀문개방 해금 조건) */
  awakenedUnitCount(): number {
    return YOGOE_UNIT_IDS.filter((unitId) => this.isUnitAwakened(unitId)).length;
  }

  private isUnitAwakened(unitId: string): boolean {
    const ids = yogoeNodeIds(unitId);
    return this.getLevel(ids.basic) > 0 && this.getLevel(ids.core) > 0 && this.getLevel(ids.awaken) > 0;
  }

  /**
   * 최종 단계 해금 조건 중 신명·선행 노드(requires)를 뺀 나머지가 깨졌으면 그 사유, 아니면 null.
   * 최종 단계가 아닌 노드는 항상 null
   */
  finalStageFailure(node: UpgradeNode): FinalStageFailure | null {
    switch (node.finalStage) {
      case 'possession':
        return this.isTreeComplete('mudang') ? null : 'mudangIncomplete';
      case 'descent':
        if (!this.isTreeComplete('mudang')) return 'mudangIncomplete';
        return this.isTreeComplete('salim') ? null : 'salimIncomplete';
      case 'ghostGate':
        if (this.awakenedUnitCount() < GHOST_GATE_TUNING.minAwakenedUnits) return 'yogoeUnitsIncomplete';
        return this.isTreeComplete('yeongye') ? null : 'yeongyeIncomplete';
      default:
        return null;
    }
  }

  /**
   * 최종 단계 노드가 드러나는가: 해금 조건을 모두 채웠을 때 (신명은 보지 않는다).
   * 빙의는 그 유닛 ①②③ + 무당 트리. 최종 단계가 아닌 노드는 항상 true
   */
  isRevealed(node: UpgradeNode): boolean {
    if (!node.finalStage) return true;
    if (node.possessionOf && !this.isUnitAwakened(node.possessionOf)) return false;
    return this.finalStageFailure(node) === null;
  }

  /** 전부 비운다. 돌려받은 신명 수를 반환 */
  reset(): number {
    const refunded = this.spent();
    this.levels.clear();
    return refunded;
  }

  /** 모든 노드가 규칙을 지키는지 (저장 데이터 검증용) */
  isValid(): boolean {
    for (const [id, lv] of this.levels) {
      const node = getUpgradeNode(id);
      if (!node || lv > node.maxLevel) return false;
      if (!this.isNodeTierOpen(node)) return false;
      if (node.requires && this.getLevel(node.requires) < 1) return false;
      if (this.exclusiveConflict(node)) return false;
      if (this.finalStageFailure(node)) return false;
    }
    return true;
  }

  /** 선행이 깨진 노드를 먼저, 없으면 단 해금이 깨진 노드를 찾는다 */
  private firstBrokenDependency(): { reason: DependencyFailure; dependentId: string } | null {
    let tierBroken: string | null = null;
    for (const [id] of this.levels) {
      const node = getUpgradeNode(id);
      if (!node) continue;
      if (node.requires && this.getLevel(node.requires) < 1) return { reason: 'prerequisiteDependency', dependentId: id };
      // 최종 단계를 찍은 동안에는 그 해금 조건(무당·살림·연계 트리, 요괴 5종)을 깰 수 없다
      if (this.finalStageFailure(node)) return { reason: 'prerequisiteDependency', dependentId: id };
      if (tierBroken === null && !this.isNodeTierOpen(node)) tierBroken = id;
    }
    return tierBroken === null ? null : { reason: 'tierDependency', dependentId: tierBroken };
  }

  private setLevel(id: string, level: number): void {
    if (level <= 0) this.levels.delete(id);
    else this.levels.set(id, level);
  }

  /** 같은 배타 그룹의 다른 노드가 이미 선택됐는가 */
  private exclusiveConflict(node: UpgradeNode): boolean {
    if (!node.exclusiveGroup) return false;
    return UPGRADE_NODES.some(
      (o) => o.id !== node.id && o.exclusiveGroup === node.exclusiveGroup && this.getLevel(o.id) > 0,
    );
  }
}

/** 트리별 쓴 신명 */
export function spentByTree(build: Build): Record<TreeId, number> {
  return Object.fromEntries(TREE_IDS.map((t) => [t, build.spentIn(t)])) as Record<TreeId, number>;
}

/** 저장 칸 한 개의 저장용 데이터 */
export interface BuildSlotData {
  name: string;
  levels: BuildLevels;
}

export interface BuildBookData {
  slots: BuildSlotData[];
  activeSlot: number;
}

export function emptyBuildBookData(): BuildBookData {
  return {
    slots: Array.from({ length: BUILD_SLOTS.count }, () => ({ name: '', levels: {} })),
    activeSlot: 0,
  };
}

/** 저장 칸 3개와 사용 중인 칸. 신명 총량은 SinmyeongSource에서 받는다 */
export class BuildBook {
  private readonly builds: Build[];
  private readonly names: string[];
  private active: number;

  constructor(
    private readonly source: SinmyeongSource,
    data: BuildBookData = emptyBuildBookData(),
    private readonly onChange: () => void = () => {},
  ) {
    this.builds = Array.from({ length: BUILD_SLOTS.count }, (_, i) => new Build(data.slots[i]?.levels ?? {}));
    this.names = Array.from({ length: BUILD_SLOTS.count }, (_, i) => data.slots[i]?.name ?? '');
    this.active = Number.isInteger(data.activeSlot) && data.activeSlot >= 0 && data.activeSlot < BUILD_SLOTS.count ? data.activeSlot : 0;
  }

  get slotCount(): number {
    return this.builds.length;
  }

  get activeIndex(): number {
    return this.active;
  }

  /** 사용 중인 빌드 (읽기용. 변경은 BuildBook 메서드로) */
  get current(): Build {
    return this.builds[this.active];
  }

  getSlot(index: number): Build {
    return this.builds[this.checkIndex(index)];
  }

  getName(index: number): string {
    return this.names[this.checkIndex(index)];
  }

  setName(index: number, name: string): void {
    this.names[this.checkIndex(index)] = name.trim().slice(0, BUILD_SLOTS.maxNameLength);
    this.onChange();
  }

  selectSlot(index: number): void {
    this.active = this.checkIndex(index);
    this.onChange();
  }

  /** from 칸의 빌드를 to 칸에 덮어쓴다 (이름 포함) */
  copySlot(from: number, to: number): void {
    this.checkIndex(from);
    this.checkIndex(to);
    if (from === to) return;
    this.builds[to] = this.builds[from].clone();
    this.names[to] = this.names[from];
    this.onChange();
  }

  /** 현재 칸에서 쓸 수 있는 신명 = 총량 - 현재 빌드에 쓴 신명 */
  availableSinmyeong(): number {
    return this.source.totalSinmyeong() - this.current.spent();
  }

  canAllocate(nodeId: string): AllocateCheck {
    return this.current.canAllocate(nodeId, this.availableSinmyeong());
  }

  allocate(nodeId: string): AllocateCheck {
    const result = this.current.allocate(nodeId, this.availableSinmyeong());
    if (result.ok) this.onChange();
    return result;
  }

  canDeallocate(nodeId: string): DeallocateCheck {
    return this.current.canDeallocate(nodeId);
  }

  deallocate(nodeId: string): DeallocateCheck {
    const result = this.current.deallocate(nodeId);
    if (result.ok) this.onChange();
    return result;
  }

  /** 무료 초기화: 현재 칸의 쓴 신명을 전부 돌려받는다. 반환값은 돌려받은 신명 */
  reset(): number {
    const refunded = this.current.reset();
    if (refunded > 0) this.onChange();
    return refunded;
  }

  /**
   * 안전장치: 쓴 신명이 총량보다 많거나 규칙을 어긴 칸을 초기화한다.
   * 알림은 보내지 않고, 바뀐 칸이 있으면 true를 반환한다 (호출한 쪽이 저장)
   */
  repair(): boolean {
    let changed = false;
    const total = this.source.totalSinmyeong();
    for (const build of this.builds) {
      if (build.spent() > total || !build.isValid()) {
        build.reset();
        changed = true;
      }
    }
    return changed;
  }

  toData(): BuildBookData {
    return {
      slots: this.builds.map((b, i) => ({ name: this.names[i], levels: b.toData() })),
      activeSlot: this.active,
    };
  }

  private checkIndex(index: number): number {
    if (!Number.isInteger(index) || index < 0 || index >= this.builds.length) {
      throw new RangeError(`저장 칸 번호가 범위 밖입니다: ${index}`);
    }
    return index;
  }
}
