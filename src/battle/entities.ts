import type { Affinity, AttackSource, AttackType, CombatStats, EnemyTrait, Tag, Team } from '../data/types';
import { COMBAT } from '../data/combat';
import type { DamageTarget } from './damage';
import { getAbility, type AbilityDef } from '../data/abilities';
import { AbilityState } from './abilities';
import { StatusSet } from './status';

export type BodyKind = 'unit' | 'hero' | 'base';

/** 피해를 받을 수 있는 모든 대상의 공통 부모 */
export abstract class Body {
  /** 표시 전용 상태. 전투 판정과 난수에는 영향을 주지 않는다. */
  visualMoving = false;
  visualAttack = 0;
  visualTargetX = 0;

  markAttack(targetX: number): void {
    this.visualAttack += 1;
    this.visualTargetX = targetX;
  }

  hp: number;
  /** 현재 최대 체력 (기본값 x (1 + 보너스)) */
  maxHp: number;
  /** 보너스 적용 전 최대 체력 */
  protected baseMaxHp: number;
  private maxHpBonus = 0;
  /** 상태 효과. 기지는 상태 효과를 받지 않으므로 null */
  readonly status: StatusSet | null;

  constructor(
    readonly kind: BodyKind,
    readonly team: Team,
    public x: number,
    maxHp: number,
    public radius: number,
  ) {
    this.maxHp = maxHp;
    this.baseMaxHp = maxHp;
    this.hp = maxHp;
    this.status = kind === 'base' ? null : new StatusSet();
  }

  /** 비행 여부 (근접 공격 대상 제외) */
  get flying(): boolean {
    return false;
  }

  get isBoss(): boolean {
    return false;
  }

  /** 상태 효과와 별개로 타고난 받는 피해 감소 (장승왕 갑옷) */
  get innateDamageReduction(): number {
    return 0;
  }

  get traits(): readonly EnemyTrait[] {
    return [];
  }

  get immuneTags(): readonly Tag[] {
    return [];
  }

  get weakness(): Affinity | undefined {
    return undefined;
  }

  get resistance(): Affinity | undefined {
    return undefined;
  }

  /** 이 공격 태그의 피해·상태를 무효화하는지 (강철이의 불) */
  isImmuneTo(_tags: readonly Tag[]): boolean {
    return false;
  }

  /** 최대 체력 보너스(0.3 = +30%). 줄어들면 현재 체력을 새 최대치로 클램프, 늘어도 현재 체력은 그대로 */
  setMaxHpBonus(ratio: number): void {
    if (ratio === this.maxHpBonus) return;
    this.maxHpBonus = ratio;
    this.maxHp = this.baseMaxHp * (1 + ratio);
    this.hp = Math.min(this.hp, this.maxHp);
  }

  /** 기본 최대 체력을 배율만큼 키우고 늘어난 만큼 현재 체력도 늘린다 (회복이 아님) */
  scaleMaxHp(multiplier: number): void {
    const before = this.maxHp;
    this.baseMaxHp *= multiplier;
    this.maxHp = this.baseMaxHp * (1 + this.maxHpBonus);
    this.hp += this.maxHp - before;
  }

  /** 피해 계산용 정보 */
  get damageTarget(): DamageTarget {
    return {
      traits: this.traits,
      weakness: this.weakness,
      resistance: this.resistance,
      defenseBreakStacks: this.status?.defenseBreakStacks ?? 0,
      damageReduction: (this.status?.damageReduction ?? 0) + this.innateDamageReduction,
      immuneTags: this.immuneTags,
    };
  }

  /** 회복. 회복 차단 중이면 0. 실제 회복량을 돌려준다 */
  heal(amount: number): number {
    if (!this.alive || this.status?.healBlocked) return 0;
    const healed = Math.min(amount, this.maxHp - this.hp);
    this.hp += healed;
    return healed;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  /** 피해를 입힌다. 이번 피해로 죽었으면 true. minimum은 최소 피해 (지속 피해는 0) */
  takeDamage(amount: number, minimum: number = COMBAT.minDamage): boolean {
    if (!this.alive) return false;
    this.hp -= Math.max(minimum, amount);
    return this.hp <= 0;
  }
}

/** 기지 (서낭당 / 원귀의 성) */
export class Base extends Body {
  /** 무적이면 피해를 받지 않는다 (보스가 살아 있는 동안의 원귀의 성) */
  invulnerable = false;

  constructor(team: Team, x: number, maxHp: number, readonly width: number, readonly height: number) {
    super('base', team, x, maxHp, width / 2);
  }

