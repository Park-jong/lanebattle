import { getAbility, type AbilityDef, type BuffValues } from '../data/abilities';
import { HERO } from '../data/hero';
import { NEAREST_REACH, type PossessionArea, type PossessionEffect, type PossessionHitEffects, type PossessionSkillDef } from '../data/possession';
import { STATUS } from '../data/status';
import type { AllyDef, AttackType, Tag } from '../data/types';
import type { AttackInfo } from './damage';
import type { Base, Body, Fighter } from './entities';
import type { Hero } from './hero';
import type { SkillCastEvent } from './skills';

// ----- 변신: 기본 공격 -----

/** 빙의한 영웅의 기본 공격 방식 (numbers.md 10장). 공격력·간격은 영웅 값이라 여기에 없다 */
export interface HeroForm {
  unitId: string;
  name: string;
  /** 영웅 태그 + 그 유닛의 태그 */
  tags: Tag[];
  unitTags: Tag[];
  attackType: AttackType;
  /** 기본 공격 사거리: 근접이면 영웅 사거리, 원거리·마법이면 유닛 사거리 */
  range: number;
  /** 화상 초당 피해 (불 태그 유닛만, 업그레이드 반영) */
  burnPerSec: number;
  /** 마법 범위 반경 (업그레이드 반영, 없으면 0) */
  areaRadius: number;
  /** 방어 파괴를 거는 공격 (불가사리). maxStacks는 ② 반영 */
  defenseBreak: { maxStacks?: number } | null;
  /** 비행 적에게 주는 피해 배율 (까치 떼, 업그레이드 미반영). 1이면 없음 */
  flyingMultiplier: number;
}

/**
 * 업그레이드를 반영한 유닛 정의·능력으로 변신 형태를 만든다.
 * 고유 능력 중 방어 파괴·비행 배율만 가져오고 나머지(돌격·메치기·붙잡기·오라 등)는 붙이지 않는다.
 */
export function buildHeroForm(def: AllyDef, upgradedAbility: AbilityDef): HeroForm {
  const melee = def.attackType === 'melee';
  const vs = getAbility(def.id).vsTrait;
  return {
    unitId: def.id,
    name: def.name,
    tags: ['hero', ...def.tags],
    unitTags: [...def.tags],
    attackType: def.attackType,
    range: melee ? HERO.attack.range : def.range,
    burnPerSec: def.tags.includes('fire') ? (def.burnPerSec ?? 0) : 0,
    areaRadius: def.attackType === 'magic' ? (def.areaRadius ?? 0) : 0,
    defenseBreak: upgradedAbility.onHit?.defenseBreak ? { maxStacks: upgradedAbility.onHit.defenseBreakMaxStacks } : null,
    flyingMultiplier: vs?.trait === 'flying' ? vs.multiplier : 1,
  };
}

// ----- 빙의 스킬: 기본 동작 실행 -----

/** 스킬 실행기가 전투에 요청하는 일 (Battle이 구현한다) */
export interface PossessionHost {
  readonly hero: Hero;
  readonly shrine: Base;
  readonly castle: Base;
  readonly enemies: readonly Fighter[];
  readonly allies: readonly Fighter[];
  dealFixedDamage(target: Body, base: number, info: AttackInfo): void;
  applyBurn(target: Body, dps: number): void;
  applyStun(target: Body, duration: number): void;
  applySlow(target: Body, ratio: number, duration: number): void;
  applyDefenseBreak(target: Body): void;
  knockback(target: Body, distance: number): void;
  /** 밀려난 적(원래 자리 from)이 길 위의 다른 적과 부딪혀 둘 다 고정 피해 */
  collideEnemies(thrown: Body, from: number, damage: number, info: AttackInfo, collided?: Set<Body>): void;
  addBuff(target: Body, effect: BuffValues, duration: number): boolean;
  /** 아군 상한을 지켜 무료로 소환하고 실제 소환 수를 돌려준다 */
  spawnFreeAllies(unitId: string, count: number): number;
  addTimedAura(radius: number, effect: BuffValues, duration: number, missChance?: number): void;
  healShrine(amount: number): void;
  schedule(delay: number, run: () => void): void;
}

