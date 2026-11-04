import { BOSS_RULES, type BossDef, type BossPatternDef } from '../data/bosses';
import { STATUS } from '../data/status';
import type { AttackInfo } from './damage';
import type { Base, Body, Fighter } from './entities';
import { createBoss } from './enemyFactory';

/** 보스 패턴이 전장에 접근하는 창구 (Battle이 구현) */
export interface BossHost {
  readonly allies: readonly Fighter[];
  /** 살아 있는 영웅 (죽었으면 null) */
  readonly livingHero: Body | null;
  readonly shrine: Base;
  readonly castle: Base;
  /** 지금 더 둘 수 있는 일반 적 수 (적 상한). 졸개 소환은 이만큼만 한다 */
  readonly freeEnemySlots: number;
  addEnemy(enemy: Fighter): void;
  spawnEnemy(enemyId: string, elite: boolean, x: number): Fighter;
  /** 고정 피해: 공격력 버프 없이 피해 계산 함수(받는 피해 증감 포함)만 거친다 */
  dealFixedDamage(target: Body, base: number, info: AttackInfo): void;
  knockback(target: Body, distance: number): void;
  dispelBuffs(target: Body, duration: number): void;
  /** 아군 연계 효과와 오라를 끄거나 켠다 */
  setAllyBonusesSuppressed(value: boolean): void;
  /** 부적 충전 속도 배율 */
  setTalismanChargeFactor(factor: number): void;
}

/** 일정 주기마다 발동 횟수를 돌려주는 타이머 */
class IntervalTimer {
  private elapsed = 0;

  constructor(private readonly interval: number) {}

  /** dt만큼 진행하고 이번에 발동한 횟수를 돌려준다 */
  advance(dt: number): number {
    this.elapsed += dt;
    let fired = 0;
    while (this.elapsed >= this.interval - STATUS.epsilon) {
      this.elapsed -= this.interval;
      fired += 1;
    }
    return fired;
  }
}

/** 보스 하나의 고유 패턴. 보스가 살아 있는 동안만 update가 불린다 (기절·경직과 무관하게 흐른다) */
export interface BossPattern {
  onSpawn(boss: Fighter): void;
  update(dt: number, boss: Fighter): void;
  onDefeat(): void;
  /** 보스에게 방어 파괴가 걸렸을 때 */
  onDefenseBreak(): void;
  /** 화면에 덧붙일 상태 문구 (없으면 빈 문자열) */
  statusLabel(): string;
}

/** 아무것도 하지 않는 기본 구현 */
abstract class BasePattern implements BossPattern {
  onSpawn(_boss: Fighter): void {}
  update(_dt: number, _boss: Fighter): void {}
  onDefeat(): void {}
  onDefenseBreak(): void {}
  statusLabel(): string {
    return '';
  }
}

type PatternOf<K extends BossPatternDef['kind']> = Extract<BossPatternDef, { kind: K }>;

const MELEE_HIT: AttackInfo = { type: 'melee', tags: [], source: 'enemy' };

function allyPool(host: BossHost): Body[] {
  const pool: Body[] = [...host.allies];
  if (host.livingHero) pool.push(host.livingHero);
  return pool;
}

/** 보스 앞쪽(아군 방향) 반경 안의 아군 유닛·영웅 */
function victimsInFront(host: BossHost, boss: Fighter, radius: number): Body[] {
  return allyPool(host).filter((t) => {
    const ahead = (t.x - boss.x) * boss.direction;
    return t.alive && ahead >= 0 && ahead - t.radius <= radius;
  });
}

/** 보스 중심 반경 안의 아군 유닛·영웅 */
function victimsAround(host: BossHost, boss: Fighter, radius: number): Body[] {
  return allyPool(host).filter((t) => t.alive && Math.abs(t.x - boss.x) - t.radius <= radius);
}

/** 거대 원귀: 주기마다 졸개를 보스 주변에 소환 */
class SummonPattern extends BasePattern {
  private readonly timer: IntervalTimer;

  constructor(
    private readonly host: BossHost,
    private readonly def: PatternOf<'summon'>,
  ) {
    super();
    this.timer = new IntervalTimer(def.interval);
  }

