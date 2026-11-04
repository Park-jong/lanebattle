import type { SynergyId } from './synergy';

// numbers.md 9장 업그레이드 트리 전체. params는 game/buildEffects.ts가 읽어 전투 보정값으로 바꾼다

export type TreeId = 'mudang' | 'yogoe' | 'yeongye' | 'salim';
export const TREE_IDS: readonly TreeId[] = ['mudang', 'yogoe', 'yeongye', 'salim'];

export const TREE_NAMES: Record<TreeId, string> = {
  mudang: '무당',
  yogoe: '요괴',
  yeongye: '연계',
  salim: '살림',
};

/** 단 해금 기준: 단 번호(1~4) → 그 단보다 아래 단들에 쓴 신명이 이 값 이상이어야 열린다 */
export const TIER_UNLOCK_SPENT: Readonly<Record<number, number>> = { 1: 0, 2: 5, 3: 12, 4: 20 };
export const MAX_TIER = 4;

export interface UpgradeNode {
  id: string;
  tree: TreeId;
  /** 트리 단 1~4 */
  tier: number;
  name: string;
  /** 효과 설명 */
  description: string;
  maxLevel: number;
  /** 레벨당 비용 (신명) */
  costPerLevel: number;
  /** 선행 노드 id (레벨 1 이상이어야 함) */
  requires?: string;
  /** 상호 배타 그룹: 같은 그룹에서는 한 노드만 찍을 수 있다 */
  exclusiveGroup?: string;
  /** 전투에 적용할 때 쓰는 수치 (B 묶음) */
  params?: Readonly<Record<string, number>>;
}

type NodeInit = Omit<UpgradeNode, 'tree' | 'maxLevel' | 'costPerLevel'> & { maxLevel?: number; cost: number };

function make(tree: TreeId, init: NodeInit): UpgradeNode {
  const { cost, maxLevel, ...rest } = init;
  return { ...rest, tree, maxLevel: maxLevel ?? 1, costPerLevel: cost };
}

// ── 무당 (합계 31) ──
const MUDANG_INITS: NodeInit[] = [
  { id: 'bellTraining', tier: 1, name: '방울 단련', description: '기본 공격력 +10%', maxLevel: 3, cost: 1, params: { attackBonus: 0.1 } },
  { id: 'sturdyBody', tier: 1, name: '단단한 몸', description: '체력 +15%', maxLevel: 3, cost: 1, params: { hpBonus: 0.15 } },
  { id: 'quickRevive', tier: 2, name: '빠른 부활', description: '부활 시간 -1초', maxLevel: 2, cost: 2, params: { reviveReduction: 1 } },
  { id: 'spiritSpring', tier: 2, name: '신력 샘', description: '신력 충전 +20%', maxLevel: 2, cost: 2, params: { chargeBonus: 0.2 } },
  { id: 'fanWindTornado', tier: 3, name: '부채 바람: 회오리', description: '부채 바람 범위 +50%', cost: 3, exclusiveGroup: 'fanWind', params: { rangeBonus: 0.5 } },
  { id: 'fanWindGust', tier: 3, name: '부채 바람: 돌풍', description: '부채 바람 피해 x2, 넉백 x1.5', cost: 3, exclusiveGroup: 'fanWind', params: { damageMultiplier: 2, knockbackMultiplier: 1.5 } },
  { id: 'blessingGrandRite', tier: 3, name: '축원: 큰 굿', description: '축원 범위 +50%, 회복 40%', cost: 3, exclusiveGroup: 'blessing', params: { rangeBonus: 0.5, healRatio: 0.4 } },
  { id: 'blessingSpiritRelease', tier: 3, name: '축원: 신명 풀이', description: '축원 공격력 버프 +50%', cost: 3, exclusiveGroup: 'blessing', params: { attackBuff: 0.5 } },
  { id: 'bladeDanceBlades', tier: 3, name: '작두 타기: 칼날 춤', description: '3초간 초당 40 추가 피해', cost: 3, exclusiveGroup: 'bladeDance', params: { duration: 3, damagePerSec: 40 } },
  { id: 'bladeDancePossession', tier: 3, name: '작두 타기: 신내림', description: '작두 타기 쿨타임 -40%', cost: 3, exclusiveGroup: 'bladeDance', params: { cooldownReduction: 0.4 } },
  { id: 'mudangAwakening', tier: 4, name: '무당 각성', description: '기본 공격 3번째마다 반경 80 충격파 (공격력 x1.5)', cost: 5, params: { everyNth: 3, radius: 80, attackMultiplier: 1.5 } },
  { id: 'deepSpirit', tier: 4, name: '깊은 신기', description: '신력 최대 +50', cost: 3, params: { maxSpiritBonus: 50 } },
];
const MUDANG_NODES: UpgradeNode[] = MUDANG_INITS.map((n) => make('mudang', n));

