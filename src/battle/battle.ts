import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { RESOURCES } from '../data/resources';
import { Base, Body, Fighter, Projectile } from './entities';
import { createEnemy } from './enemyFactory';
import { Hero } from './hero';
import { MathRng, type Rng } from './rng';
import { Resources } from './resources';
import { WaveDirector } from './wave';

export type BattleResult = 'playing' | 'victory' | 'defeat';
export type SummonResult = 'ok' | 'ended' | 'invalidIndex' | 'full' | 'cooldown' | 'noTalisman';

export interface BattleOptions {
  /** 스테이지 번호 0~24 */
  stage?: number;
  rng?: Rng;
}

export interface StepInput {
  /** -1 왼쪽, 0 정지, 1 오른쪽 */
  moveDir: number;
}

/** Phaser에 의존하지 않는 전투 시뮬레이션 */
export class Battle {
  readonly stage: number;
  readonly resources = new Resources();
  readonly hero = new Hero();
  readonly shrine: Base;
  readonly castle: Base;
  allies: Fighter[] = [];
  enemies: Fighter[] = [];
  projectiles: Projectile[] = [];
  elapsed = 0;
  result: BattleResult = 'playing';

  private readonly director: WaveDirector;
  private readonly cooldowns: number[] = ALLIES.map(() => 0);

  constructor(options: BattleOptions = {}) {
    this.stage = options.stage ?? 0;
    const rng = options.rng ?? new MathRng();
    this.director = new WaveDirector(this.stage, rng);
    this.shrine = new Base('ally', COMBAT.shrine.x, COMBAT.shrine.maxHp, COMBAT.shrine.width, COMBAT.shrine.height);
    this.castle = new Base(
      'enemy',
      COMBAT.castle.x,
      COMBAT.castle.baseHp + COMBAT.castle.hpPerStage * this.stage,
      COMBAT.castle.width,
      COMBAT.castle.height,
    );
  }

  /** 위협 단계: 30초마다 +1 (1부터) */
  get threatLevel(): number {
    return COMBAT.threatStart + Math.floor(this.elapsed / COMBAT.threatInterval);
  }

  get waveCount(): number {
    return this.director.waveCount;
  }

  /** 남은 소환 쿨타임(초) */
  summonCooldown(index: number): number {
    return this.cooldowns[index] ?? 0;
  }

  /** 아군 소환 */
  summon(index: number): SummonResult {
    if (this.result !== 'playing') return 'ended';
    const def = ALLIES[index];
    if (!def) return 'invalidIndex';
    if (this.allies.length >= COMBAT.maxAllies) return 'full';
    if (this.cooldowns[index] > 0) return 'cooldown';
    if (!this.resources.spendTalisman(def.cost)) return 'noTalisman';
    this.cooldowns[index] = def.cooldown;
    this.allies.push(new Fighter('ally', def.id, { ...def, traits: [], killTalisman: 0, scale: 1, elite: false }, COMBAT.allySpawnX));
    return 'ok';
  }

  /** 기운 모으기 */
  gather(): boolean {
    return this.result === 'playing' && this.resources.gather();
  }

  /** 적 한 마리를 내보낸다 (웨이브 및 테스트용) */
  spawnEnemy(enemyId: string, elite = false, x = this.castle.x - COMBAT.enemySpawnOffset): Fighter {
    const enemy = createEnemy(enemyId, this.stage, elite, x);
    this.enemies.push(enemy);
    return enemy;
  }

  /** dt가 크면 작은 틱으로 나눠 진행한다 */
  step(dt: number, input: StepInput = { moveDir: 0 }): void {
    let left = dt;
    while (left > 1e-9 && this.result === 'playing') {
      const slice = Math.min(left, COMBAT.maxStepSeconds);
      this.tick(slice, input);
      left -= slice;
    }
  }

  private tick(dt: number, input: StepInput): void {
    this.elapsed += dt;
    this.resources.step(dt);
    for (let i = 0; i < this.cooldowns.length; i++) {
      this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    }

    this.hero.update(dt, input.moveDir);
    this.heroAttack();

    for (const req of this.director.update(dt)) this.spawnEnemy(req.enemyId, req.elite);

    for (const f of [...this.allies, ...this.enemies]) this.actFighter(f, dt);
    this.updateProjectiles(dt);

    this.allies = this.allies.filter((f) => f.alive);
    this.enemies = this.enemies.filter((f) => f.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.checkResult();
  }

  // ----- 내부 -----

  /** 사거리 안의 가장 가까운 상대를 찾는다 */
  private findTarget(team: 'ally' | 'enemy', x: number, range: number): Body | null {
    const candidates: Body[] =
      team === 'ally'
        ? [...this.enemies, this.castle]
        : [...this.allies, ...(this.hero.alive ? [this.hero] : []), this.shrine];
    let best: Body | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (!c.alive) continue;
      const dist = Math.abs(c.x - x);
      if (dist - c.radius <= range && dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    return best;
  }

  private heroAttack(): void {
    if (!this.hero.attackReady) return;
    const target = this.findTarget('ally', this.hero.x, HERO.attack.range);
    if (!target) return;
    this.hero.attackCooldown = HERO.attack.interval;
    this.applyDamage(target, HERO.attack.damage);
    this.resources.addSpirit(RESOURCES.spirit.perHeroHit);
  }

  private actFighter(f: Fighter, dt: number): void {
    if (!f.alive) return;
    f.attackCooldown = Math.max(0, f.attackCooldown - dt);
    const target = this.findTarget(f.team, f.x, f.stats.range);
    if (!target) {
      f.x += f.direction * f.stats.speed * dt;
      return;
    }
    if (f.attackCooldown > 0) return;
    f.attackCooldown = f.stats.attackInterval;
    if (f.stats.attackType === 'melee') {
      this.applyDamage(target, f.stats.attack);
    } else {
      this.projectiles.push(
        new Projectile(f.team, f.x, target, f.stats.attack, COMBAT.projectileSpeed, f.stats.attackType),
      );
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.update(dt)) this.applyDamage(p.target, p.damage);
    }
  }

  /** 피해 적용과 사망 처리(처치 보상, 영웅 부활 시작) */
  private applyDamage(target: Body, amount: number): void {
    if (!target.takeDamage(amount)) return;
    if (target instanceof Fighter && target.team === 'enemy') {
      this.resources.addTalisman(target.stats.killTalisman);
    } else if (target === this.hero) {
      this.hero.beginRespawn(this.threatLevel);
    }
  }

  private checkResult(): void {
    if (!this.castle.alive) this.result = 'victory';
    else if (!this.shrine.alive) this.result = 'defeat';
  }
}