export type CastShape = Pick<SkillCastEvent, 'x' | 'range' | 'shape'>;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * 빙의 스킬 한 개를 기본 동작(범위 피해·돌진·연속 타격·소환·버프·오라 등)의 조합으로 실행한다.
 * 피해는 고정 수치: 공격력 버프·연계는 거치지 않고 피해 계산 함수만 거친다.
 */
export class PossessionSkillRunner {
  /** tags: 영웅 태그 + 유닛 태그 (공격 정보와 면역·화상 판정에 쓴다) */
  constructor(private readonly host: PossessionHost, private readonly tags: readonly Tag[]) {}

  /** 스킬을 실행하고 화면 이펙트용 모양을 돌려준다 (돌진이면 출발 지점 기준) */
  run(skill: PossessionSkillDef): CastShape {
    const shape = this.shapeOf(skill);
    for (const effect of skill.effects) this.runEffect(effect);
    return shape;
  }

  private runEffect(effect: PossessionEffect): void {
    const host = this.host;
    switch (effect.kind) {
      case 'hit':
        this.hitArea(effect.area, effect);
        break;
      case 'charge':
        this.charge(effect.distance, effect.hit);
        break;
      case 'repeat':
        this.hitArea(effect.hit.area, effect.hit);
        for (let i = 1; i < effect.times; i++) {
          host.schedule(effect.interval * i, () => {
            if (host.hero.alive) this.hitArea(effect.hit.area, effect.hit);
          });
        }
        break;
      case 'summon':
        host.spawnFreeAllies(effect.unitId, effect.count);
        break;
      case 'buff':
        this.buff(effect);
        break;
      case 'aura':
        host.addTimedAura(effect.radius, effect.effect, effect.duration, effect.missChance);
        break;
      case 'shrineHeal':
        host.healShrine(host.shrine.maxHp * effect.ratio);
        break;
    }
  }

  // ----- 모양 -----

  private shapeOf(skill: PossessionSkillDef): CastShape {
    const hero = this.host.hero;
    for (const e of skill.effects) {
      const area = e.kind === 'hit' ? e.area : e.kind === 'repeat' ? e.hit.area : null;
      if (area) return this.areaShape(area);
      if (e.kind === 'charge') return { x: hero.x, range: e.distance, shape: 'fan' };
      if (e.kind === 'buff' && e.radius) return { x: hero.x, range: e.radius, shape: 'circle' };
      if (e.kind === 'aura') return { x: hero.x, range: e.radius, shape: 'circle' };
    }
    return { x: hero.x, range: 60, shape: 'circle' };
  }

  private areaShape(area: PossessionArea): CastShape {
    const hero = this.host.hero;
    switch (area.kind) {
      case 'front':
        return { x: hero.x, range: area.range, shape: 'fan' };
      case 'radius':
        return { x: hero.x, range: area.radius, shape: 'circle' };
      case 'nearest':
        return { x: hero.x, range: NEAREST_REACH, shape: 'circle' };
      case 'point':
        return { x: this.pointX(area.ahead), range: area.radius, shape: 'circle' };
      case 'nearestPoint': {
        const nearest = this.nearest(1, false)[0];
        return { x: nearest ? nearest.x : hero.x, range: area.radius, shape: 'circle' };
      }
    }
  }

  // ----- 대상 고르기 -----

  private pointX(ahead: number): number {
    const { hero, shrine, castle } = this.host;
    return clamp(hero.x + hero.facing * ahead, shrine.x, castle.x);
  }

  /** 살아 있는 적 중 영웅에게서 가까운 순으로 count명 (NEAREST_REACH 안). 근접이면 비행 제외 */
  private nearest(count: number, melee: boolean): Fighter[] {
    return this.sorted(this.candidates(melee).filter((e) => this.gap(e) <= NEAREST_REACH)).slice(0, count);
  }

  private candidates(melee: boolean): Fighter[] {
    return this.host.enemies.filter((e) => e.alive && !(melee && e.flying));
  }

  /** 영웅과 몸 가장자리 사이 거리 */
  private gap(e: Body): number {
    return Math.abs(e.x - this.host.hero.x) - e.radius;
  }

  private sorted(list: Fighter[]): Fighter[] {
    const x = this.host.hero.x;
    return [...list].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
  }

