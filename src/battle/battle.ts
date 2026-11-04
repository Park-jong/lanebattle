import { ALLIES } from '../data/allies';
import { BOSS_RULES, getBossById } from '../data/bosses';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { getSkill, SKILL_EFFECTS, type SkillId } from '../data/skills';
import { RESOURCES } from '../data/resources';
import { getAbility, type AbilityDef } from '../data/abilities';
import type { AllyDef, EnemyTrait } from '../data/types';
import { ALL_SYNERGY_IDS, type SynergyId } from '../data/synergy';
import { TimedAbilities, type AbilityHost } from './abilities';
import { BossEncounter, type BossHost } from './boss';
import { calcDamage, classifyMatchup, type AttackInfo, type DamageOptions } from './damage';
import { DamageFeed, type DamageEvent, type HitKind } from './damageEvents';
import { Base, Body, Fighter, Projectile, type ProjectilePayload } from './entities';
import type { AuraDef, BuffEffect } from './status';
import { createEnemy } from './enemyFactory';
import { Hero } from './hero';
import { noModifiers, type BattleModifiers } from './modifiers';
import { MathRng, type Rng } from './rng';
import { Resources } from './resources';
import { SkillCooldowns, type CastResult, type SkillCastEvent } from './skills';
import { getStageDef } from './stage';
import { evaluateStage, type StageResult } from './result';
import { SynergyEngine } from './synergy';
import { upgradeAbility, upgradeAllyDef } from './unitUpgrades';
import { WaveDirector } from './wave';

export type BattleResult = 'playing' | 'victory' | 'defeat';
export type SummonResult = 'ok' | 'ended' | 'invalidIndex' | 'full' | 'cooldown' | 'noTalisman';

export interface BattleOptions {
  /** 스테이지 번호 0~24 */
  stage?: number;
  rng?: Rng;
  /** 켜 둘 연계 ID 목록. 기본은 빈 목록 (8단계 업그레이드 트리에서 정한다) */
  synergies?: readonly SynergyId[];
  /** 보스 스테이지에서 보스가 등장하는 시각(초). 기본 60 */
  bossAt?: number;
  /** 빌드(업그레이드) 효과. 기본은 효과 없음. 연계는 synergies와 합쳐진다 */
  modifiers?: BattleModifiers;
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
export type { DamageEvent, HitKind };

/** 화상 지속 피해의 공격 정보 (불 태그) */
const BURN_ATTACK: AttackInfo = { type: 'magic', tags: ['fire'], source: 'ally' };
/** 칼날 춤 추가 피해의 공격 정보 (마법·영웅 태그, 지속 피해) */
const SKILL_DOT_ATTACK: AttackInfo = { type: 'magic', tags: ['hero'], source: 'hero' };

/** 빗나감 판정 결과: 맞음 / 빗나감 / 빗나가서 쏜 쪽으로 되돌아감 */
type MissOutcome = 'hit' | 'miss' | 'reflect';

/** 일정 시간 뒤 실행할 일 (3연발의 뒤쪽 발사) */
interface DelayedAction {
  remaining: number;
  run: () => void;
}

/** 칼날 춤에 걸린 지속 피해 */
interface SkillDot {
  target: Body;
  remaining: number;
}

export interface StepInput {
  /** -1 왼쪽, 0 정지, 1 오른쪽 */
  moveDir: number;
}

/** Phaser에 의존하지 않는 전투 시뮬레이션 */
export class Battle implements AbilityHost, BossHost {
  readonly stage: number;
  readonly resources: Resources;
  readonly hero: Hero;
  readonly shrine: Base;
  readonly castle: Base;
  allies: Fighter[] = [];
  enemies: Fighter[] = [];
  projectiles: Projectile[] = [];
  elapsed = 0;
  result: BattleResult = 'playing';

