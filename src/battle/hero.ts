import { HERO } from '../data/hero';
import { COMBAT } from '../data/combat';
import { Body } from './entities';

/** 영웅: 이동, 자동 공격 쿨타임, 사망과 부활 */
export class Hero extends Body {
  attackCooldown = 0;
  /** 부활까지 남은 시간. 살아 있으면 0 */
  respawnTimer = 0;

  constructor() {
    super('hero', 'ally', HERO.respawnX, HERO.maxHp, HERO.width / 2);
  }

  /** moveDir: -1 왼쪽, 0 정지, 1 오른쪽 */
  update(dt: number, moveDir: number): void {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.revive();
      return;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.heal(HERO.regenPerSec * dt); // 회복 차단 중이면 자연 회복도 막힌다
    const dir = this.status?.stunned ? 0 : moveDir;
    const next = this.x + dir * HERO.speed * (this.status?.moveMultiplier ?? 1) * dt;
    this.x = Math.min(COMBAT.castle.x, Math.max(COMBAT.shrine.x, next));
  }

  /** 사망 처리 시작. 부활 시간 = 4 + 위협 단계 (최대 10초) */
  beginRespawn(threatLevel: number): void {
    this.respawnTimer = Math.min(HERO.respawn.max, HERO.respawn.base + threatLevel);
  }

  get attackReady(): boolean {
    return this.alive && this.attackCooldown <= 0 && !this.status?.stunned;
  }

  private revive(): void {
    this.hp = this.maxHp;
    this.x = HERO.respawnX;
    this.respawnTimer = 0;
    this.attackCooldown = 0;
    this.status?.clear();
  }
}
