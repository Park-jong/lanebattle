import { describe, expect, it } from 'vitest';
import { Battle } from './battle';

describe('read-only display state', () => {
  it('records a real attack once without repeating it throughout cooldown', () => {
    const b = new Battle();
    const target = b.spawnEnemy('eggGhost', false, b.hero.x + 10);
    b.step(0.016);
    expect(b.hero.visualAttack).toBe(1);
    expect(b.hero.visualTargetX).toBeCloseTo(target.x, 0);
    b.step(0.016);
    expect(b.hero.visualAttack).toBe(1);
  });
  it('marks movement only when the actor actually moves and clears it on stop', () => {
    const b = new Battle();
    b.step(0.016, { moveDir: 1 });
    expect(b.hero.visualMoving).toBe(true);
    b.step(0.016, { moveDir: 0 });
    expect(b.hero.visualMoving).toBe(false);
    expect(b.hero.visualAttack).toBe(0);
  });
});