  private readonly director: WaveDirector;
  private readonly cooldowns: number[] = ALLIES.map(() => 0);
  private readonly mods: BattleModifiers;
  /** 업그레이드를 반영한 아군 정의 (소환 순서는 ALLIES와 같다) */
  private readonly allyDefs: readonly AllyDef[];
  /** 업그레이드를 반영한 아군 고유 능력 (유닛 id별) */
  private readonly allyAbilities: ReadonlyMap<string, AbilityDef>;
  private delayed: DelayedAction[] = [];
  private skillDots: SkillDot[] = [];
  /** 영웅 기본 공격 횟수 (무당 각성 충격파용) */
  private heroAttackCount = 0;
  /** 불가사리 각성: 갑옷 적 처치로 쌓인 공격력 중첩 (그 판 동안) */
  private armorKillStacks = 0;
  private auras: { owner: Body; def: AuraDef }[] = [];
  private readonly rng: Rng;
  private readonly skillCooldowns = new SkillCooldowns();
  private castEvents: SkillCastEvent[] = [];
  private readonly damageFeed = new DamageFeed();
  private readonly timedAbilities: TimedAbilities;
  readonly synergy: SynergyEngine;
  /** 보스 스테이지의 보스 한 판 (일반 스테이지는 null) */
  readonly encounter: BossEncounter | null;
  /** 차사왕: 아군 오라를 끈다 */
  private allyAurasSuppressed = false;

  constructor(options: BattleOptions = {}) {
    this.stage = options.stage ?? 0;
    const stageDef = getStageDef(this.stage); // 범위 밖이면 RangeError
    const rng = options.rng ?? new MathRng();
    this.rng = rng;
    const mods = options.modifiers ?? noModifiers();
    this.mods = mods;
    this.allyDefs = ALLIES.map((d) => upgradeAllyDef(d, mods.units[d.id]));
    this.allyAbilities = new Map(ALLIES.map((d) => [d.id, upgradeAbility(getAbility(d.id), d.id, mods.units[d.id])]));
    this.resources = new Resources({
      ...mods.economy,
      spiritChargeMultiplier: mods.hero.spiritChargeMultiplier,
      maxSpiritBonus: mods.hero.maxSpiritBonus,
    });
    this.hero = new Hero(HERO.maxHp * mods.hero.hpMultiplier, mods.hero.reviveReduction);
    this.synergy = new SynergyEngine([...new Set([...(options.synergies ?? []), ...mods.synergies])]);
    this.timedAbilities = new TimedAbilities(this);
    this.director = new WaveDirector(this.stage, rng);
    this.shrine = new Base('ally', COMBAT.shrine.x, COMBAT.shrine.maxHp, COMBAT.shrine.width, COMBAT.shrine.height);
    this.castle = new Base(
      'enemy',
      COMBAT.castle.x,
      stageDef.castleHp,
      COMBAT.castle.width,
      COMBAT.castle.height,
    );
    this.encounter = stageDef.bossId
      ? new BossEncounter(getBossById(stageDef.bossId), this, options.bossAt ?? BOSS_RULES.appearAt)
      : null;
    this.refreshCastleShield();
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
    if (this.allyAurasSuppressed) return [];
    return this.auras.filter((a) => a.owner.alive).map((a) => ({ x: a.owner.x, radius: a.def.radius }));
  }

  /** 위협 단계: 30초마다 +1 (1부터) */
  get threatLevel(): number {
    return COMBAT.threatStart + Math.floor(this.elapsed / COMBAT.threatInterval);
  }

  get waveCount(): number {
    return this.director.waveCount;
  }

  /** 살아 있는 적 수 (보스 제외, 적 상한 계산용) */
  get enemyCount(): number {
    return this.enemies.filter((e) => e.alive && !e.isBoss).length;
  }

  /** 지금 더 둘 수 있는 적 수 */
  get freeEnemySlots(): number {
    return Math.max(0, COMBAT.maxEnemies - this.enemyCount);
  }

  /** 상한 때문에 대기 중인 적 수 */
  get pendingSpawns(): number {
    return this.director.pendingCount;
  }

