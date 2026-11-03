import type { CombatStats, EnemyTrait, Tag, Team } from '../data/types';
import { COMBAT } from '../data/combat';

export type BodyKind = 'unit' | 'hero' | 'base';

/** 피해를 받을 수 있는 모든 대상의 공통 부모 */
export abstract class Body {
  hp: number;

  constructor(
    readonly kind: BodyKind,
    readonly team: Team,
    public x: number,
    readonly maxHp: number,
    readonly radius: number,
  ) {
    this.hp = maxHp;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  /** 피해를 입힌다. 이번 피해로 죽었으면 true */
  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= Math.max(COMBAT.minDamage, amount);
    return this.hp <= 0;
  }
}

/** 기지 (서낭당 / 원귀의 성) */
export class Base extends Body {
  constructor(team: Team, x: number, maxHp: number, readonly width: number, readonly height: number) {
    super('base', team, x, maxHp, width / 2);
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
}

/** 자동으로 전진·전투하는 유닛 (아군/적 공통) */
export class Fighter extends Body {
  attackCooldown = 0;

  constructor(
    team: Team,
    readonly defId: string,
    readonly stats: FighterStats,
    x: number,
  ) {
    super('unit', team, x, stats.maxHp, (stats.width * stats.scale) / 2);
  }

  /** 전진 방향: 아군 +1, 적 -1 */
  get direction(): 1 | -1 {
    return this.team === 'ally' ? 1 : -1;
  }
}

export class Projectile {
  alive = true;

  constructor(
    readonly team: Team,
    public x: number,
    readonly target: Body,
    readonly damage: number,
    readonly speed: number,
    readonly attackType: 'ranged' | 'magic',
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
