import { computeBuildEffects } from '../../game/buildEffects';
import type { BattleModifiers } from '../../battle/modifiers';
import type { UpgradeNode } from '../../data/upgrades';

const METRICS: Record<string, { label: string; read: (m: BattleModifiers) => number; percent?: boolean; negative?: boolean; unit?: string }> = {
  bellTraining: { label: '공격력', read: m => m.hero.attackMultiplier - 1, percent: true },
  sturdyBody: { label: '최대 체력', read: m => m.hero.hpMultiplier - 1, percent: true },
  quickRevive: { label: '부활 시간', read: m => m.hero.reviveReduction, negative: true, unit: '초' },
  spiritSpring: { label: '신력 충전', read: m => m.hero.spiritChargeMultiplier - 1, percent: true },
  generousStart: { label: '시작 부적', read: m => m.economy.startTalisman },
  charmPouch: { label: '부적 한도', read: m => m.economy.maxTalismanBonus },
  qiCycle: { label: '부적 충전', read: m => m.economy.chargePerSecBonus, unit: '/초' },
  thriftyLiving: { label: '기운 모으기 비용', read: m => 1 - m.economy.gatherCostMultiplier, negative: true, percent: true },
};

/** Use the combat modifier calculation itself for the cumulative current/next preview. */
export function levelEffectPreview(node: UpgradeNode, level: number): string | null {
  const metric = METRICS[node.id];
  if (!metric || node.maxLevel <= 1) return null;
  const current = Math.max(0, Math.min(node.maxLevel, Math.floor(level)));
  const format = (lv: number) => {
    const value = metric.read(computeBuildEffects({ [node.id]: lv }));
    const shown = Number((value * (metric.percent ? 100 : 1)).toFixed(1));
    return `${metric.negative ? '−' : '+'}${shown}${metric.percent ? '%' : metric.unit ?? ''}`;
  };
  return `${metric.label}  ${format(current)}${current < node.maxLevel ? ` → ${format(current + 1)}` : ' · 최대'}`;
}