  override update(dt: number, boss: Fighter): void {
    for (let n = this.timer.advance(dt); n > 0; n--) {
      const { count, spread, enemyId } = this.def;
      // 적 상한을 넘는 만큼은 소환을 생략한다
      const spawnable = Math.min(count, this.host.freeEnemySlots);
      for (let i = 0; i < spawnable; i++) {
        const x = boss.x + (i - (count - 1) / 2) * spread;
        this.host.spawnEnemy(enemyId, false, Math.min(this.host.castle.x, Math.max(this.host.shrine.x, x)));
      }
    }
  }
}

/** 철갑 장승왕: 갑옷 중첩이 쌓여 받는 피해 감소, 방어 파괴가 걸리면 한 겹 벗겨짐 */
class ArmorPattern extends BasePattern {
  private readonly timer: IntervalTimer;
  private boss: Fighter | null = null;
  private stacks = 0;

  constructor(private readonly def: PatternOf<'armor'>) {
    super();
    this.timer = new IntervalTimer(def.interval);
  }

  get armorStacks(): number {
    return this.stacks;
  }

  override onSpawn(boss: Fighter): void {
    this.boss = boss;
    this.apply();
  }

  override update(dt: number): void {
    const gained = this.timer.advance(dt);
    if (gained > 0) {
      this.stacks = Math.min(this.def.maxStacks, this.stacks + gained);
      this.apply();
    }
  }

  override onDefenseBreak(): void {
    if (this.stacks <= 0) return;
    this.stacks -= 1;
    this.apply();
  }

  override statusLabel(): string {
    return `갑옷 ${this.stacks}/${this.def.maxStacks}`;
  }

  private apply(): void {
    this.boss?.setPatternReduction(this.stacks * this.def.reductionPerStack);
  }
}

/** 이무기 강철이: 가뭄(부적 충전 감소)과 꼬리치기. 불 회복은 Battle의 피해 처리에서 한다 */
class SerpentPattern extends BasePattern {
  private readonly timer: IntervalTimer;

  constructor(
    private readonly host: BossHost,
    private readonly def: PatternOf<'serpent'>,
  ) {
    super();
    this.timer = new IntervalTimer(def.tail.interval);
  }

  override onSpawn(): void {
    this.host.setTalismanChargeFactor(1 - this.def.droughtPenalty);
  }

  override onDefeat(): void {
    this.host.setTalismanChargeFactor(1);
  }

  override update(dt: number, boss: Fighter): void {
    const { radius, damage, knockback } = this.def.tail;
    for (let n = this.timer.advance(dt); n > 0; n--) {
      for (const t of victimsInFront(this.host, boss, radius)) {
        this.host.dealFixedDamage(t, damage, MELEE_HIT);
        if (t.alive) this.host.knockback(t, knockback);
      }
    }
  }
}

/** 어둑시니 대왕: 평소 비행, 주기마다 내려와 강타 */
class DescendPattern extends BasePattern {
  private readonly timer: IntervalTimer;
  private landedLeft = 0;

  constructor(
    private readonly host: BossHost,
    private readonly def: PatternOf<'descend'>,
  ) {
    super();
    this.timer = new IntervalTimer(def.interval);
  }

  override onSpawn(boss: Fighter): void {
    boss.setFlying(true);
  }

  override update(dt: number, boss: Fighter): void {
    if (this.landedLeft > 0) {
      this.landedLeft -= dt;
      if (this.landedLeft <= STATUS.epsilon) {
        this.landedLeft = 0;
        boss.setFlying(true);
      }
    }
    if (this.timer.advance(dt) === 0) return;
    boss.setFlying(false);
    this.landedLeft = this.def.duration;
    for (const t of victimsAround(this.host, boss, this.def.radius)) {
      this.host.dealFixedDamage(t, this.def.damage, MELEE_HIT);
    }
  }

  override statusLabel(): string {
    return this.landedLeft > 0 ? '착지' : '비행';
  }
}

