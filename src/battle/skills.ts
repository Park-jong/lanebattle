import { SKILLS, type SkillId } from '../data/skills';

export type CastResult = 'ok' | 'ended' | 'invalidSkill' | 'heroDead' | 'stunned' | 'cooldown' | 'noSpirit';

/** 화면 이펙트용 시전 기록 */
export interface SkillCastEvent {
  id: SkillId;
  x: number;
  /** 영웅이 바라본 방향 */
  facing: 1 | -1;
}

/** 스킬별 남은 쿨타임. 전투 시간(step)으로만 줄어든다 */
export class SkillCooldowns {
  private readonly remaining = new Map<SkillId, number>(SKILLS.map((s) => [s.id, 0]));

  get(id: SkillId): number {
    return this.remaining.get(id) ?? 0;
  }

  start(id: SkillId, seconds: number): void {
    this.remaining.set(id, seconds);
  }

  step(dt: number): void {
    for (const [id, t] of this.remaining) this.remaining.set(id, Math.max(0, t - dt));
  }
}