  /** 결과 계산 (진행 중이면 null). 이전 최고 별은 저장 연결 전이라 기본 0 */
  stageResult(previousBestStars = 0): StageResult | null {
    if (this.result === 'playing') return null;
    return evaluateStage({
      victory: this.result === 'victory',
      elapsed: this.elapsed,
      shrineHpRatio: this.shrine.hp / this.shrine.maxHp,
      stage: getStageDef(this.stage),
      previousBestStars,
    });
  }

  /** 업그레이드를 반영한 아군 정의 (비용·쿨타임 표시용) */
  allyDef(index: number): AllyDef {
    return this.allyDefs[index] ?? ALLIES[index];
  }

  /** 남은 소환 쿨타임(초) */
  summonCooldown(index: number): number {
    return this.cooldowns[index] ?? 0;
  }

  /** 아군 소환 */
  summon(index: number): SummonResult {
    if (this.result !== 'playing') return 'ended';
    const def = this.allyDefs[index];
    if (!def) return 'invalidIndex';
    if (this.allies.length >= COMBAT.maxAllies) return 'full';
    if (this.cooldowns[index] > 0) return 'cooldown';
    if (!this.resources.spendTalisman(def.cost)) return 'noTalisman';
    this.cooldowns[index] = def.cooldown;
    // 한 번에 여러 마리(까치 2무리)도 아군 상한을 넘기지 않는다
    const count = Math.min(def.summonCount ?? 1, COMBAT.maxAllies - this.allies.length);
    for (let i = 0; i < count; i++) this.spawnAlly(def, COMBAT.allySpawnX + i * COMBAT.summonSpread);
    return 'ok';
  }

  /** 아군 한 마리를 전장에 둔다 (상한 검사는 부르는 쪽 몫) */
  private spawnAlly(def: AllyDef, x: number): Fighter {
    const stats = { ...def, traits: [], killTalisman: 0, scale: 1, elite: false };
    const ally = new Fighter('ally', def.id, stats, x, this.allyAbilities.get(def.id));
    this.allies.push(ally);
    if (ally.ability.aura) this.addAura(ally, ally.ability.aura);
    return ally;
  }

  /** 업그레이드를 반영한 스킬 쿨타임 전체 길이(초) */
  skillCooldownMax(id: SkillId): number {
    const base = getSkill(id).cooldown;
    return id === 'bladeDance' ? base * this.mods.skills.bladeDance.cooldownMultiplier : base;
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

  /** 쌓인 피해 기록(상성 분류 포함)을 비우며 돌려준다 (데미지 숫자용) */
  drainDamageEvents(): DamageEvent[] {
    return this.damageFeed.drain();
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
    this.skillCooldowns.start(id, this.skillCooldownMax(id));
    this.castEvents.push({ id, x: this.hero.x, facing: this.hero.facing, range: this.skillRange(id) });
    if (id === 'fanWind') this.castFanWind();
    else if (id === 'blessing') this.castBlessing();
    else this.castBladeDance();
    return 'ok';
  }

  /** 스킬의 실제 범위 (업그레이드 반영) */
  private skillRange(id: SkillId): number {
    const fx = this.mods.skills;
    if (id === 'fanWind') return SKILL_EFFECTS.fanWind.range * fx.fanWind.rangeMultiplier;
    if (id === 'blessing') return SKILL_EFFECTS.blessing.radius * fx.blessing.rangeMultiplier;
    return SKILL_EFFECTS.bladeDance.radius;
  }

  /** 스킬 피해: 마법·영웅 태그. 공격력 버프는 적용하지 않는 고정 수치이고, 신력 충전도 없다 */
  private skillHit(target: Body, base: number, extraTags: AttackInfo['tags'] = []): void {
    const info: AttackInfo = { type: 'magic', tags: ['hero', ...extraTags], source: 'hero' };
    this.resolveHit(target, base, info, {});
  }

  /** 부채 바람: 바라보는 방향 앞쪽(대상 반지름 고려)에 피해 + 넉백. 비행 적도 맞고 기지는 제외 */
  private castFanWind(): void {
    const fx = this.mods.skills.fanWind;
    const range = SKILL_EFFECTS.fanWind.range * fx.rangeMultiplier;
    const damage = SKILL_EFFECTS.fanWind.damage * fx.damageMultiplier;
    const knockback = SKILL_EFFECTS.fanWind.knockback * fx.knockbackMultiplier;
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
    const { duration } = SKILL_EFFECTS.blessing;
    const { healRatio, attackBonus } = this.mods.skills.blessing;
    const radius = SKILL_EFFECTS.blessing.radius * this.mods.skills.blessing.rangeMultiplier;
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
      if (e.alive) this.startSkillDot(e);
    }
  }

