import { describe, expect, it } from 'vitest';
import { POSSESSION_TUNING, type PossessionTuning } from '../data/possession';
import { possessionNodeId } from '../data/upgrades';
import { computeBuildEffects } from '../game/buildEffects';
import { Battle } from './battle';
import type { Fighter } from './entities';
import { PossessionSkillRunner } from './possession';
import { SeededRng } from './rng';

const HX = 1000;
const BIG_HP = 100000;

function make(unitId: string | null, levels: Record<string, number> = {}): Battle {
  const modifiers = computeBuildEffects({ ...(unitId ? { [possessionNodeId(unitId)]: 1 } : {}), ...levels });
  const b = new Battle({ stage: 0, rng: new SeededRng(1), modifiers });
  b.hero.x = HX;
  b.resources.spirit = b.resources.maxSpirit;
  return b;
}

function foe(b: Battle, id: string, dx: number): Fighter {
  const e = b.spawnEnemy(id, false, b.hero.x + dx);
  e.maxHp = e.hp = BIG_HP;
  return e;
}

const lost = (e: Fighter) => BIG_HP - e.hp;

describe('빙의 상향 배율 상수', () => {
  it('피해·화상·기본 공격 배율은 모두 1.5다', () => {
    expect(POSSESSION_TUNING).toEqual({ damageMultiplier: 1.5, burnMultiplier: 1.5, basicAttackMultiplier: 1.5 });
  });

  it('배율을 주입하면 스킬 피해·화상·충돌 피해가 비례해서 바뀐다 (표 기준값은 그대로)', () => {
    const tuning: PossessionTuning = { damageMultiplier: 2, burnMultiplier: 3, basicAttackMultiplier: 1 };
    // 여우불 연사: 기준 피해 40, 화상 8
    const b = make('foxfireArcher');
    const e = foe(b, 'geuseundae', 100);
    new PossessionSkillRunner(b, b.heroForm!.tags, tuning).run({
      name: 't',
      effects: [{ kind: 'hit', area: { kind: 'nearest', count: 1 }, type: 'ranged', damage: 40, burnPerSec: 8 }],
    });
    expect(lost(e)).toBe(80);
    expect(e.status!.burnDps).toBe(24);

    // 천하장사: 기준 피해 320, 충돌 40
    const s = make('sumoGoblin');
    const thrown = foe(s, 'geuseundae', 100);
    const hit = foe(s, 'geuseundae', 300);
    new PossessionSkillRunner(s, s.heroForm!.tags, tuning).run({
      name: 't',
      effects: [{ kind: 'hit', area: { kind: 'front', range: 250 }, type: 'melee', damage: 320, knockback: 200, collision: 40 }],
    });
    expect(lost(thrown)).toBe(640 + 80);
    expect(lost(hit)).toBe(80);
  });

  it('기본 공격 배율을 바꾸면 빙의 기본 공격력과 각성 충격파가 함께 바뀐다', () => {
    const saved = POSSESSION_TUNING.basicAttackMultiplier;
    try {
      POSSESSION_TUNING.basicAttackMultiplier = 2;
      const b = make('foxfireArcher');
      foe(b, 'geuseundae', 100);
      b.step(0.05);
      expect(b.projectiles[0].damage).toBe(50);

      const w = make('clubGoblin', { mudangAwakening: 1 });
      const e = foe(w, 'geuseundae', 40);
      let total = 0;
      for (let i = 0; i < 200 && total < 225; i++) {
        w.step(0.05);
        total = lost(e);
      }
      expect(total).toBeCloseTo(50 * 3 + 75);
    } finally {
      POSSESSION_TUNING.basicAttackMultiplier = saved;
    }
  });
});

describe('빙의하지 않은 상태는 상향의 영향이 없다', () => {
  it('기본 공격 25, 각성 충격파 25 x 3 + 37.5', () => {
    const b = make(null);
    const e = foe(b, 'geuseundae', 40);
    b.step(0.05);
    expect(lost(e)).toBe(25);

    const w = make(null, { mudangAwakening: 1 });
    const t = foe(w, 'geuseundae', 40);
    let total = 0;
    for (let i = 0; i < 100 && total < 100; i++) {
      w.step(0.05);
      total = lost(t);
    }
    expect(total).toBeCloseTo(112.5);
  });

  it('무당 부채 바람 30 피해·쿨타임 6, 작두 타기 쿨타임 40', () => {
    const b = make(null);
    const e = foe(b, 'geuseundae', 100);
    expect(b.castSkill('fanWind')).toBe('ok');
    expect(lost(e)).toBe(30);
    expect(b.skillCooldown('fanWind')).toBe(6);
    expect(b.skillCooldown('bladeDance')).toBe(0);
    b.resources.spirit = b.resources.maxSpirit;
    expect(b.castSkill('bladeDance')).toBe('ok');
    expect(b.skillCooldown('bladeDance')).toBe(40);
  });
});
