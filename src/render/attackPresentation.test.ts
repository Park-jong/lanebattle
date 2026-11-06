import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Base } from '../battle/entities';
import { Hero } from '../battle/hero';
import { artList, clipFrame } from './art';
import { anticipationFrame, attackDuration, attackFrameAge } from './attackPresentation';

const military = artList(JSON.parse(readFileSync('public/assets/characters/military-manifest.json', 'utf8')));
const shion = military.find(a => a.subjectKey === 'hero:kkomaMudang')!;
const original = artList(JSON.parse(readFileSync('public/assets/characters/manifest.json', 'utf8')))[0];
const at = (age: number, duration = .32) => clipFrame(shion, 'attack', attackFrameAge(shion, age, duration));

describe('Shion attack presentation', () => {
  it('matches immediate damage with contact, holds it, then plays every recovery frame', () => {
    expect(at(0)).toBe('attack_05');
    expect(at(.04)).toBe('attack_05');
    const visible = new Set(Array.from({ length: 20 }, (_, i) => at(i / 60)));
    for (let i = 5; i < 14; i++) expect(visible.has(`attack_${String(i).padStart(2, '0')}`)).toBe(true);
    expect(at(.32)).toBe('attack_13');
  });
  it('fits faster recovery and preparation inside the existing attack interval', () => {
    expect(attackDuration(shion, .6)).toBe(.32);
    expect(attackDuration(shion, .3)).toBeCloseTo(.195);
    expect(at(0, attackDuration(shion, .1))).toBe('attack_05');
    expect(attackDuration(original, .6)).toBe(.35);
    expect(attackFrameAge(original, 0, .35)).toBe(1 / original.clips.attack.fps);
  });
  it('prepares only for an eligible target during cooldown, without mutating combat', () => {
    const hero = new Hero();
    const target = new Base('enemy', hero.x + 55, 100, 20, 40);
    hero.attackCooldown = .1;
    const before = { cooldown: hero.attackCooldown, hp: target.hp, serial: hero.visualAttack };
    expect(anticipationFrame(shion, hero, [target])).toBe(2);
    expect({ cooldown: hero.attackCooldown, hp: target.hp, serial: hero.visualAttack }).toEqual(before);
    target.x += 100;
    expect(anticipationFrame(shion, hero, [target])).toBeUndefined();
    target.x = hero.x + 55;
    hero.visualMoving = true;
    expect(anticipationFrame(shion, hero, [target])).toBeUndefined();
    hero.visualMoving = false;
    hero.facing = -1;
    expect(anticipationFrame(shion, hero, [target])).toBeUndefined();
    hero.facing = 1;
    hero.status!.stun(1, false);
    expect(anticipationFrame(shion, hero, [target])).toBeUndefined();
    hero.status!.clear();
    target.hp = 0;
    expect(anticipationFrame(shion, hero, [target])).toBeUndefined();
  });
});
