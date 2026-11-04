// 소환 버튼(아군 유닛) 툴팁 문구 (Phaser에 의존하지 않는다)
import { getAbility, type AbilityDef, type BuffValues } from '../data/abilities';
import { getAllyDef } from '../data/allies';
import { STATUS } from '../data/status';
import type { AllyDef, AttackType, EnemyTrait, Tag } from '../data/types';
import { upgradeAbility, upgradeAllyDef } from '../battle/unitUpgrades';
import type { BattleModifiers, UnitModifiers } from '../battle/modifiers';
import { fmt, pct, type TooltipStatus, type TooltipText } from './tooltipText';

const TAG_NAMES: Record<Tag, string> = { dokkaebi: '도깨비', fire: '불', divine: '신수', wind: '바람', hero: '영웅' };
const TYPE_NAMES: Record<AttackType, string> = { melee: '근접', ranged: '원거리', magic: '마법' };
const TRAIT_NAMES: Record<EnemyTrait, string> = { swarm: '무리', ghost: '영체', armor: '갑옷', flying: '비행' };

function buffText(effect: BuffValues): string {
  const parts: string[] = [];
  if (effect.attack) parts.push(`공격력 +${pct(effect.attack)}`);
  if (effect.moveSpeed) parts.push(`이동 속도 +${pct(effect.moveSpeed)}`);
  if (effect.attackSpeed) parts.push(`공격 속도 +${pct(effect.attackSpeed)}`);
  if (effect.damageReduction) parts.push(`받는 피해 -${pct(effect.damageReduction)}`);
  return parts.join(', ');
}

/** 고유 능력 구조를 문구 줄로 바꾼다. 업그레이드가 반영된 AbilityDef를 넣으면 실제 값이 나온다 */
export function abilityLines(def: AllyDef, a: AbilityDef): string[] {
  const out: string[] = [];
  if (a.firstStrikeMultiplier) out.push(`돌격: 소환 후 첫 공격 피해 x${fmt(a.firstStrikeMultiplier)}`);
  if (a.pierce) out.push(`관통: 첫 공격이 길 위의 적 모두를 침 (대상 뒤 ${fmt(a.pierce.pathExtra)})`);
  if (a.nthStrike) {
    const n = a.nthStrike;
    const hit = n.collisionDamage ? `, 부딪힌 적 둘 다 피해 ${fmt(n.collisionDamage)}` : '';
    out.push(`메치기: ${n.every}번째 공격마다 넉백 ${fmt(n.knockback)} + 기절 ${fmt(n.stun)}초${hit}`);
  }
  if (a.grab) out.push(`붙잡기: ${fmt(a.grab.interval)}초마다 앞의 적 하나를 ${fmt(a.grab.duration)}초 붙잡음`);
  if (a.aura) out.push(`오라(반경 ${fmt(a.aura.radius)}): 아군 ${buffText(a.aura.effect)}`);
  if (a.missAura) {
    const back = a.missAura.reflect ? ', 빗나간 투사체는 되돌아감' : '';
    out.push(`반경 ${fmt(a.missAura.radius)} 아군을 노리는 적 투사체 ${pct(a.missAura.chance)} 빗나감${back}`);
  }
  if (a.vsTrait) {
    const v = a.vsTrait;
    const stagger = v.stagger ? `, 맞으면 ${fmt(v.stagger)}초 경직` : '';
    out.push(`${TRAIT_NAMES[v.trait]} 적에게 피해 x${fmt(v.multiplier)}${stagger}`);
  }
  if (a.onHit?.defenseBreak) {
    const max = a.onHit.defenseBreakMaxStacks ?? STATUS.defenseBreak.maxStacks;
    out.push(`공격마다 방어 파괴 1중첩 (최대 ${max}중첩, 중첩당 받는 피해 +${pct(STATUS.defenseBreak.damagePerStack)})`);
  }
  if (def.burnPerSec) out.push(`화상 초당 ${fmt(def.burnPerSec)}`);
  if (def.areaRadius) out.push(`대상 주변 반경 ${fmt(def.areaRadius)} 범위 피해`);
  if (a.multiTarget) out.push(`한 번에 서로 다른 ${a.multiTarget}명을 공격`);
  if (a.salvo) out.push(`한 번 공격에 ${a.salvo.shots}연발 (${fmt(a.salvo.interval)}초 간격)`);
  if (a.killSpawn) out.push(`적 처치 시 ${pct(a.killSpawn.chance)} 확률로 같은 유닛 ${a.killSpawn.count}마리 추가 소환`);
  if (a.armorKill) {
    out.push(`갑옷 적 처치 시 체력 ${pct(a.armorKill.healRatio)} 회복, 그 판 동안 공격력 +${pct(a.armorKill.attackPerStack)} 중첩`);
  }
  if (a.sunFlame) out.push(`${fmt(a.sunFlame.interval)}초마다 반경 ${fmt(a.sunFlame.radius)} 적 전체에 화상`);
  return out;
}

