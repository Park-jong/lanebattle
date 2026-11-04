import { STATUS } from '../data/status';
import type { Body, Fighter } from './entities';

/** 유닛 하나의 고유 능력 진행 상태 */
export class AbilityState {
  attackCount = 0;
  firstStrikeUsed = false;
  /** 붙잡기 남은 쿨타임. 0이면 바로 쓸 수 있다 (소환 직후 사용 가능) */
  grabCooldown = 0;
  growthTimer = 0;
  growthCount = 0;
  pulseTimer = 0;
  /** 태양 불꽃 타이머 */
  sunTimer = 0;

  /** 공격 한 번을 세고, every번째면 true */
  countAttack(every: number): boolean {
    this.attackCount++;
    return this.attackCount % every === 0;
  }

  /** 첫 공격이면 true를 돌려주고 소모한다 */
  consumeFirstStrike(): boolean {
    if (this.firstStrikeUsed) return false;
    this.firstStrikeUsed = true;
    return true;
  }
}

/** 시간이 흐르며 발동하는 능력이 전장에 접근하는 창구 */
export interface AbilityHost {
  readonly allies: readonly Fighter[];
  readonly enemies: readonly Fighter[];
  /** 살아 있는 영웅 (죽었으면 null) */
  readonly livingHero: Body | null;
  applyStun(target: Body, duration: number): void;
  dispelBuffs(target: Body, duration: number): void;
  /** 태양 불꽃: source 기준 반경 안 적 전체에 화상 */
  sunFlame(source: Fighter, radius: number): void;
}

/** 붙잡기·성장·버프 해제 펄스처럼 주기적으로 발동하는 능력 */
export class TimedAbilities {
  constructor(private readonly host: AbilityHost) {}

  update(dt: number): void {
    for (const f of [...this.host.allies, ...this.host.enemies]) {
      if (!f.alive) continue;
      this.growth(f, dt);
      this.dispelPulse(f, dt);
      this.sunFlame(f, dt);
      this.grab(f, dt);
    }
  }

  /** 성장: 기절과 무관하게 흐른다 */
  private growth(f: Fighter, dt: number): void {
    const g = f.ability.growth;
    if (!g) return;
    const st = f.abilityState;
    if (st.growthCount >= g.maxCount) return;
    st.growthTimer += dt;
    while (st.growthCount < g.maxCount && st.growthTimer >= g.interval - STATUS.epsilon) {
      st.growthTimer -= g.interval;
      st.growthCount++;
      f.grow(g.multiplier, g.sizeMultiplier);
    }
  }

  /** 반경 안 상대 편(영웅 포함)에게 버프 해제. 기절 중에는 쓰지 못하고 대기한다 */
  private dispelPulse(f: Fighter, dt: number): void {
    const p = f.ability.dispelPulse;
    if (!p) return;
    const st = f.abilityState;
    st.pulseTimer = Math.min(p.interval, st.pulseTimer + dt);
    if (st.pulseTimer < p.interval - STATUS.epsilon || f.status?.stunned) return;
    st.pulseTimer = 0;
    const foes: Body[] = f.team === 'enemy' ? [...this.host.allies] : [...this.host.enemies];
    if (f.team === 'enemy' && this.host.livingHero) foes.push(this.host.livingHero);
    for (const b of foes) {
      if (b.alive && Math.abs(b.x - f.x) <= p.radius) this.host.dispelBuffs(b, p.duration);
    }
  }

  /** 태양 불꽃(삼족오 각성): 주기마다 반경 안 적 전체에 화상. 기절 중에는 쓰지 못하고 대기한다 */
  private sunFlame(f: Fighter, dt: number): void {
    const s = f.ability.sunFlame;
    if (!s) return;
    const st = f.abilityState;
    st.sunTimer = Math.min(s.interval, st.sunTimer + dt);
    if (st.sunTimer < s.interval - STATUS.epsilon || f.status?.stunned) return;
    st.sunTimer = 0;
    this.host.sunFlame(f, s.radius);
  }

  /** 붙잡기: 사거리 안(근접이라 비행 제외)에서 가장 앞(x가 큰)의 적 하나 */
  private grab(f: Fighter, dt: number): void {
    const g = f.ability.grab;
    if (!g) return;
    const st = f.abilityState;
    st.grabCooldown = Math.max(0, st.grabCooldown - dt);
    if (st.grabCooldown > STATUS.epsilon || f.status?.stunned) return;
    let front: Fighter | null = null;
    for (const e of this.host.enemies) {
      if (!e.alive || e.flying) continue;
      if (Math.abs(e.x - f.x) - e.radius > f.stats.range) continue;
      if (!front || e.x > front.x) front = e;
    }
    if (!front) return;
    this.host.applyStun(front, g.duration);
    st.grabCooldown = g.interval;
  }
}
