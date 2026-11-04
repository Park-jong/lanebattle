// 영웅 스킬 툴팁 문구 (Phaser에 의존하지 않는다). 수치는 data/skills.ts와 BattleModifiers에서 계산한다
import type { BuffValues } from '../data/abilities';
import { getAllyDef } from '../data/allies';
import {
  POSSESSION_COMMON, POSSESSION_TUNING, possessionSkillsOf, type PossessionArea, type PossessionEffect, type PossessionHitEffects,
} from '../data/possession';
import { getSkill, SKILL_EFFECTS, type SkillId } from '../data/skills';
import type { AttackType, Tag } from '../data/types';
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

// ----- 빙의 스킬: 효과 문구를 데이터(기본 동작 조합)에서 만든다 -----

const TAG_NAMES: Record<Tag, string> = { dokkaebi: '도깨비', fire: '불', divine: '신수', wind: '바람', hero: '영웅' };
const TYPE_NAMES: Record<AttackType, string> = { melee: '근접', ranged: '원거리', magic: '마법' };

function areaText(area: PossessionArea): string {
  switch (area.kind) {
    case 'front':
      return area.limit ? `앞쪽 ${fmt(area.range)} 범위 가까운 적 ${area.limit}명` : `앞쪽 ${fmt(area.range)} 범위 모든 적`;
    case 'radius':
      return area.limit ? `반경 ${fmt(area.radius)} 가까운 적 ${area.limit}명` : `반경 ${fmt(area.radius)} 적`;
    case 'nearest':
      return `가장 가까운 적 ${area.count}명`;
    case 'point':
      return `앞쪽 ${fmt(area.ahead)} 지점 반경 ${fmt(area.radius)} 적`;
    case 'nearestPoint':
      return `가장 가까운 적 위치 반경 ${fmt(area.radius)} 적`;
  }
}

/** 맞은 적에게 일어나는 일 (피해·화상·기절·넉백 ...) */
function hitText(fx: PossessionHitEffects): string {
  const parts: string[] = [];
  if (fx.damage) parts.push(`피해 ${fmt(fx.damage * POSSESSION_TUNING.damageMultiplier)}`);
  if (fx.burnPerSec) parts.push(`화상 초당 ${fmt(fx.burnPerSec * POSSESSION_TUNING.burnMultiplier)}`);
  if (fx.stun) parts.push(`기절·붙잡기 ${fmt(fx.stun)}초`);
  if (fx.knockback) parts.push(`넉백 ${fmt(fx.knockback)}`);
  if (fx.slow) parts.push(`감속 ${pct(fx.slow.ratio)} ${fmt(fx.slow.duration)}초`);
  if (fx.defenseBreak) parts.push(fx.defenseBreak === 'max' ? '방어 파괴 최대 중첩' : `방어 파괴 ${fx.defenseBreak}중첩`);
  if (fx.collision) parts.push(`밀려난 적이 부딪힌 적도 피해 ${fmt(fx.collision * POSSESSION_TUNING.damageMultiplier)}`);
  if (fx.healOnKill) parts.push(`처치 1마리당 체력 ${pct(fx.healOnKill)} 회복`);
  if (fx.flyingMultiplier) parts.push(`비행 적에게 ×${fmt(fx.flyingMultiplier)}`);
  return `${parts.join(' + ')} (${TYPE_NAMES[fx.type]})`;
}

function buffText(effect: BuffValues): string {
  const parts: string[] = [];
  if (effect.attack) parts.push(`공격력 +${pct(effect.attack)}`);
  if (effect.attackSpeed) parts.push(`공격 속도 +${pct(effect.attackSpeed)}`);
  if (effect.moveSpeed) parts.push(`이동 속도 +${pct(effect.moveSpeed)}`);
  if (effect.damageReduction) parts.push(`받는 피해 -${pct(effect.damageReduction)}`);
  return parts.join(', ');
}

function effectText(e: PossessionEffect): string {
  switch (e.kind) {
    case 'hit':
      return `${e.flyingOnly ? areaText(e.area).replace('적', '비행 적') : areaText(e.area)}: ${hitText(e)}`;
    case 'charge':
      return `앞으로 ${fmt(e.distance)} 돌진, 지나간 길의 적: ${hitText(e.hit)}`;
    case 'repeat': {
      const total = e.hit.damage ? ` (피해 총 ${fmt(e.hit.damage * POSSESSION_TUNING.damageMultiplier * e.times)})` : '';
      return `${fmt(e.interval)}초 간격 ${e.times}회, ${areaText(e.hit.area)}: ${hitText(e.hit)}${total}`;
    }
    case 'summon':
      return `${getAllyDef(e.unitId).name} ${e.count}마리 무료 소환 (아군 상한까지, 부적 미사용)`;
    case 'buff': {
      const who = e.tag ? `${TAG_NAMES[e.tag]} 아군과 영웅` : `반경 ${fmt(e.radius ?? 0)} 아군(영웅 포함)`;
      if (e.heroEffect) return `${fmt(e.duration)}초간 영웅 ${buffText(e.heroEffect)}, 반경 ${fmt(e.radius ?? 0)} 다른 아군 ${buffText(e.effect)}`;
      return `${fmt(e.duration)}초간 ${who} ${buffText(e.effect)}`;
    }
    case 'aura': {
      const miss = e.missChance ? `, 이 동안 반경 안 아군을 노리는 적 투사체 ${pct(e.missChance)} 빗나감` : '';
      return `${fmt(e.duration)}초간 반경 ${fmt(e.radius)} 아군(영웅 포함) ${buffText(e.effect)}${miss} 오라`;
    }
    case 'shrineHeal':
      return `서낭당 최대 체력 ${pct(e.ratio)} 회복`;
  }
}

/** 빙의 스킬 툴팁. 이름·비용·쿨타임·효과 문구를 데이터에서 만든다. 알 수 없는 유닛이면 null */
export function describePossessionSkill(unitId: string, id: SkillId): TooltipText | null {
  const set = possessionSkillsOf(unitId);
  if (!set) return null;
  const skill = set[id];
  const common = POSSESSION_COMMON[id];
  return {
    title: `${skill.name} (${SKILL_KEYS[id]})`,
    lines: [
      `빙의: ${getAllyDef(unitId).name}`,
      `신력 ${common.spiritCost} / 쿨타임 ${fmt(common.cooldown)}초`,
      ...skill.effects.map(effectText),
      '피해는 고정 수치(공격력·연계 미적용)입니다. 무당 스킬 갈래와 신내림은 적용되지 않고, 보스는 밀리지 않으며 기절 대신 경직만 걸립니다.',
    ],
  };
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