// ── 요괴 (유닛 10종 x 10 = 합계 100) ──
interface UnitUpgradeText {
  name: string;
  description: string;
  params?: Record<string, number>;
}
interface UnitUpgrade {
  unitId: string;
  core: UnitUpgradeText;
  awaken: UnitUpgradeText;
}

const UNIT_UPGRADES: UnitUpgrade[] = [
  { unitId: 'clubGoblin',
    core: { name: '비용·쿨타임 절감', description: '비용 -20%, 쿨타임 -30%', params: { costReduction: 0.2, cooldownReduction: 0.3 } },
    awaken: { name: '뚝딱', description: '적을 처치하면 10% 확률로 방망이병 1마리 추가 소환', params: { chance: 0.1, count: 1 } } },
  { unitId: 'oneLegGoblin',
    core: { name: '강화 돌격', description: '돌격 피해 x3 -> x4', params: { chargeMultiplier: 4 } },
    awaken: { name: '관통 돌격', description: '돌격이 지나가는 길의 적 모두에게 피해', params: { pathExtra: 60 } } },
  { unitId: 'sumoGoblin',
    core: { name: '잦은 메치기', description: '메치기 3타 -> 2타마다', params: { everyNth: 2 } },
    awaken: { name: '충돌 메치기', description: '메친 적이 뒤의 적과 부딪혀 둘 다 피해 40', params: { collisionDamage: 40 } } },
  { unitId: 'foxfireArcher',
    core: { name: '맹렬한 불', description: '화상 초당 4 -> 7', params: { burnPerSec: 7 } },
    awaken: { name: '쌍갈래 화살', description: '화살 2갈래 (대상 2명)', params: { targets: 2 } } },
  { unitId: 'gumiho',
    core: { name: '넓은 불꽃', description: '범위 +40%', params: { areaBonus: 0.4 } },
    awaken: { name: '불꽃 3연발', description: '불꽃 3연발', params: { shots: 3, shotInterval: 0.15 } } },
  { unitId: 'bulgasari',
    core: { name: '깊은 파괴', description: '방어 파괴 최대 5 -> 8중첩', params: { maxStacks: 8 } },
    awaken: { name: '쇠를 먹는 자', description: '갑옷 적을 처치하면 체력 30% 회복, 그 판 동안 공격력 +5% (중첩)', params: { healRatio: 0.3, attackPerStack: 0.05 } } },
  { unitId: 'haetae',
    core: { name: '오래 붙잡기', description: '붙잡기 2 -> 3.5초', params: { holdSeconds: 3.5 } },
    awaken: { name: '정의의 수호', description: '반경 120 아군 받는 피해 -20%', params: { radius: 120, damageReduction: 0.2 } } },
  { unitId: 'samjokgo',
    core: { name: '강한 오라', description: '오라 +20% -> +35%', params: { auraBonus: 0.35 } },
    awaken: { name: '태양 불꽃', description: '10초마다 화면 안 적 전체에 화상', params: { interval: 10, radius: 480 } } },
  { unitId: 'magpieFlock',
    core: { name: '두 무리', description: '소환 시 2무리', params: { flocks: 2 } },
    awaken: { name: '매서운 부리', description: '비행 적에게 x2 -> x3, 맞은 비행 적 0.3초 경직', params: { flyingMultiplier: 3, stagger: 0.3 } } },
  { unitId: 'yeongdeungWind',
    core: { name: '강한 바람 오라', description: '오라 +15% -> +25%', params: { auraBonus: 0.25 } },
    awaken: { name: '되돌림 바람', description: '빗나감 25% -> 50%, 빗나간 투사체는 적에게 되돌아감', params: { missChance: 0.5, reflect: 1 } } },
];

