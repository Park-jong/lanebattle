import { noModifiers, type BattleModifiers, type UnitModifiers } from '../battle/modifiers';
import { isSynergyId, type SynergyId } from '../data/synergy';
import { getUpgradeNode, nodesOfTree, YOGOE_UNIT_IDS, yogoeNodeIds } from '../data/upgrades';
import type { BuildLevels } from './build';

/**
 * 빌드(노드 id → 레벨)를 전투 보정값으로 바꾸는 순수 함수.
 * 규칙(신명·선행·단 해금)은 검사하지 않는다 - 그건 Build의 일이다.
 * 레벨은 노드의 최대 레벨로 잘라 쓰고, 알 수 없는 id는 무시한다.
 */
export function computeBuildEffects(levels: Readonly<BuildLevels>): BattleModifiers {
  const m = noModifiers();
  const level = (id: string): number => {
    const node = getUpgradeNode(id);
    const lv = levels[id] ?? 0;
    return node && Number.isInteger(lv) && lv > 0 ? Math.min(lv, node.maxLevel) : 0;
  };
  const param = (id: string, key: string): number => getUpgradeNode(id)?.params?.[key] ?? 0;
  /** 레벨 x 노드 수치 */
  const perLevel = (id: string, key: string): number => level(id) * param(id, key);

  // ── 무당 ──
  m.hero.attackMultiplier += perLevel('bellTraining', 'attackBonus');
  m.hero.hpMultiplier += perLevel('sturdyBody', 'hpBonus');
  m.hero.reviveReduction += perLevel('quickRevive', 'reviveReduction');
  m.hero.spiritChargeMultiplier += perLevel('spiritSpring', 'chargeBonus');
  m.hero.maxSpiritBonus += perLevel('deepSpirit', 'maxSpiritBonus');
  if (level('mudangAwakening') > 0) {
    m.hero.awakening = {
      everyNth: param('mudangAwakening', 'everyNth'),
      radius: param('mudangAwakening', 'radius'),
      attackMultiplier: param('mudangAwakening', 'attackMultiplier'),
    };
  }
  if (level('fanWindTornado') > 0) m.skills.fanWind.rangeMultiplier += param('fanWindTornado', 'rangeBonus');
  if (level('fanWindGust') > 0) {
    m.skills.fanWind.damageMultiplier = param('fanWindGust', 'damageMultiplier');
    m.skills.fanWind.knockbackMultiplier = param('fanWindGust', 'knockbackMultiplier');
  }
  if (level('blessingGrandRite') > 0) {
    m.skills.blessing.rangeMultiplier += param('blessingGrandRite', 'rangeBonus');
    m.skills.blessing.healRatio = param('blessingGrandRite', 'healRatio');
  }
  // 신명 풀이: 공격력 버프에 +50%p 가산 (기본 25% -> 75%)
  if (level('blessingSpiritRelease') > 0) m.skills.blessing.attackBonus += param('blessingSpiritRelease', 'attackBuffAdd');
  if (level('bladeDanceBlades') > 0) {
    m.skills.bladeDance.extraDuration = param('bladeDanceBlades', 'duration');
    m.skills.bladeDance.extraDamagePerSec = param('bladeDanceBlades', 'damagePerSec');
  }
  if (level('bladeDancePossession') > 0) {
    m.skills.bladeDance.cooldownMultiplier -= param('bladeDancePossession', 'cooldownReduction');
  }

  // ── 요괴 ──
  const units: Record<string, UnitModifiers> = {};
  for (const unitId of YOGOE_UNIT_IDS) {
    const ids = yogoeNodeIds(unitId);
    const [basic, core, awaken] = [level(ids.basic), level(ids.core), level(ids.awaken)];
    if (basic + core + awaken === 0) continue;
    units[unitId] = {
      hpMultiplier: 1 + (basic > 0 ? param(ids.basic, 'hpBonus') : 0),
      attackMultiplier: 1 + (basic > 0 ? param(ids.basic, 'attackBonus') : 0),
      core: core > 0 ? { ...getUpgradeNode(ids.core)?.params } : null,
      awaken: awaken > 0 ? { ...getUpgradeNode(ids.awaken)?.params } : null,
    };
  }
  m.units = units;

  // ── 연계: 찍은 노드 id가 곧 연계 id ──
  m.synergies = nodesOfTree('yeongye')
    .filter((n) => level(n.id) > 0 && isSynergyId(n.id))
    .map((n) => n.id as SynergyId);

  // ── 살림 ──
  const eco = m.economy;
  eco.startTalisman = perLevel('generousStart', 'startCharm');
  eco.maxTalismanBonus = perLevel('charmPouch', 'maxCharm');
  eco.chargePerSecBonus = perLevel('qiCycle', 'chargePerSec');
  eco.gatherCostMultiplier = 1 - perLevel('thriftyLiving', 'costReduction');
  if (level('spoils') > 0) eco.killTalismanMultiplier += param('spoils', 'killCharmBonus');
  if (level('bigEconomy') > 0) eco.gatherMaxLevel = param('bigEconomy', 'maxLevel');
  if (level('spiritCharm') > 0) {
    eco.spiritPerCharm = { unit: param('spiritCharm', 'charmUnit'), spirit: param('spiritCharm', 'spirit') };
  }
  return m;
}

/**
 * 확인용 URL ?upg=id1,id2:3,... 를 레벨 표로 바꾼다.
 * 레벨을 생략하면 최대 레벨, 알 수 없는 id·잘못된 레벨은 무시한다. 신명·규칙은 보지 않는다.
 */
export function parseUpgradeQuery(value: string | null): BuildLevels {
  const levels: BuildLevels = {};
  if (!value) return levels;
  for (const part of value.split(',')) {
    const [id, lvText] = part.trim().split(':');
    const node = getUpgradeNode(id);
    if (!node) continue;
    const lv = lvText === undefined || lvText === '' ? node.maxLevel : Number(lvText);
    if (Number.isInteger(lv) && lv > 0) levels[id] = Math.min(lv, node.maxLevel);
  }
  return levels;
}