  /** 칼날 춤: 맞은 적에게 지속 추가 피해를 건다 (다시 맞으면 시간만 갱신) */
  private startSkillDot(target: Body): void {
    const { extraDuration } = this.mods.skills.bladeDance;
    if (extraDuration <= 0) return;
    const existing = this.skillDots.find((d) => d.target === target);
    if (existing) existing.remaining = extraDuration;
    else this.skillDots.push({ target, remaining: extraDuration });
  }

  private tickSkillDots(dt: number): void {
    const dps = this.mods.skills.bladeDance.extraDamagePerSec;
    for (const d of this.skillDots) {
      if (!d.target.alive) {
        d.remaining = 0;
        continue;
      }
      const t = Math.min(dt, d.remaining);
      d.remaining -= t;
      this.resolveHit(d.target, dps * t, SKILL_DOT_ATTACK, { dot: true });
    }
    this.skillDots = this.skillDots.filter((d) => d.remaining > 1e-9);
  }

  /** 기운 모으기 */
  gather(): boolean {
    return this.result === 'playing' && this.resources.gather();
  }

  /** 적 한 마리를 내보낸다 (웨이브 및 테스트용). 적 상한은 웨이브 쪽에서 지키므로 여기서는 검사하지 않는다 */
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

    this.encounter?.update(this.elapsed, dt);
    this.refreshCastleShield();
    this.skillCooldowns.step(dt); // 영웅이 죽어 있어도 줄어든다
    this.hero.update(dt, input.moveDir);
    this.applyAuras();
    this.synergy.update(this.allies, this.livingHero, dt);
    this.timedAbilities.update(dt);
    this.tickStatuses(dt);
    this.tickSkillDots(dt);
    this.heroAttack();

    for (const req of this.director.update(dt, this.freeEnemySlots)) this.spawnEnemy(req.enemyId, req.elite);

    for (const f of [...this.allies, ...this.enemies]) this.actFighter(f, dt);
    this.runDelayed(dt);
    this.updateProjectiles(dt);

    this.allies = this.allies.filter((f) => f.alive);
    this.enemies = this.enemies.filter((f) => f.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.damageFeed.step(dt);
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
    return this.findTargets(team, x, range, melee, targeting, 1)[0] ?? null;
  }

  /** 사거리 안의 가까운 상대 count명 (가까운 순, 거리가 같으면 후보 순서) */
  private findTargets(
    team: 'ally' | 'enemy',
    x: number,
    range: number,
    melee: boolean,
    targeting: AbilityDef['targeting'],
    count: number,
  ): Body[] {
    const found: { body: Body; dist: number }[] = [];
    for (const c of this.targetCandidates(team, targeting)) {
      if (!c.alive) continue;
      if (melee && c.flying) continue; // 근접 공격은 비행 대상을 칠 수 없다
      const dist = Math.abs(c.x - x);
      if (dist - c.radius <= range) found.push({ body: c, dist });
    }
    found.sort((a, b) => a.dist - b.dist);
    return found.slice(0, count).map((f) => f.body);
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
    this.hero.markAttack(target.x);
    const info: AttackInfo = { type: HERO.attack.type, tags: HERO.attack.tags, source: 'hero' };
    this.strike(target, { attacker: this.hero, base: this.heroBaseDamage, info, attackBonus: status.attackBonus, burnPerSec: 0 });
    this.resources.addSpirit(RESOURCES.spirit.perHeroHit);
    const awakening = this.mods.hero.awakening;
    if (awakening && ++this.heroAttackCount % awakening.everyNth === 0) this.heroShockwave(awakening);
  }