/** 요괴 노드 id 규칙: <유닛id>Basic / Core / Awaken */
export function yogoeNodeIds(unitId: string): { basic: string; core: string; awaken: string } {
  return { basic: `${unitId}Basic`, core: `${unitId}Core`, awaken: `${unitId}Awaken` };
}

const YOGOE_NODES: UpgradeNode[] = UNIT_UPGRADES.flatMap((u) => {
  const ids = yogoeNodeIds(u.unitId);
  return [
    make('yogoe', { id: ids.basic, tier: 1, name: '기본 강화', description: '체력·공격력 +25%', cost: 2, params: { hpBonus: 0.25, attackBonus: 0.25 } }),
    // 요괴 트리는 단 해금 기준이 없고 ① → ② → ③ 선행만 확인한다 (tier는 표시용)
    make('yogoe', { id: ids.core, tier: 2, name: u.core.name, description: u.core.description, cost: 3, requires: ids.basic, params: u.core.params }),
    make('yogoe', { id: ids.awaken, tier: 3, name: u.awaken.name, description: u.awaken.description, cost: 5, requires: ids.core, params: u.awaken.params }),
  ];
});

/** 요괴 노드가 속한 유닛 id 목록 (표시·검증용) */
export const YOGOE_UNIT_IDS: readonly string[] = UNIT_UPGRADES.map((u) => u.unitId);

// ── 연계 (합계 46). 노드 id = 연계 id ──
const SYNERGY_INITS: (NodeInit & { id: SynergyId })[] = [
  { id: 'dokkaebiGatheringI', tier: 1, name: '도깨비 모임 Ⅰ', description: '도깨비 3마리 이상: 도깨비 공격 속도 +15%', cost: 2 },
  { id: 'emberI', tier: 1, name: '불씨 Ⅰ', description: '화상 피해 +30%', cost: 2 },
  { id: 'guardianVowI', tier: 1, name: '수호의 맹세 Ⅰ', description: '신수 2마리 이상: 신수 받는 피해 -15%', cost: 2 },
  { id: 'tailwindI', tier: 1, name: '순풍 Ⅰ', description: '바람 2마리 이상: 바람 유닛 이동 +20%, 공격 속도 +10%', cost: 2 },
  { id: 'dokkaebiGatheringII', tier: 2, name: '도깨비 모임 Ⅱ', description: '도깨비 5마리 이상: 도깨비 공격력 +20%', cost: 3 },
  { id: 'emberII', tier: 2, name: '불씨 Ⅱ', description: '화상 2중첩 가능', cost: 3 },
  { id: 'guardianVowII', tier: 2, name: '수호의 맹세 Ⅱ', description: '신수 반경 120 아군 초당 체력 2% 회복', cost: 3 },
  { id: 'tailwindII', tier: 2, name: '순풍 Ⅱ', description: '바람 유닛 공격이 적 이동 속도 -20%, 1.5초', cost: 3 },
  { id: 'dokkaebiFire', tier: 3, name: '도깨비불', description: '화상 걸린 적을 도깨비가 치면 피해 +40%', cost: 4 },
  { id: 'guardFormation', tier: 3, name: '수호 진형', description: '해태가 앞에 있으면 그 뒤 원거리·마법 유닛 받는 피해 -30%', cost: 4 },
  { id: 'fireWind', tier: 3, name: '불바람', description: '바람 유닛이 화상 걸린 적을 치면 반경 60에 화상 확산', cost: 4 },
  { id: 'divineBlessing', tier: 3, name: '신수의 축복', description: '신수 반경 120 안의 도깨비 최대 체력 +30%', cost: 4 },
  { id: 'linkRing', tier: 3, name: '연계의 고리', description: '두 태그 유닛이 태그 수를 2로 셈', cost: 4 },
  { id: 'hundredDemons', tier: 4, name: '백귀야행', description: '4가지 태그가 모두 전장에 있으면 모든 아군 공격력 +20%, 받는 피해 -10%', cost: 6 },
];
const YEONGYE_NODES: UpgradeNode[] = SYNERGY_INITS.map((n) => make('yeongye', n));