/** 찍힌 강화 단계 표시: ①②③ */
function upgradeMarks(m: UnitModifiers | undefined): string {
  if (!m) return '';
  let marks = '';
  if (m.hpMultiplier > 1 || m.attackMultiplier > 1) marks += '①';
  if (m.core) marks += '②';
  if (m.awaken) marks += '③';
  return marks;
}

/**
 * 소환 버튼 툴팁. key는 이 버튼의 키 글자(소환 순서 반영, 예: "1")
 */
export function describeUnit(allyId: string, mods: BattleModifiers, key: string): TooltipText {
  const unitMods = mods.units[allyId];
  const def = upgradeAllyDef(getAllyDef(allyId), unitMods);
  const ability = upgradeAbility(getAbility(allyId), allyId, unitMods);
  // 각성만 빼고 계산해, 각성으로 새로 생긴 줄을 구분한다
  const withoutAwaken = unitMods ? { ...unitMods, awaken: null } : undefined;
  const baseLines = abilityLines(def, upgradeAbility(getAbility(allyId), allyId, withoutAwaken));
  const allLines = abilityLines(def, ability);

  const lines: string[] = [];
  const kind = [def.tags.map((t) => TAG_NAMES[t]).join('·'), TYPE_NAMES[def.attackType], def.flying ? '비행' : ''];
  lines.push(kind.filter(Boolean).join(' / '));
  const group = def.summonCount && def.summonCount > 1 ? ` (한 번에 ${def.summonCount}무리)` : '';
  lines.push(`부적 ${def.cost} / 쿨타임 ${fmt(def.cooldown)}초${group}`);
  lines.push(`체력 ${fmt(def.maxHp)} / 공격력 ${fmt(def.attack)} / 공격 간격 ${fmt(def.attackInterval)}초`);
  lines.push(`사거리 ${fmt(def.range)} / 이동 속도 ${fmt(def.speed)}`);
  const body = allLines.map((l) => (baseLines.includes(l) ? l : `각성: ${l}`));
  lines.push(...(body.length > 0 ? body : ['고유 능력 없음']));
  const marks = upgradeMarks(unitMods);
  if (marks) lines.push(`강화: ${marks}`);
  return { title: `${def.name} (${key})`, lines };
}

/** 소환 상태 판정에 필요한 현재 값 */
export interface SummonStatusInput {
  allyCount: number;
  maxAllies: number;
  /** 남은 쿨타임(초) */
  cooldown: number;
  talisman: number;
  cost: number;
}

/** Battle.summon 실패 판정과 같은 순서: 아군 상한 -> 쿨타임 -> 부적 */
export function summonStatus(input: SummonStatusInput): TooltipStatus {
  if (input.allyCount >= input.maxAllies) return { text: `아군 최대(${input.maxAllies})`, ok: false };
  if (input.cooldown > 0) return { text: `쿨타임 ${input.cooldown.toFixed(1)}초`, ok: false };
  if (input.talisman < input.cost) {
    return { text: `부적 부족 (현재 ${Math.floor(input.talisman)}/필요 ${input.cost})`, ok: false };
  }
  return { text: '소환 가능', ok: true };
}