/** 차사왕: 아군 연계·오라 무효, 주기마다 버프 해제 + 아군 유닛 피해 (영웅은 피해 제외) */
class SuppressPattern extends BasePattern {
  private readonly timer: IntervalTimer;

  constructor(
    private readonly host: BossHost,
    private readonly def: PatternOf<'suppress'>,
  ) {
    super();
    this.timer = new IntervalTimer(def.pulse.interval);
  }

  override onSpawn(): void {
    this.host.setAllyBonusesSuppressed(true);
  }

  override onDefeat(): void {
    this.host.setAllyBonusesSuppressed(false);
  }

  override update(dt: number): void {
    const { dispelDuration, damage } = this.def.pulse;
    for (let n = this.timer.advance(dt); n > 0; n--) {
      const hero = this.host.livingHero;
      if (hero) this.host.dispelBuffs(hero, dispelDuration);
      for (const a of [...this.host.allies]) {
        if (!a.alive) continue;
        this.host.dispelBuffs(a, dispelDuration);
        this.host.dealFixedDamage(a, damage, { type: 'magic', tags: [], source: 'enemy' });
      }
    }
  }
}

/** 패턴 정의 → 구현. 새 보스 패턴은 클래스와 이 표에 한 줄을 더한다 */
const PATTERN_FACTORIES: { [K in BossPatternDef['kind']]: (host: BossHost, def: PatternOf<K>) => BossPattern } = {
  summon: (host, def) => new SummonPattern(host, def),
  armor: (_host, def) => new ArmorPattern(def),
  serpent: (host, def) => new SerpentPattern(host, def),
  descend: (host, def) => new DescendPattern(host, def),
  suppress: (host, def) => new SuppressPattern(host, def),
};

function createPattern(host: BossHost, def: BossPatternDef): BossPattern {
  const factory = PATTERN_FACTORIES[def.kind] as (h: BossHost, d: BossPatternDef) => BossPattern;
  return factory(host, def);
}

export type BossState = 'pending' | 'active' | 'defeated';

/** 보스 스테이지의 보스 한 판: 등장 시각, 패턴, 처치, 성 무적을 관리한다 */
export class BossEncounter {
  private _state: BossState = 'pending';
  private _boss: Fighter | null = null;
  private readonly pattern: BossPattern;

  constructor(
    readonly def: BossDef,
    private readonly host: BossHost,
    private readonly appearAt: number,
  ) {
    this.pattern = createPattern(host, def.pattern);
  }

  get state(): BossState {
    return this._state;
  }

  /** 등장한 보스 (등장 전에는 null, 처치 후에도 마지막 보스를 돌려준다) */
  get boss(): Fighter | null {
    return this._boss;
  }

  /** 보스를 잡기 전까지 원귀의 성은 무적 */
  get castleInvulnerable(): boolean {
    return this._state !== 'defeated';
  }

  get statusLabel(): string {
    return this._state === 'active' ? this.pattern.statusLabel() : '';
  }

  /** 철갑 장승왕의 갑옷 중첩 수 (다른 보스는 0) */
  get armorStacks(): number {
    return this.pattern instanceof ArmorPattern ? this.pattern.armorStacks : 0;
  }

  /** elapsed: 전투 시작 후 시간, dt: 이번 틱 시간 */
  update(elapsed: number, dt: number): void {
    if (this._state === 'pending' && elapsed >= this.appearAt - STATUS.epsilon) this.spawn();
    if (this._state !== 'active' || !this._boss) return;
    if (!this._boss.alive) {
      this._state = 'defeated';
      this.pattern.onDefeat();
      return;
    }
    this.pattern.update(dt, this._boss);
  }

  /** 대상에게 방어 파괴가 걸렸음을 알린다 */
  notifyDefenseBreak(target: Body): void {
    if (this._state === 'active' && target === this._boss) this.pattern.onDefenseBreak();
  }

  private spawn(): void {
    const boss = createBoss(this.def, this.host.castle.x - BOSS_RULES.spawnOffset);
    this._boss = boss;
    this._state = 'active';
    this.host.addEnemy(boss);
    this.pattern.onSpawn(boss);
  }
}
