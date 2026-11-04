// numbers.md 2장: 영웅 스킬 수치
export type SkillId = 'fanWind' | 'blessing' | 'bladeDance';

export interface SkillDef {
  id: SkillId;
  name: string;
  spiritCost: number;
  cooldown: number;
}

export const SKILLS: readonly SkillDef[] = [
  { id: 'fanWind', name: '부채 바람', spiritCost: 30, cooldown: 6 },
  { id: 'blessing', name: '축원', spiritCost: 40, cooldown: 12 },
  { id: 'bladeDance', name: '작두 타기', spiritCost: 80, cooldown: 40 },
];

/** 스킬별 효과 수치 */
export const SKILL_EFFECTS = {
  fanWind: { range: 200, damage: 30, knockback: 80 },
  blessing: { radius: 200, healRatio: 0.25, attackBonus: 0.25, duration: 6 },
  bladeDance: { radius: 300, damage: 200, stun: 1 },
} as const;

export function getSkill(id: SkillId): SkillDef {
  const def = SKILLS.find((s) => s.id === id);
  if (!def) throw new RangeError(`unknown skill: ${id}`);
  return def;
}
