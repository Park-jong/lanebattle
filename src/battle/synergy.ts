import { SYNERGY, type SynergyId } from '../data/synergy';
import type { Tag } from '../data/types';
import type { AttackInfo } from './damage';
import type { Body, Fighter } from './entities';
import type { BuffEffect } from './status';

const COUNTED_TAGS: readonly Tag[] = ['dokkaebi', 'fire', 'divine', 'wind'];

/** 화상 부여에 대한 연계 보정 */
export interface BurnModifier {
  multiplier: number;
  maxStacks: number | undefined;
}

/**
 * 연계 엔진: 켜진 연계의 조건을 매 틱 판정해 아군에게 효과를 건다.
 * 버프형 효과는 오라 효과로 걸리므로 버프 해제 중인 대상에게는 적용되지 않고,
 * 조건이 깨지면 다음 틱에 저절로 사라진다. 공격에 붙는 효과는 질의 메서드로 제공한다.
 */
export class SynergyEngine {
  private readonly enabledIds: ReadonlySet<SynergyId>;
  private readonly counts = new Map<Tag, number>();
  /** 연계 전체를 끄는 스위치 (차사왕의 연계 무효용) */
  suppressed = false;

  constructor(enabled: Iterable<SynergyId> = []) {
    this.enabledIds = new Set(enabled);
  }

  /** 켜져 있고 전체 스위치로 꺼지지 않았는지 (조건은 보지 않는다) */
  isEnabled(id: SynergyId): boolean {
    return !this.suppressed && this.enabledIds.has(id);
  }

  /** 마지막 틱 기준 태그 수 */
  tagCount(tag: Tag): number {
    return this.counts.get(tag) ?? 0;
  }

  /** 켜져 있고 조건도 충족한 연계 ID (HUD 표시용) */
  activeIds(): SynergyId[] {
    return [...this.enabledIds].filter((id) => this.isEnabled(id) && this.conditionMet(id));
  }

  // ----- 매 틱 -----

  update(allies: readonly Fighter[], hero: Body | null, dt: number): void {
    const units = allies.filter((a) => a.alive);
    this.countTags(units);
    const usable = (b: Body) => !b.status!.buffsDisabled;
    // 수호 오라의 소유자가 버프 해제 중이면 오라를 내보내지 않는다
    const divine = units.filter((u) => u.stats.tags.includes(SYNERGY.divineBlessing.guardianTag) && usable(u));
    const nearDivine = (b: Body, radius: number) => divine.some((d) => Math.abs(d.x - b.x) <= radius);

    for (const u of units) {
      const effect = this.unitEffect(u, units);
      if (hasEffect(effect)) u.status!.addAuraEffect(effect); // 해제 중이면 거부된다

      const blessing = SYNERGY.divineBlessing;
      if (u.stats.tags.includes(blessing.targetTag)) {
        const on = this.isEnabled('divineBlessing') && usable(u) && nearDivine(u, blessing.radius);
        u.setMaxHpBonus(on ? blessing.maxHpBonus : 0);
      }
    }
    if (hero?.alive) {
      const effect = this.hundredDemonsEffect();
      if (effect) hero.status!.addAuraEffect(effect);
    }

    if (this.isEnabled('guardianVowII')) {
      const vow = SYNERGY.guardianVowII;
      const targets: Body[] = hero?.alive ? [...units, hero] : [...units];
      for (const b of targets) {
        if (usable(b) && nearDivine(b, vow.radius)) b.heal(b.maxHp * vow.healPerSec * dt);
      }
    }
  }

  private countTags(units: readonly Fighter[]): void {
    this.counts.clear();
    const link = this.isEnabled('linkRing');
    for (const u of units) {
      const tags = u.stats.tags.filter((t) => COUNTED_TAGS.includes(t));
      const weight = link && tags.length >= 2 ? SYNERGY.linkRing.dualTagCount : 1;
      for (const t of tags) this.counts.set(t, this.tagCount(t) + weight);
    }
  }