  private select(area: PossessionArea, type: AttackType): Fighter[] {
    const { hero } = this.host;
    const pool = this.candidates(type === 'melee');
    const around = (cx: number, radius: number) => pool.filter((e) => Math.abs(e.x - cx) - e.radius <= radius);
    switch (area.kind) {
      case 'front': {
        const inFront = pool.filter((e) => {
          const ahead = (e.x - hero.x) * hero.facing;
          return ahead >= 0 && ahead - e.radius <= area.range;
        });
        return this.sorted(inFront).slice(0, area.limit ?? Infinity);
      }
      case 'radius':
        return this.sorted(around(hero.x, area.radius)).slice(0, area.limit ?? Infinity);
      case 'nearest':
        return this.nearest(area.count, type === 'melee');
      case 'point':
        return around(this.pointX(area.ahead), area.radius);
      case 'nearestPoint': {
        const target = this.nearest(1, type === 'melee')[0];
        return target ? around(target.x, area.radius) : [];
      }
    }
  }

  // ----- 동작 -----

  private hitArea(area: PossessionArea, effects: PossessionHitEffects): void {
    const targets = this.select(area, effects.type).filter((e) => !effects.flyingOnly || e.flying);
    this.applyHit(targets, effects);
  }

  /** 돌진: 영웅이 앞으로 이동(서낭당~성 사이로 제한)하고, 출발점부터 도착점까지 길 위의 땅 위 적을 친다 */
  private charge(distance: number, effects: PossessionHitEffects): void {
    const { hero, shrine, castle } = this.host;
    const startX = hero.x;
    const dir = hero.facing;
    hero.x = clamp(startX + dir * distance, shrine.x, castle.x);
    const moved = (hero.x - startX) * dir;
    const onPath = this.candidates(true).filter((e) => {
      const ahead = (e.x - startX) * dir;
      return ahead >= 0 && ahead - e.radius <= moved;
    });
    this.applyHit(this.sorted(onPath), effects);
  }

  /** 대상마다 피해와 상태 효과를 건다. 태그 면역인 대상은 피해 0이고 상태 효과도 걸리지 않는다 */
  private applyHit(targets: Fighter[], fx: PossessionHitEffects): void {
    const host = this.host;
    const info: AttackInfo = { type: fx.type, tags: this.tags, source: 'hero', defenseBreak: fx.defenseBreak ? true : undefined };
    const burning = this.tags.includes('fire') && (fx.burnPerSec ?? 0) > 0;
    let kills = 0;
    const collided = new Set<Body>(); // 충돌 피해는 시전 한 번에 적마다 한 번만
    for (const t of targets) {
      if (!t.alive) continue;
      if (fx.damage) {
        host.dealFixedDamage(t, fx.damage * (t.flying ? (fx.flyingMultiplier ?? 1) : 1), info);
        if (!t.alive) kills++;
      }
      if (!t.alive || t.isImmuneTo(this.tags)) continue;
      if (burning) host.applyBurn(t, fx.burnPerSec!);
      if (fx.stun) host.applyStun(t, fx.stun);
      if (fx.slow) host.applySlow(t, fx.slow.ratio, fx.slow.duration);
      if (fx.defenseBreak) {
        const stacks = fx.defenseBreak === 'max' ? STATUS.defenseBreak.maxStacks : fx.defenseBreak;
        for (let i = 0; i < stacks; i++) host.applyDefenseBreak(t);
      }
      if (fx.knockback) {
        const from = t.x;
        host.knockback(t, fx.knockback);
        if (fx.collision) host.collideEnemies(t, from, fx.collision, info, collided);
      }
    }
    if (fx.healOnKill && kills > 0) host.hero.heal(host.hero.maxHp * fx.healOnKill * kills);
  }

  /** 시간제 버프: 영웅은 항상, 아군은 태그·반경 조건에 맞는 것만. 버프 해제 중인 대상에게는 걸리지 않는다. 영웅은 heroEffect가 있으면 그것만 받는다 */
  private buff(effect: Extract<PossessionEffect, { kind: 'buff' }>): void {
    const { hero, allies } = this.host;
    const receivers: Body[] = allies.filter((a) => {
      if (!a.alive) return false;
      if (effect.tag && !a.stats.tags.includes(effect.tag)) return false;
      return effect.radius === undefined || Math.abs(a.x - hero.x) - a.radius <= effect.radius;
    });
    if (hero.alive) receivers.push(hero);
    for (const r of receivers) this.host.addBuff(r, r === hero ? (effect.heroEffect ?? effect.effect) : effect.effect, effect.duration);
  }
}