  override takeDamage(amount: number, minimum?: number): boolean {
    if (this.invulnerable) return false;
    return super.takeDamage(amount, minimum);
  }
}

export interface FighterStats extends CombatStats {
  tags: Tag[];
  traits: EnemyTrait[];
  flying: boolean;
  killTalisman: number;
  /** 크기 배율 (정예 등) */
  scale: number;
  elite: boolean;
  boss?: boolean;
  /** 이 태그가 붙은 피해를 받으면 그만큼 회복 (이무기 강철이) */
  healFromTags?: readonly Tag[];
  weakness?: Affinity;
  resistance?: Affinity;
  /** 이 유닛 공격이 거는 화상의 초당 피해 */
  burnPerSec?: number;
  /** 마법 공격 범위 반경 */
  areaRadius?: number;
}

/** 자동으로 전진·전투하는 유닛 (아군/적 공통) */
export class Fighter extends Body {
  attackCooldown = 0;
  /** 고유 능력 파라미터 (data/abilities.ts) */
  readonly ability: AbilityDef;
  readonly abilityState = new AbilityState();
  /** 성장 능력으로 늘어난 배율 */
  private growthAttack = 1;
  private growthSize = 1;
  /** 패턴이 정한 받는 피해 감소 */
  private patternReduction = 0;
  /** 비행 여부를 패턴이 덮어쓴 값 (null이면 stats.flying) */
  private flyingOverride: boolean | null = null;

  constructor(
    team: Team,
    readonly defId: string,
    readonly stats: FighterStats,
    x: number,
    /** 업그레이드로 바뀐 고유 능력 (없으면 기본 능력) */
    ability?: AbilityDef,
  ) {
    super('unit', team, x, stats.maxHp, (stats.width * stats.scale) / 2);
    this.ability = ability ?? getAbility(defId);
  }

  /** 현재 공격력 (성장 반영) */
  get attackPower(): number {
    return this.stats.attack * this.growthAttack;
  }

  /** 현재 크기 배율 (정예·성장 반영) */
  get sizeScale(): number {
    return this.stats.scale * this.growthSize;
  }

  /** 성장: 최대 체력·공격력·몸집을 키운다 */
  grow(multiplier: number, sizeMultiplier: number): void {
    this.scaleMaxHp(multiplier);
    this.growthAttack *= multiplier;
    this.growthSize *= sizeMultiplier;
    this.radius *= sizeMultiplier;
  }

  override get immuneTags(): readonly Tag[] {
    return this.ability.immuneTags ?? [];
  }

  override isImmuneTo(tags: readonly Tag[]): boolean {
    return this.immuneTags.some((t) => tags.includes(t));
  }

  override get flying(): boolean {
    return this.flyingOverride ?? this.stats.flying;
  }

  /** 패턴에서 비행 상태를 바꾼다 (어둑시니 대왕의 착지) */
  setFlying(value: boolean): void {
    this.flyingOverride = value;
  }

  override get innateDamageReduction(): number {
    return this.patternReduction;
  }

  setPatternReduction(value: number): void {
    this.patternReduction = value;
  }

  override get isBoss(): boolean {
    return this.stats.boss ?? false;
  }

  override get traits(): readonly EnemyTrait[] {
    return this.stats.traits;
  }

  override get weakness(): Affinity | undefined {
    return this.stats.weakness;
  }

  override get resistance(): Affinity | undefined {
    return this.stats.resistance;
  }

  /** 전진 방향: 아군 +1, 적 -1 */
  get direction(): 1 | -1 {
    return this.team === 'ally' ? 1 : -1;
  }
}

/** 투사체가 도착할 때 쓸 공격 정보 (공격 시점에 확정) */
export interface ProjectilePayload {
  tags: readonly Tag[];
  source: AttackSource;
  /** 발사 시점의 공격력 버프 합 */
  attackBonus: number;
  burnPerSec: number;
  /** 마법 범위 반경 (0이면 대상 하나) */
  areaRadius: number;
  /** 쏜 대상 (연계·능력 판정용) */
  attacker?: Body | null;
  /** 발사 시점에 확정된 피해 배율 */
  multiplier?: number;
}

const DEFAULT_PAYLOAD: ProjectilePayload = { tags: [], source: 'enemy', attackBonus: 0, burnPerSec: 0, areaRadius: 0 };

export class Projectile {
  alive = true;

  constructor(
    readonly team: Team,
    public x: number,
    readonly target: Body,
    readonly damage: number,
    readonly speed: number,
    readonly attackType: Exclude<AttackType, 'melee'>,
    readonly payload: ProjectilePayload = { ...DEFAULT_PAYLOAD, source: team },
  ) {}

  update(dt: number): boolean {
    if (!this.alive) return false;
    if (!this.target.alive) {
      this.alive = false;
      return false;
    }
    const dx = this.target.x - this.x;
    const step = this.speed * dt;
    if (Math.abs(dx) <= step + this.target.radius) {
      this.alive = false;
      return true; // 명중
    }
    this.x += Math.sign(dx) * step;
    return false;
  }
}
