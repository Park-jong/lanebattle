import { describe, expect, it } from 'vitest';
import { Base, Projectile } from '../battle/entities';
import { createEnemy } from '../battle/enemyFactory';
import { Hero } from '../battle/hero';
import { BATTLEFIELD, BATTLE_LAYOUT } from '../scenes/layout';
import { BattlefieldProjection } from './battlefield';

describe('battlefield display projection', () => {
  it('sizes a mounted hero and overhead labels without changing combat or aiming at its flag', () => {
    const hero = new Hero();
    const original = { radius: hero.radius, hp: hero.hp, x: hero.x };
    const field = new BattlefieldProjection(() => 0, body =>
      body === hero && !hero.possessedId ? { height: 64, top: 78 } : undefined);
    expect(field.height(hero)).toBe(64);
    expect(field.top(hero)).toBe(field.ground(hero) - 78);
    const enemy = createEnemy('eggGhost', 0, false, 400);
    const shot = new Projectile('enemy', hero.x, hero, 10, 420, 'ranged',
      { attacker: enemy, tags: [], source: 'hero', attackBonus: 0, burnPerSec: 0, areaRadius: 0 });
    expect(field.projectile(shot).y).toBeCloseTo(field.ground(hero) - 64 * 0.55);
    expect({ radius: hero.radius, hp: hero.hp, x: hero.x }).toEqual(original);
    hero.possessedId = 'haetae';
    expect(field.height(hero)).toBe(40);
    expect(field.top(hero)).toBe(field.ground(hero) - 40);
  });
  it('keeps each unit on its row through movement, removal and new spawns without changing combat state', () => {
    const field = new BattlefieldProjection();
    const bodies = Array.from({ length: 7 }, (_, i) => createEnemy('eggGhost', 0, false, 400 + i * 25));
    const before = bodies.map((body) => ({ x: body.x, hp: body.hp, radius: body.radius }));
    const rows = bodies.map((body) => field.ground(body));
    expect(new Set(rows).size).toBeGreaterThan(1);
    bodies.forEach((body, i) => expect({ x: body.x, hp: body.hp, radius: body.radius }).toEqual(before[i]));
    bodies[1].x += 180;
    bodies[2].hp = 0;
    field.ground(createEnemy('eggGhost', 0, false, 900));
    for (const i of [6, 1, 4, 0]) {
      expect(field.ground(bodies[i])).toBe(rows[i]);
      expect(rows[i]).toBeGreaterThan(BATTLEFIELD.backY + 20);
      expect(rows[i]).toBeLessThan(BATTLEFIELD.frontY - 20);
    }
  });

  it('sorts sprites by their feet while keeping flying bodies and landing shadows on the same row', () => {
    const field = new BattlefieldProjection(() => 40);
    const flyer = createEnemy('eodduksini', 0, false, 800);
    const ground = field.ground(flyer), depth = field.depth(flyer);
    const flyingTop = field.top(flyer);
    flyer.setFlying(false);
    expect(field.ground(flyer)).toBe(ground);
    expect(field.depth(flyer)).toBe(depth);
    expect(field.top(flyer) - flyingTop).toBe(40);
    const other = createEnemy('eggGhost', 0, false, 800);
    expect(Math.sign(field.depth(other) - depth)).toBe(Math.sign(field.ground(other) - ground));
    expect(field.depth(other)).toBeLessThan(90);
    expect(BATTLEFIELD.frontY).toBeLessThan(BATTLE_LAYOUT.panel.y);
  });

  it('connects projectiles to the new target height and retains the launch point when the shooter moves', () => {
    const field = new BattlefieldProjection(() => 40);
    const shooter = new Hero();
    shooter.x = 300;
    const target = createEnemy('eodduksini', 0, false, 700);
    const shot = new Projectile('ally', shooter.x, target, 10, 420, 'ranged',
      { attacker: shooter, tags: [], source: 'hero', attackBonus: 0, burnPerSec: 0, areaRadius: 0 });
    const start = field.projectile(shot);
    expect(start.y).toBeCloseTo(field.top(shooter) + field.height(shooter) * 0.45);
    shooter.x = 120;
    expect(field.projectile(shot)).toEqual(start);
    shot.x = 500;
    const endY = field.top(target) + field.height(target) * 0.45;
    expect(field.projectile(shot).y).toBeCloseTo((start.y + endY) / 2);
    shot.x = target.x;
    expect(field.projectile(shot).y).toBeCloseTo(endY);
    const base = new Base('enemy', 1000, 1200, 70, 130);
    expect(field.top(base)).toBe(field.ground(base) - base.height);
  });
});