  /** 아군 유닛 하나가 받는 버프형 연계 효과의 합 */
  private unitEffect(u: Fighter, units: readonly Fighter[]): BuffEffect {
    const fx: BuffEffect = {};
    const add = (v: BuffEffect) => {
      for (const k of ['attack', 'moveSpeed', 'attackSpeed', 'damageReduction'] as const) {
        if (v[k]) fx[k] = (fx[k] ?? 0) + v[k];
      }
    };
    const has = (t: Tag) => u.stats.tags.includes(t);
    const counted = (id: 'dokkaebiGatheringI' | 'dokkaebiGatheringII' | 'guardianVowI' | 'tailwindI') =>
      this.isEnabled(id) && has(SYNERGY[id].tag) && this.tagCount(SYNERGY[id].tag) >= SYNERGY[id].minCount;

    if (counted('dokkaebiGatheringI')) add({ attackSpeed: SYNERGY.dokkaebiGatheringI.attackSpeed });
    if (counted('dokkaebiGatheringII')) add({ attack: SYNERGY.dokkaebiGatheringII.attack });
    if (counted('guardianVowI')) add({ damageReduction: SYNERGY.guardianVowI.damageReduction });
    if (counted('tailwindI')) {
      add({ moveSpeed: SYNERGY.tailwindI.moveSpeed, attackSpeed: SYNERGY.tailwindI.attackSpeed });
    }
    if (this.isEnabled('guardFormation') && u.stats.attackType !== 'melee') {
      const ff = SYNERGY.guardFormation;
      if (units.some((g) => g.defId === ff.guardianId && g.x > u.x && !g.status!.buffsDisabled)) add({ damageReduction: ff.damageReduction });
    }
    add(this.hundredDemonsEffect() ?? {});
    return fx;
  }

  private hundredDemonsEffect(): BuffEffect | null {
    if (!this.isEnabled('hundredDemons') || !this.conditionMet('hundredDemons')) return null;
    const hd = SYNERGY.hundredDemons;
    return { attack: hd.attack, damageReduction: hd.damageReduction };
  }

  private conditionMet(id: SynergyId): boolean {
    const d = SYNERGY[id];
    if ('requiredTags' in d) return d.requiredTags.every((t) => this.tagCount(t) >= 1);
    if ('minCount' in d) return this.tagCount(d.tag) >= d.minCount;
    return true;
  }

  // ----- 공격에 붙는 효과 (공격자가 버프 해제 중이면 적용하지 않는다) -----

  private usable(info: AttackInfo, id: SynergyId, attackerDispelled: boolean): boolean {
    return info.source === 'ally' && !attackerDispelled && this.isEnabled(id);
  }

  /** 불씨 Ⅰ·Ⅱ: 화상 피해 배율과 최대 중첩 */
  burnModifier(info: AttackInfo, attackerDispelled: boolean): BurnModifier {
    const one = this.usable(info, 'emberI', attackerDispelled);
    const two = this.usable(info, 'emberII', attackerDispelled);
    return {
      multiplier: one ? 1 + SYNERGY.emberI.burnDamageBonus : 1,
      maxStacks: two ? SYNERGY.emberII.burnMaxStacks : undefined,
    };
  }

  /** 도깨비불: 화상 걸린 적을 도깨비가 치면 피해 배율 */
  hitMultiplier(info: AttackInfo, attackerDispelled: boolean, targetBurning: boolean): number {
    const f = SYNERGY.dokkaebiFire;
    if (targetBurning && info.tags.includes(f.tag) && this.usable(info, 'dokkaebiFire', attackerDispelled)) {
      return f.damageMultiplier;
    }
    return 1;
  }

  /** 순풍 Ⅱ: 바람 유닛 공격이 거는 감속 */
  hitSlow(info: AttackInfo, attackerDispelled: boolean): { ratio: number; duration: number } | null {
    const t = SYNERGY.tailwindII;
    if (!info.tags.includes(t.tag) || !this.usable(info, 'tailwindII', attackerDispelled)) return null;
    return { ratio: t.slowRatio, duration: t.slowDuration };
  }

  /** 불바람: 바람 유닛이 화상 걸린 적을 쳤을 때 화상이 번지는 반경 (0이면 없음) */
  spreadRadius(info: AttackInfo, attackerDispelled: boolean, targetBurning: boolean): number {
    const f = SYNERGY.fireWind;
    if (targetBurning && info.tags.includes(f.tag) && this.usable(info, 'fireWind', attackerDispelled)) {
      return f.radius;
    }
    return 0;
  }
}

function hasEffect(e: BuffEffect): boolean {
  return Object.values(e).some((v) => v);
}