  /** 방울 단련을 반영한 영웅 기본 공격력 */
  private get heroBaseDamage(): number {
    return HERO.attack.damage * this.mods.hero.attackMultiplier;
  }

  /** 무당 각성: 영웅 주변 반경 안 땅 위의 적 모두에게 근접·영웅 태그 피해 (공격력 배율 적용) */
  private heroShockwave(awakening: NonNullable<BattleModifiers['hero']['awakening']>): void {
    const info: AttackInfo = { type: 'melee', tags: ['hero'], source: 'hero' };
    const base = this.heroBaseDamage * awakening.attackMultiplier;
    const attackBonus = this.hero.status!.attackBonus;
    for (const e of [...this.enemies]) {
      if (!e.alive || e.flying || Math.abs(e.x - this.hero.x) - e.radius > awakening.radius) continue;
      this.strike(e, { attacker: this.hero, base, info, attackBonus, burnPerSec: 0 });
    }
  }

  private actFighter(f: Fighter, dt: number): void {
    f.visualMoving = false;
    if (!f.alive) return;
    const status = f.status!;
    f.attackCooldown = Math.max(0, f.attackCooldown - dt);
    if (status.stunned) return; // 기절·붙잡기: 이동·공격 정지
    const melee = f.stats.attackType === 'melee';
    const ability = f.ability;
    const targets = this.findTargets(f.team, f.x, f.stats.range, melee, ability.targeting, melee ? 1 : (ability.multiTarget ?? 1));
    const target = targets[0];
    if (!target) {
      f.x += f.direction * f.stats.speed * status.moveMultiplier * dt;
      f.visualMoving = f.stats.speed * status.moveMultiplier > 0;
      return;
    }
    if (f.attackCooldown > 0) return;
    f.attackCooldown = f.stats.attackInterval / (1 + status.attackSpeedBonus);
    f.markAttack(target.x);
    const charged = !!ability.firstStrikeMultiplier && f.abilityState.consumeFirstStrike();
    const multiplier = charged ? ability.firstStrikeMultiplier! : 1;
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
      if (charged && ability.pierce) this.pierceCharge(f, target, ability.pierce.pathExtra, payload);
      const nth = ability.nthStrike;
      if (nth && f.abilityState.countAttack(nth.every) && target.alive) {
        const from = target.x;
        this.knockback(target, nth.knockback);
        this.applyStun(target, nth.stun);
        if (nth.collisionDamage) this.collide(f, target, from, nth.collisionDamage);
      }
    } else {
      // 여러 대상(2갈래)이면 대상마다 한 발, 연발이면 같은 대상에게 간격을 두고 다시 쏜다
      for (const t of targets) this.fireShot(f, t, payload);
      const salvo = ability.salvo;
      for (let i = 1; salvo && i < salvo.shots; i++) {
        this.delayed.push({ remaining: salvo.interval * i, run: () => this.fireShot(f, target, payload) });
      }
    }
  }

  /** 투사체 한 발. 쏜 쪽이나 대상이 죽었으면 쏘지 않는다 */
  private fireShot(f: Fighter, target: Body, payload: ProjectilePayload): void {
    if (!f.alive || !target.alive) return;
    this.projectiles.push(
      new Projectile(f.team, f.x, target, f.attackPower, COMBAT.projectileSpeed, f.stats.attackType as 'ranged' | 'magic', payload),
    );
  }

  private runDelayed(dt: number): void {
    if (this.delayed.length === 0) return;
    for (const d of this.delayed) d.remaining -= dt;
    const due = this.delayed.filter((d) => d.remaining <= 1e-9);
    this.delayed = this.delayed.filter((d) => d.remaining > 1e-9);
    for (const d of due) d.run();
  }

