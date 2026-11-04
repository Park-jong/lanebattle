import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { getSkill, SKILL_EFFECTS, type SkillId } from '../data/skills';
import { RESOURCES } from '../data/resources';
import { type AbilityDef } from '../data/abilities';
import { ALL_SYNERGY_IDS, type SynergyId } from '../data/synergy';
import { TimedAbilities, type AbilityHost } from './abilities';
import { calcDamage, type AttackInfo } from './damage';
import { Base, Body, Fighter, Projectile, type ProjectilePayload } from './entities';
import type { AuraDef, BuffEffect } from './status';
import { createEnemy } from './enemyFactory';
import { Hero } from './hero';
import { MathRng, type Rng } from './rng';
import { Resources } from './resources';
import { SkillCooldowns, type CastResult, type SkillCastEvent } from './skills';
import { getStageInfo } from './stage';
import { SynergyEngine } from './synergy';
import { WaveDirector } from './wave';

export type BattleResult = 'playing' | 'victory' | 'defeat';
export type SummonResult = 'ok' | 'ended' | 'invalidIndex' | 'full' | 'cooldown' | 'noTalisman';

export interface BattleOptions {
  /** 스테이지 번호 0~24 */
  stage?: number;
  rng?: Rng;
  /** 켜 둘 연계 ID 목록. 기본은 빈 목록 (8단계 업그레이드 트리에서 정한다) */
  synergies?: readonly SynergyId[];
}

/** 타격 한 번의 입력 */
interface Strike {
  attacker: Body | null;
  base: number;
  info: AttackInfo;
  attackBonus: number;
  burnPerSec: number;
  /** 공격 시점에 확정된 피해 배율 (외다리 첫 타) */
  multiplier?: number;
}

export { ALL_SYNERGY_IDS };

/** 화상 지속 피해의 공격 정보 (불 태그) */
const BURN_ATTACK: AttackInfo = { type: 'magic', tags: ['fire'], source: 'ally' };

export interface StepInput {
  /** -1 왼쪽, 0 정지, 1 오른쪽 */
  moveDir: number;
}

/** Phaser에 의존하지 않는 전투 시뮬레이션 */
export class Battle implements AbilityHost {
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
  private auras: { owner: Body; def: AuraDef }[] = [];
  private readonly rng: Rng;
  private readonly skillCooldowns = new SkillCooldowns();
  private castEvents: SkillCastEvent[] = [];
  private readonly timedAbilities: TimedAbilities;
  readonly synergy: SynergyEngine;

