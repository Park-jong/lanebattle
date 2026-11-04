// 영웅 스킬 툴팁 문구 (Phaser에 의존하지 않는다). 수치는 data/skills.ts와 BattleModifiers에서 계산한다
import { getSkill, SKILL_EFFECTS, type SkillId } from '../data/skills';
import { getUpgradeNode } from '../data/upgrades';
import type { BattleModifiers } from '../battle/modifiers';
import { fmt, pct, type TooltipStatus, type TooltipText } from './tooltipText';

/** 스킬 키 글자 (KEY_MAP.skills 순서와 같다) */
const SKILL_KEYS: Record<SkillId, string> = { fanWind: 'Q', blessing: 'W', bladeDance: 'E' };

/** 업그레이드를 반영한 쿨타임(초). Battle.skillCooldownMax와 같은 식 */
export function skillCooldownOf(id: SkillId, mods: BattleModifiers): number {
  const base = getSkill(id).cooldown;
  return id === 'bladeDance' ? base * mods.skills.bladeDance.cooldownMultiplier : base;
}

/** 고른 갈래의 노드 id (없으면 null). 갈래는 스킬마다 하나만 고를 수 있다 */
function branchNodeId(id: SkillId, mods: BattleModifiers): string | null {
  const s = mods.skills;
  if (id === 'fanWind') {
    if (s.fanWind.rangeMultiplier > 1) return 'fanWindTornado';
    if (s.fanWind.damageMultiplier > 1 || s.fanWind.knockbackMultiplier > 1) return 'fanWindGust';
  } else if (id === 'blessing') {
    if (s.blessing.healRatio !== SKILL_EFFECTS.blessing.healRatio || s.blessing.rangeMultiplier > 1) return 'blessingGrandRite';
    if (s.blessing.attackBonus > SKILL_EFFECTS.blessing.attackBonus) return 'blessingSpiritRelease';
  } else {
    if (s.bladeDance.extraDuration > 0) return 'bladeDanceBlades';
    if (s.bladeDance.cooldownMultiplier < 1) return 'bladeDancePossession';
  }
  return null;
}

/** "부채 바람: 회오리" -> "회오리" */
function branchName(nodeId: string): string {
  const name = getUpgradeNode(nodeId)?.name ?? nodeId;
  return name.includes(': ') ? name.split(': ')[1] : name;
}

function effectLines(id: SkillId, mods: BattleModifiers): string[] {
  const fx = SKILL_EFFECTS;
  const m = mods.skills;
  if (id === 'fanWind') {
    return [
      `앞쪽 범위 ${fmt(fx.fanWind.range * m.fanWind.rangeMultiplier)}`,
      `피해 ${fmt(fx.fanWind.damage * m.fanWind.damageMultiplier)}, 넉백 ${fmt(fx.fanWind.knockback * m.fanWind.knockbackMultiplier)}`,
    ];
  }
  if (id === 'blessing') {
    return [
      `반경 ${fmt(fx.blessing.radius * m.blessing.rangeMultiplier)}, 최대 체력 ${pct(m.blessing.healRatio)} 회복`,
      `공격력 +${pct(m.blessing.attackBonus)}(${fmt(fx.blessing.duration)}초)`,
    ];
  }
  const lines = [`반경 ${fmt(fx.bladeDance.radius)}, 피해 ${fmt(fx.bladeDance.damage)}, 기절 ${fmt(fx.bladeDance.stun)}초`];
  if (m.bladeDance.extraDuration > 0) {
    lines.push(`${fmt(m.bladeDance.extraDuration)}초간 초당 ${fmt(m.bladeDance.extraDamagePerSec)} 추가 피해`);
  }
  return lines;
}

const RULES: Record<SkillId, string> = {
  fanWind: '피해는 고정 수치(공격력·연계 미적용)이고 비행 적도 맞습니다. 보스는 밀리지 않습니다.',
  blessing: '회복 차단 중인 대상은 회복되지 않고, 버프 해제 중에는 버프가 적용되지 않습니다.',
  bladeDance: '피해는 고정 수치(공격력·연계 미적용)입니다. 보스는 기절 대신 경직만 걸립니다.',
};

export function describeSkill(id: SkillId, mods: BattleModifiers): TooltipText {
  const def = getSkill(id);
  const lines = [`신력 ${def.spiritCost} / 쿨타임 ${fmt(skillCooldownOf(id, mods))}초`, ...effectLines(id, mods)];
  const branch = branchNodeId(id, mods);
  if (branch) lines.push(`갈래: ${branchName(branch)}`);
  lines.push(RULES[id]);
  return { title: `${def.name} (${SKILL_KEYS[id]})`, lines };
}

/** 스킬 상태 판정에 필요한 현재 값 */
export interface SkillStatusInput {
  heroAlive: boolean;
  stunned: boolean;
  /** 남은 쿨타임(초) */
  cooldown: number;
  spirit: number;
  spiritCost: number;
}

/** Battle.castSkill 실패 판정과 같은 순서: 사망 -> 기절 -> 쿨타임 -> 신력 */
export function skillStatus(input: SkillStatusInput): TooltipStatus {
  if (!input.heroAlive) return { text: '영웅 부활 중', ok: false };
  if (input.stunned) return { text: '기절 중', ok: false };
  if (input.cooldown > 0) return { text: `쿨타임 ${input.cooldown.toFixed(1)}초`, ok: false };
  if (input.spirit < input.spiritCost) {
    return { text: `신력 부족 (현재 ${Math.floor(input.spirit)}/필요 ${input.spiritCost})`, ok: false };
  }
  return { text: '사용 가능', ok: true };
}