  /**
   * 관통 돌격(외다리 각성): 공격자 위치부터 대상 너머 pathExtra까지, 진행 방향 길 위의 땅 위 적 모두에게
   * 같은 돌격 피해를 준다 (대상은 이미 맞았으므로 제외).
   */
  private pierceCharge(f: Fighter, target: Body, pathExtra: number, payload: ProjectilePayload): void {
    const dir = f.direction;
    const end = target.x + dir * pathExtra;
    const info: AttackInfo = { type: 'melee', tags: payload.tags, source: payload.source };
    for (const e of [...this.enemies]) {
      if (e === target || !e.alive || e.flying) continue;
      if ((e.x - f.x) * dir < 0 || (e.x - end) * dir > 0) continue;
      this.strike(e, {
        attacker: f, base: f.attackPower, info, attackBonus: payload.attackBonus, burnPerSec: payload.burnPerSec,
        multiplier: payload.multiplier,
      });
    }
  }

  /**
   * 충돌 메치기(씨름 각성): 메쳐진 적이 밀려난 길(원래 자리 from ~ 지금 자리 + 몸 반지름) 위에서
   * 가장 먼저 닿는 다른 적과 부딪혀 둘 다 고정 피해를 입는다. 밀려나지 않았으면(보스 등) 충돌 없음.
   */
  private collide(f: Fighter, thrown: Body, from: number, damage: number): void {
    const dir = f.direction;
    const travelled = (thrown.x - from) * dir;
    if (travelled <= 0) return;
    const reach = travelled + thrown.radius;
    let hit: Fighter | null = null;
    let hitAhead = Infinity;
    for (const e of this.enemies) {
      if (e === thrown || !e.alive || e.flying) continue;
      const ahead = (e.x - from) * dir;
      if (ahead > 0 && ahead - e.radius <= reach && ahead < hitAhead) {
        hit = e;
        hitAhead = ahead;
      }
    }
    if (!hit) return;
    const info: AttackInfo = { type: 'melee', tags: f.stats.tags, source: 'ally' };
    this.resolveHit(thrown, damage, info, {});
    this.resolveHit(hit, damage, info, {});
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.update(dt)) this.resolveProjectile(p);
    }
  }

  /** 투사체 도착: 마법은 대상 위치 기준 범위 안의 모두에게, 아니면 대상 하나에게. 영등 바람 범위 안이면 빗나갈 수 있다 */
  private resolveProjectile(p: Projectile): void {
    const outcome = this.missOutcome(p);
    if (outcome === 'reflect') this.reflectProjectile(p);
    if (outcome !== 'hit') return;
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
  private missOutcome(p: Projectile): MissOutcome {
    const t = p.target;
    if (p.team !== 'enemy' || t.team !== 'ally' || t.kind === 'base' || t.status?.buffsDisabled) return 'hit';
    let chance = 0;
    let reflect = false;
    for (const a of this.allies) {
      const miss = a.ability.missAura;
      if (!miss || !a.alive || a.status!.buffsDisabled) continue;
      if (Math.abs(a.x - t.x) > miss.radius) continue;
      chance = Math.max(chance, miss.chance);
      reflect = reflect || (miss.reflect ?? false);
    }
    if (chance <= 0 || this.rng.next() >= chance) return 'hit';
    return reflect ? 'reflect' : 'miss';
  }

  /** 되돌림 바람: 빗나간 투사체가 같은 피해로 쏜 적에게 되돌아간다. 다시 빗나가지 않는다 */
  private reflectProjectile(p: Projectile): void {
    const shooter = p.payload.attacker;
    if (!shooter?.alive || shooter.team !== 'enemy') return;
    this.projectiles.push(
      new Projectile('ally', p.x, shooter, p.damage, p.speed, p.attackType, { ...p.payload, source: 'ally', attacker: null }),
    );
  }

  /**
   * 타격: 피해 계산 함수를 거친 피해 + 화상 + 고유 능력·연계의 공격 효과.
   * 공격자 쪽 배율(능력)과 연계 배율은 곱해진다. 공격자가 버프 해제 중이면 연계 공격 효과는 없다.
   */
  private strike(target: Body, s: Strike): void {
    const { attacker } = s;
    // 보스 약점 판정용: 방어 파괴를 거는 공격인지, 공격자가 비행 유닛인지
    const info: AttackInfo = {
      ...s.info,
      defenseBreak: s.info.defenseBreak ?? (attacker instanceof Fighter ? (attacker.ability.onHit?.defenseBreak ?? false) : false),
      attackerFlying: s.info.attackerFlying ?? attacker?.flying ?? false,
    };
    const ability = attacker instanceof Fighter ? attacker.ability : undefined;
    const dispelled = attacker?.status?.buffsDisabled ?? false;
    const targetBurning = target.status?.burning ?? false;

    let multiplier = s.multiplier ?? 1;
    const vsTraitHit = ability?.vsTrait !== undefined && this.hasTraitFor(target, ability.vsTrait.trait);
    if (ability?.vsTrait && vsTraitHit) multiplier *= ability.vsTrait.multiplier;
    if (ability?.baseDamageMultiplier && target.kind === 'base') multiplier *= ability.baseDamageMultiplier;
    if (ability?.armorKill) multiplier *= 1 + ability.armorKill.attackPerStack * this.armorKillStacks;
    multiplier *= this.synergy.hitMultiplier(info, dispelled, targetBurning);

    const wasAlive = target.alive;
    this.resolveHit(target, s.base, info, { attackBonus: s.attackBonus, multiplier });
    if (wasAlive && !target.alive && attacker instanceof Fighter) this.onKill(attacker, target);

    const burn = this.synergy.burnModifier(info, dispelled);
    if (s.burnPerSec > 0 && !target.isImmuneTo(info.tags)) {
      this.applyBurn(target, s.burnPerSec * burn.multiplier, burn.maxStacks);
    }
    this.applyHitEffects(target, ability?.onHit);
    const vs = ability?.vsTrait;
    // 경직은 보스에게 걸지 않는다 (비행 중인 대왕도 배율만 받는다)
    if (vs?.stagger && target.alive && !target.isBoss && target.traits.includes(vs.trait)) this.applyStun(target, vs.stagger);
    const slow = this.synergy.hitSlow(info, dispelled);
    if (slow) this.applySlow(target, slow.ratio, slow.duration);
    const spread = this.synergy.spreadRadius(info, dispelled, targetBurning);
    if (spread > 0) this.spreadBurn(target, spread, burn.maxStacks);
  }

  /** 특성 대상 판정. 비행 중인 보스는 일반 비행 특성 없이도 비행 적으로 취급한다 (배율만, 바람 ×1.5 등은 없음) */
  private hasTraitFor(target: Body, trait: EnemyTrait): boolean {
    if (target.traits.includes(trait)) return true;
    return trait === 'flying' && target.isBoss && target.flying;
  }

  /** 타격으로 적을 처치했을 때의 아군 능력 (뚝딱: 추가 소환, 쇠를 먹는 자: 회복과 공격력 중첩) */
  private onKill(attacker: Fighter, victim: Body): void {
    if (attacker.team !== 'ally' || !(victim instanceof Fighter)) return;
    const spawn = attacker.ability.killSpawn;
    if (spawn && this.rng.next() < spawn.chance) {
      const def = this.allyDefs.find((d) => d.id === attacker.defId);
      const count = Math.min(spawn.count, COMBAT.maxAllies - this.allies.length);
      for (let i = 0; def && i < count; i++) this.spawnAlly(def, COMBAT.allySpawnX + i * COMBAT.summonSpread);
    }
    const armor = attacker.ability.armorKill;
    if (armor && victim.traits.includes('armor')) {
      attacker.heal(attacker.maxHp * armor.healRatio);
      this.armorKillStacks++;
    }
  }

  /** 태양 불꽃: 반경 안 적 전체에 화상 (연계 보정과 불 면역을 따른다) */
  sunFlame(source: Fighter, radius: number): void {
    const dps = source.stats.burnPerSec ?? 0;
    if (dps <= 0) return;
    const info: AttackInfo = { type: source.stats.attackType, tags: source.stats.tags, source: 'ally' };
    const burn = this.synergy.burnModifier(info, source.status?.buffsDisabled ?? false);
    for (const e of this.enemies) {
      if (!e.alive || Math.abs(e.x - source.x) - e.radius > radius || e.isImmuneTo(['fire'])) continue;
      this.applyBurn(e, dps * burn.multiplier, burn.maxStacks);
    }
  }

  /** 공격이 맞은 대상에게 거는 능력 효과 (방어 파괴, 감속, 회복 차단) */
  private applyHitEffects(target: Body, onHit: AbilityDef['onHit']): void {
    if (!onHit) return;
    if (onHit.defenseBreak) this.applyDefenseBreak(target, onHit.defenseBreakMaxStacks);
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

  /**
   * 피해 계산 + 적용. 대상이 태그 회복 특성(강철이의 불)을 가졌고 공격이 그 태그면,
   * 저항 적용 전 피해량만큼 회복한다 (회복 차단의 영향을 받음).
   * 최소 피해는 지속 피해(dot)가 아니면 1, 면역(피해 0)이면 0.
   */
  private resolveHit(target: Body, base: number, info: AttackInfo, options: DamageOptions): void {
    const wasAlive = target.alive;
    const damage = calcDamage(base, info, target.damageTarget, options);
    this.applyDamage(target, damage, damage === 0 || options.dot ? 0 : undefined);
    if (wasAlive) this.recordHit(target, damage, info, options.dot ?? false);
    const healTags = target instanceof Fighter ? target.stats.healFromTags : undefined;
    if (!target.alive || !healTags?.some((t) => info.tags.includes(t))) return;
    const raw = calcDamage(base, info, { ...target.damageTarget, resistance: undefined }, options);
    target.heal(raw);
  }

  /** 피해 기록: 면역(0)·화상(묶음)·약점·저항·보통으로 나눈다. 무적 기지가 맞은 것은 기록하지 않는다 */
  private recordHit(target: Body, damage: number, info: AttackInfo, dot: boolean): void {
    if (target instanceof Base && target.invulnerable) return;
    if (dot) {
      if (damage > 0) this.damageFeed.addBurn(target, damage);
      return;
    }
    const kind: HitKind = damage === 0 ? 'immune' : classifyMatchup(info, target.damageTarget);
    this.damageFeed.push({
      target,
      x: target.x,
      amount: damage === 0 ? 0 : Math.max(1, Math.round(damage)),
      kind,
      friendly: target.team === 'ally',
    });
  }

  /** 고정 피해 (보스 패턴용): 공격력 버프 없이 피해 계산 함수만 거친다 */
  dealFixedDamage(target: Body, base: number, info: AttackInfo): void {
    this.resolveHit(target, base, info, {});
  }

  addEnemy(enemy: Fighter): void {
    this.enemies.push(enemy);
  }

  setAllyBonusesSuppressed(value: boolean): void {
    this.synergyDisabled = value;
    this.allyAurasSuppressed = value;
  }

  setTalismanChargeFactor(factor: number): void {
    this.resources.setTalismanChargeFactor(factor);
  }

  /** 보스를 잡기 전에는 원귀의 성이 무적 */
  private refreshCastleShield(): void {
    this.castle.invulnerable = this.encounter?.castleInvulnerable ?? false;
  }

  /** 피해 적용과 사망 처리(처치 보상, 영웅 부활 시작) */
  private applyDamage(target: Body, amount: number, minimum?: number): void {
    if (!target.takeDamage(amount, minimum)) return;
    if (target instanceof Fighter && target.team === 'enemy') {
      this.resources.addKillReward(target.stats.killTalisman);
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
      if (base > 0) this.resolveHit(b, base, BURN_ATTACK, { dot: true });
    }
  }

  /** 오라: 매 틱 이전 오라 효과를 지우고 살아 있는 소유자 주변 아군에게 다시 건다 */
  private applyAuras(): void {
    for (const b of this.statusBodies()) b.status!.clearAuraEffects();
    this.auras = this.auras.filter((a) => a.owner.alive);
    for (const { owner, def } of this.auras) {
      if (this.allyAurasSuppressed && owner.team === 'ally') continue;
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
    this.encounter?.notifyDefenseBreak(target);
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
