import { COMBAT } from '../data/combat';
import type { Body } from './entities';
import type { AttackInfo } from './damage';

/** 피해 숫자 분류: 약점 적중 / 저항 적중 / 보통 / 면역(피해 0) / 화상 지속 피해 */
export type HitKind = 'weak' | 'resist' | 'normal' | 'immune' | 'burn';

/** 화면에 숫자를 띄우기 위한 피해 기록 */
export interface DamageEvent {
  target: Body;
  /** 맞은 시점의 x 좌표 */
  x: number;
  /** 표시할 피해량 (정수, 면역이면 0) */
  amount: number;
  kind: HitKind;
  /** 아군·영웅·서낭당이 받은 피해인지 */
  friendly: boolean;
  /** Snapshot of the hit, before knockback/death changes the target. Display only. */
  attack?: AttackInfo;
  attacker?: Body | null;
  attackerX?: number;
  impactRadius?: number;
  killed?: boolean;
}

/** 쌓아 둘 수 있는 기록 수 (화면이 비우지 않아도 끝없이 늘지 않게) */
const MAX_PENDING = 300;

/** 피해 기록을 모아 두었다가 비우며 돌려준다. 화상 피해는 대상별로 묶어서 일정 간격마다 한 번만 낸다 */
export class DamageFeed {
  private events: DamageEvent[] = [];
  private readonly burn = new Map<Body, number>();
  private burnTimer = 0;

  push(event: DamageEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_PENDING) this.events.splice(0, this.events.length - MAX_PENDING);
  }

  /** 화상 지속 피해를 쌓는다 */
  addBurn(target: Body, amount: number): void {
    this.burn.set(target, (this.burn.get(target) ?? 0) + amount);
  }

  /** 시간을 진행하고 간격이 차면 쌓인 화상 피해를 기록으로 내보낸다 */
  step(dt: number): void {
    this.burnTimer += dt;
    if (this.burnTimer < COMBAT.burnNumberInterval) return;
    this.burnTimer = 0;
    for (const [target, sum] of this.burn) {
      const amount = Math.round(sum);
      if (amount >= 1) {
        this.push({ target, x: target.x, amount, kind: 'burn', friendly: target.team === 'ally' });
        this.burn.delete(target);
      } else if (!target.alive) {
        this.burn.delete(target); // 죽은 대상의 자투리는 버린다
      }
      // 1 미만이면 다음 간격으로 넘겨 계속 쌓는다
    }
  }

  /** 쌓인 기록을 비우며 돌려준다 */
  drain(): DamageEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