  constructor(options: BattleOptions = {}) {
    this.stage = options.stage ?? 0;
    getStageInfo(this.stage); // 범위 밖이면 RangeError
    const rng = options.rng ?? new MathRng();
    this.rng = rng;
    this.synergy = new SynergyEngine(options.synergies ?? []);
    this.timedAbilities = new TimedAbilities(this);
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

  /** 살아 있는 영웅 (죽었으면 null) */
  get livingHero(): Body | null {
    return this.hero.alive ? this.hero : null;
  }

  /** 연계 전체를 끄는 스위치 (차사왕의 연계 무효용) */
  get synergyDisabled(): boolean {
    return this.synergy.suppressed;
  }

  set synergyDisabled(value: boolean) {
    this.synergy.suppressed = value;
  }

  /** 살아 있는 오라의 위치와 반경 (화면 표시용) */
  get auraCircles(): { x: number; radius: number }[] {
    return this.auras.filter((a) => a.owner.alive).map((a) => ({ x: a.owner.x, radius: a.def.radius }));
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
    const ally = new Fighter('ally', def.id, { ...def, traits: [], killTalisman: 0, scale: 1, elite: false }, COMBAT.allySpawnX);
    this.allies.push(ally);
    if (ally.ability.aura) this.addAura(ally, ally.ability.aura);
    return 'ok';
  }

  /** 남은 스킬 쿨타임(초) */
  skillCooldown(id: SkillId): number {
    return this.skillCooldowns.get(id);
  }

  /** 쌓인 시전 기록을 비우며 돌려준다 (화면 이펙트용) */
  drainCastEvents(): SkillCastEvent[] {
    const events = this.castEvents;
    this.castEvents = [];
    return events;
  }

  /** 영웅 스킬 사용. 실패하면 신력·쿨타임을 쓰지 않는다 */
  castSkill(id: SkillId): CastResult {
    if (this.result !== 'playing') return 'ended';
    let def;
    try {
      def = getSkill(id);
    } catch {
      return 'invalidSkill';
    }
    if (!this.hero.alive) return 'heroDead';
    if (this.hero.status?.stunned) return 'stunned';
    if (this.skillCooldowns.get(id) > 0) return 'cooldown';
    if (!this.resources.spendSpirit(def.spiritCost)) return 'noSpirit';
    this.skillCooldowns.start(id, def.cooldown);
    this.castEvents.push({ id, x: this.hero.x, facing: this.hero.facing });
    if (id === 'fanWind') this.castFanWind();
    else if (id === 'blessing') this.castBlessing();
    else this.castBladeDance();
    return 'ok';
  }

  /** 스킬 피해: 마법·영웅 태그. 공격력 버프는 적용하지 않는 고정 수치이고, 신력 충전도 없다 */
  private skillHit(target: Body, base: number, extraTags: AttackInfo['tags'] = []): void {
    const info: AttackInfo = { type: 'magic', tags: ['hero', ...extraTags], source: 'hero' };
    const damage = calcDamage(base, info, target.damageTarget);
    this.applyDamage(target, damage, damage === 0 ? 0 : undefined);
  }

  /** 부채 바람: 바라보는 방향 앞쪽(대상 반지름 고려)에 피해 + 넉백. 비행 적도 맞고 기지는 제외 */
  private castFanWind(): void {
    const { range, damage, knockback } = SKILL_EFFECTS.fanWind;
    const { x, facing } = this.hero;
    for (const e of [...this.enemies]) {
      const ahead = (e.x - x) * facing;
      if (!e.alive || ahead < 0 || ahead - e.radius > range) continue;
      this.skillHit(e, damage, ['wind']);
      if (e.alive && !e.isImmuneTo(['wind'])) this.knockback(e, knockback);
    }
  }

  /** 축원: 반경 안 아군(영웅 포함)을 회복하고 공격력 버프를 건다 */
  private castBlessing(): void {
    const { radius, healRatio, attackBonus, duration } = SKILL_EFFECTS.blessing;
    for (const a of [this.hero, ...this.allies]) {
      if (!a.alive || Math.abs(a.x - this.hero.x) - a.radius > radius) continue;
      a.heal(a.maxHp * healRatio);
      this.addBuff(a, { attack: attackBonus }, duration);
    }
  }

  /** 작두 타기: 반경 안 모든 적에게 피해 + 기절 (보스는 경직) */
  private castBladeDance(): void {
    const { radius, damage, stun } = SKILL_EFFECTS.bladeDance;
    for (const e of [...this.enemies]) {
      if (!e.alive || Math.abs(e.x - this.hero.x) - e.radius > radius) continue;
      this.skillHit(e, damage);
      if (e.alive && !e.isImmuneTo(['hero'])) this.applyStun(e, stun);
    }
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

    this.skillCooldowns.step(dt); // 영웅이 죽어 있어도 줄어든다
    this.hero.update(dt, input.moveDir);
    this.applyAuras();
    this.synergy.update(this.allies, this.livingHero, dt);
    this.timedAbilities.update(dt);
    this.tickStatuses(dt);
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
  private findTarget(
    team: 'ally' | 'enemy',
    x: number,
    range: number,
    melee: boolean,
    targeting?: AbilityDef['targeting'],
  ): Body | null {
    const candidates = this.targetCandidates(team, targeting);
    let best: Body | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (!c.alive) continue;
      if (melee && c.flying) continue; // 근접 공격은 비행 대상을 칠 수 없다
      const dist = Math.abs(c.x - x);
      if (dist - c.radius <= range && dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    return best;
  }

  /** 공격 대상 후보. 능력에 따라 일부 대상은 무시하고 지나간다 */
  private targetCandidates(team: 'ally' | 'enemy', targeting?: AbilityDef['targeting']): Body[] {
    if (team === 'ally') return [...this.enemies, this.castle];
    if (targeting === 'baseOnly') return [this.shrine];
    if (targeting === 'rangedAndMagicFirst') {
      return [...this.allies.filter((a) => a.stats.attackType !== 'melee'), this.shrine];
    }
    return [...this.allies, ...(this.hero.alive ? [this.hero] : []), this.shrine];
  }

  private heroAttack(): void {
    if (!this.hero.attackReady) return;
    const status = this.hero.status!;
    const target = this.findTarget('ally', this.hero.x, HERO.attack.range, HERO.attack.type === 'melee');
    if (!target) return;
    this.hero.attackCooldown = HERO.attack.interval / (1 + status.attackSpeedBonus);
    const info: AttackInfo = { type: HERO.attack.type, tags: HERO.attack.tags, source: 'hero' };
    this.strike(target, { attacker: this.hero, base: HERO.attack.damage, info, attackBonus: status.attackBonus, burnPerSec: 0 });
    this.resources.addSpirit(RESOURCES.spirit.perHeroHit);
  }

  private actFighter(f: Fighter, dt: number): void {
    if (!f.alive) return;
    const status = f.status!;
    f.attackCooldown = Math.max(0, f.attackCooldown - dt);
    if (status.stunned) return; // 기절·붙잡기: 이동·공격 정지
    const melee = f.stats.attackType === 'melee';
    const target = this.findTarget(f.team, f.x, f.stats.range, melee, f.ability.targeting);
    if (!target) {
      f.x += f.direction * f.stats.speed * status.moveMultiplier * dt;
      return;
    }
    if (f.attackCooldown > 0) return;
    f.attackCooldown = f.stats.attackInterval / (1 + status.attackSpeedBonus);
    const ability = f.ability;
    const multiplier =
      ability.firstStrikeMultiplier && f.abilityState.consumeFirstStrike() ? ability.firstStrikeMultiplier : 1;
    const payload: ProjectilePayload = {
      tags: f.stats.tags,
      source: f.team,
      attackBonus: status.attackBonus,
      // 불 태그 유닛의 공격은 모두 화상을 건다
      burnPerSec: f.stats.tags.includes('fire') ? (f.stats.burnPerSec ?? 0) : 0,
      areaRadius: f.stats.areaRadius ?? 0,
      attacker: f,
      multiplier,
    };
    if (f.stats.attackType === 'melee') {
      const info: AttackInfo = { type: 'melee', tags: payload.tags, source: payload.source };
      this.strike(target, {
        attacker: f,
        base: f.attackPower,
        info,
        attackBonus: payload.attackBonus,
        burnPerSec: payload.burnPerSec,
        multiplier,
      });
      const nth = ability.nthStrike;
      if (nth && f.abilityState.countAttack(nth.every) && target.alive) {
        this.knockback(target, nth.knockback);
        this.applyStun(target, nth.stun);
      }
    } else {
      this.projectiles.push(
        new Projectile(f.team, f.x, target, f.attackPower, COMBAT.projectileSpeed, f.stats.attackType, payload),
      );
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.update(dt)) this.resolveProjectile(p);
    }
  }

  /** 투사체 도착: 마법은 대상 위치 기준 범위 안의 모두에게, 아니면 대상 하나에게. 영등 바람 범위 안이면 빗나갈 수 있다 */
  private resolveProjectile(p: Projectile): void {
    if (this.isMissed(p)) return;
    const { payload } = p;
    const info: AttackInfo = { type: p.attackType, tags: payload.tags, source: payload.source };
    const victims = new Set<Body>([p.target]);
    if (p.attackType === 'magic' && payload.areaRadius > 0) {
      const pool = p.target.team === 'enemy' ? this.enemies : [...this.allies, ...(this.hero.alive ? [this.hero] : [])];
      for (const b of pool) {
        // 범위 피해는 비행 대상도 맞는다
        if (b.alive && Math.abs(b.x - p.target.x) - b.radius <= payload.areaRadius) victims.add(b);
      }
    }
    for (const v of victims) {
      this.strike(v, {
        attacker: payload.attacker ?? null,
        base: p.damage,
        info,
        attackBonus: payload.attackBonus,
        burnPerSec: payload.burnPerSec,
        multiplier: payload.multiplier,
      });
    }
  }

  /** 빗나감: 적 투사체가 영등 바람 오라(반경 안) 아군을 노리면 도착 시점에 한 번 굴린다. 확률은 합산하지 않고 가장 높은 값 */
  private isMissed(p: Projectile): boolean {
    const t = p.target;
    if (p.team !== 'enemy' || t.team !== 'ally' || t.kind === 'base' || t.status?.buffsDisabled) return false;
    let chance = 0;
    for (const a of this.allies) {
      const miss = a.ability.missAura;
      if (!miss || !a.alive || a.status!.buffsDisabled) continue;
      if (Math.abs(a.x - t.x) <= miss.radius) chance = Math.max(chance, miss.chance);
    }
    return chance > 0 && this.rng.next() < chance;
  }

  /**
   * 타격: 피해 계산 함수를 거친 피해 + 화상 + 고유 능력·연계의 공격 효과.
   * 공격자 쪽 배율(능력)과 연계 배율은 곱해진다. 공격자가 버프 해제 중이면 연계 공격 효과는 없다.
   */
  private strike(target: Body, s: Strike): void {
    const { attacker, info } = s;
    const ability = attacker instanceof Fighter ? attacker.ability : undefined;
    const dispelled = attacker?.status?.buffsDisabled ?? false;
    const targetBurning = target.status?.burning ?? false;

    let multiplier = s.multiplier ?? 1;
    if (ability?.vsTrait && target.traits.includes(ability.vsTrait.trait)) multiplier *= ability.vsTrait.multiplier;
    if (ability?.baseDamageMultiplier && target.kind === 'base') multiplier *= ability.baseDamageMultiplier;
    multiplier *= this.synergy.hitMultiplier(info, dispelled, targetBurning);

    const damage = calcDamage(s.base, info, target.damageTarget, { attackBonus: s.attackBonus, multiplier });
    this.applyDamage(target, damage, damage === 0 ? 0 : undefined);

    const burn = this.synergy.burnModifier(info, dispelled);
    if (s.burnPerSec > 0 && !target.isImmuneTo(info.tags)) {
      this.applyBurn(target, s.burnPerSec * burn.multiplier, burn.maxStacks);
    }
    this.applyHitEffects(target, ability?.onHit);
    const slow = this.synergy.hitSlow(info, dispelled);
    if (slow) this.applySlow(target, slow.ratio, slow.duration);
    const spread = this.synergy.spreadRadius(info, dispelled, targetBurning);
    if (spread > 0) this.spreadBurn(target, spread, burn.maxStacks);
  }

  /** 공격이 맞은 대상에게 거는 능력 효과 (방어 파괴, 감속, 회복 차단) */
  private applyHitEffects(target: Body, onHit: AbilityDef['onHit']): void {
    if (!onHit) return;
    if (onHit.defenseBreak) this.applyDefenseBreak(target);
    if (onHit.slow) this.applySlow(target, onHit.slow.ratio, onHit.slow.duration);
    if (onHit.healBlock) this.blockHeal(target, onHit.healBlock);
  }

  /** 불바람: 대상의 화상(가장 센 값)을 반경 안 다른 적에게 번지게 한다. 번진 화상은 다시 번지지 않는다 */
  private spreadBurn(source: Body, radius: number, maxStacks: number | undefined): void {
    const dps = source.status?.burnDps ?? 0;
    if (dps <= 0) return;
    for (const e of this.enemies) {
      if (e === source || !e.alive) continue;
      if (Math.abs(e.x - source.x) - e.radius <= radius && !e.isImmuneTo(['fire'])) this.applyBurn(e, dps, maxStacks);
    }
  }

  /** 피해 적용과 사망 처리(처치 보상, 영웅 부활 시작) */
  private applyDamage(target: Body, amount: number, minimum?: number): void {
    if (!target.takeDamage(amount, minimum)) return;
    if (target instanceof Fighter && target.team === 'enemy') {
      this.resources.addTalisman(target.stats.killTalisman);
    } else if (target === this.hero) {
      this.hero.beginRespawn(this.threatLevel);
    }
  }

  // ----- 상태 효과 -----

  /** 상태 효과를 받을 수 있는 대상 (기지 제외) */
  private statusBodies(): Body[] {
    return [...this.allies, ...this.enemies, ...(this.hero.alive ? [this.hero] : [])];
  }

  /** 시간을 진행하고 화상 지속 피해를 준다 (공격력 버프 제외, 특성·받는 피해 증감 적용) */
  private tickStatuses(dt: number): void {
    for (const b of this.statusBodies()) {
      if (!b.alive) continue;
      const base = b.status!.update(dt);
      if (base > 0) this.applyDamage(b, calcDamage(base, BURN_ATTACK, b.damageTarget, { dot: true }), 0);
    }
  }

  /** 오라: 매 틱 이전 오라 효과를 지우고 살아 있는 소유자 주변 아군에게 다시 건다 */
  private applyAuras(): void {
    for (const b of this.statusBodies()) b.status!.clearAuraEffects();
    this.auras = this.auras.filter((a) => a.owner.alive);
    for (const { owner, def } of this.auras) {
      const pool = owner.team === 'ally' ? [...this.allies, ...(this.hero.alive ? [this.hero] : [])] : this.enemies;
      for (const b of pool) {
        if (b.alive && Math.abs(b.x - owner.x) <= def.radius) b.status!.addAuraEffect(def.effect);
      }
    }
  }

  /** 소유자가 살아 있는 동안 주변 아군에게 효과를 주는 오라를 붙인다 */
  addAura(owner: Body, def: AuraDef): void {
    if (owner.status) this.auras.push({ owner, def });
  }

  applyBurn(target: Body, dps: number, maxStacks?: number): void {
    target.status?.applyBurn(dps, maxStacks);
  }

  /** ratio 0.3 = 이동 속도 -30% */
  applySlow(target: Body, ratio: number, duration: number): void {
    target.status?.applySlow(ratio, duration);
  }

  /** 기절·붙잡기. 보스는 0.5초 경직으로 대체 */
  applyStun(target: Body, duration: number): void {
    target.status?.stun(duration, target.isBoss);
  }

  /** 진행 반대 방향으로 밀어낸다. 보스·기지는 무효, 서낭당~성 사이로 클램프 */
  knockback(target: Body, distance: number): void {
    if (!target.status || target.isBoss) return;
    const dir = target.team === 'ally' ? -1 : 1;
    target.x = Math.min(this.castle.x, Math.max(this.shrine.x, target.x + dir * distance));
  }

  applyDefenseBreak(target: Body, maxStacks?: number): void {
    target.status?.applyDefenseBreak(maxStacks);
  }

  /** 버프 부여. 버프 해제 중이거나 기지면 false */
  addBuff(target: Body, effect: BuffEffect, duration: number): boolean {
    return target.status?.addBuff(effect, duration) ?? false;
  }

  /** 버프·오라 효과를 duration초 동안 끈다 */
  dispelBuffs(target: Body, duration: number): void {
    target.status?.dispel(duration);
  }

  blockHeal(target: Body, duration: number): void {
    target.status?.blockHeal(duration);
  }

  /** 같은 틱에 두 기지가 함께 부서지면 승리로 본다 (성 판정을 먼저 한다) */
  private checkResult(): void {
    if (!this.castle.alive) this.result = 'victory';
    else if (!this.shrine.alive) this.result = 'defeat';
  }
}
