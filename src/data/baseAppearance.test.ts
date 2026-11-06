import { describe, expect, it } from 'vitest';
import { baseAppearance, baseDamagePhase, baseVisualCenter } from './baseAppearance';
import { STAGES } from './stages';
import { COMBAT } from './combat';

describe('stage base presentation', () => {
  it('gives all 25 gates distinct enemy names and the five chapters distinct silhouettes', () => {
    const bases = STAGES.map((stage) => baseAppearance(stage.number, 'enemy'));
    expect(new Set(bases.map((base) => base.name)).size).toBe(25);
    expect(new Set(bases.map((base) => base.kind)).size).toBe(5);
    for (const stage of STAGES) {
      const enemy = bases[stage.number], ally = baseAppearance(stage.number, 'ally');
      expect(ally.kind).toBe('gutdang');
      expect(enemy.chapter).toBe(stage.chapter);
      expect(enemy.variant).toBe(stage.order - 1);
      expect(enemy.boss).toBe(stage.isBossStage);
      expect(enemy.shortName.length).toBeLessThanOrEqual(3);
      expect(enemy.width).toBeGreaterThan(COMBAT.castle.width * 2);
      expect(ally.width).toBeGreaterThan(COMBAT.shrine.width * 3);
      expect(baseAppearance(stage.number, 'enemy')).toEqual(enemy);
    }
  });

  it('shows cracks, critical damage and destruction at the right health thresholds', () => {
    expect(baseDamagePhase(1000, 1000)).toBe(0);
    expect(baseDamagePhase(661, 1000)).toBe(0);
    expect(baseDamagePhase(660, 1000)).toBe(1);
    expect(baseDamagePhase(330, 1000)).toBe(2);
    expect(baseDamagePhase(1, 1000)).toBe(2);
    expect(baseDamagePhase(0, 1000)).toBe(3);
    expect(baseDamagePhase(-15, 1000)).toBe(3);
    expect(baseDamagePhase(0, 0)).toBe(3);
  });

  it('keeps the larger silhouettes inside the battlefield without moving combat targets', () => {
    for (const stage of STAGES) for (const team of ['ally', 'enemy'] as const) {
      const style = baseAppearance(stage.number, team);
      const combat = team === 'ally' ? COMBAT.shrine : COMBAT.castle;
      const center = baseVisualCenter(combat.x, style.width);
      expect(center - style.width / 2).toBeGreaterThanOrEqual(12);
      expect(center + style.width / 2).toBeLessThanOrEqual(COMBAT.battlefieldLength - 12);
      expect(Math.abs(center - combat.x)).toBeLessThan(style.width / 2);
    }
    expect(COMBAT.shrine).toEqual({ x: 80, maxHp: 1000, width: 50, height: 90 });
    expect(COMBAT.castle).toEqual({ x: 2320, baseHp: 6000, hpPerStage: 750, width: 70, height: 130 });
  });
});