// ── 살림 (합계 21) ──
const SALIM_INITS: NodeInit[] = [
  { id: 'generousStart', tier: 1, name: '넉넉한 시작', description: '시작 부적 +25', maxLevel: 2, cost: 1, params: { startCharm: 25 } },
  { id: 'charmPouch', tier: 1, name: '부적 주머니', description: '부적 최대치 +40', maxLevel: 3, cost: 1, params: { maxCharm: 40 } },
  { id: 'qiCycle', tier: 1, name: '기운 순환', description: '부적 충전 +1.5/초', maxLevel: 3, cost: 1, params: { chargePerSec: 1.5 } },
  { id: 'thriftyLiving', tier: 2, name: '알뜰 살림', description: '기운 모으기 비용 -20%', maxLevel: 2, cost: 2, params: { costReduction: 0.2 } },
  { id: 'spoils', tier: 2, name: '전리품', description: '처치 부적 +50%', cost: 2, params: { killCharmBonus: 0.5 } },
  { id: 'bigEconomy', tier: 3, name: '큰 살림', description: '기운 모으기 최대 5 -> 7단계', cost: 4, params: { maxLevel: 7 } },
  { id: 'spiritCharm', tier: 3, name: '신력 부적', description: '부적 100을 쓸 때마다 신력 +10', cost: 3, params: { charmUnit: 100, spirit: 10 } },
];
const SALIM_NODES: UpgradeNode[] = SALIM_INITS.map((n) => make('salim', n));

export const UPGRADE_NODES: readonly UpgradeNode[] = [
  ...MUDANG_NODES,
  ...YOGOE_NODES,
  ...YEONGYE_NODES,
  ...SALIM_NODES,
];

const NODE_BY_ID: ReadonlyMap<string, UpgradeNode> = new Map(UPGRADE_NODES.map((n) => [n.id, n]));

export function getUpgradeNode(id: string): UpgradeNode | undefined {
  return NODE_BY_ID.get(id);
}

export function nodesOfTree(tree: TreeId): UpgradeNode[] {
  return UPGRADE_NODES.filter((n) => n.tree === tree);
}

/** 노드를 끝까지 찍는 데 드는 총 비용 */
export function nodeTotalCost(node: UpgradeNode): number {
  return node.maxLevel * node.costPerLevel;
}

/** 트리를 최대로 찍는 데 드는 비용. 배타 그룹은 둘 중 하나만 센다 */
export function treeTotalCost(tree: TreeId): number {
  let sum = 0;
  const groupBest = new Map<string, number>();
  for (const n of nodesOfTree(tree)) {
    if (!n.exclusiveGroup) sum += nodeTotalCost(n);
    else groupBest.set(n.exclusiveGroup, Math.max(groupBest.get(n.exclusiveGroup) ?? 0, nodeTotalCost(n)));
  }
  for (const v of groupBest.values()) sum += v;
  return sum;
}
