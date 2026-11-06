import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Textures: { FilterMode: { NEAREST: 0 } }, BlendModes: { ADD: 1 } } }));
import { EffectRenderer } from './EffectRenderer';
import { BattlefieldProjection } from './battlefield';
import { Hero } from '../battle/hero';
import { Battle } from '../battle/battle';
import { Projectile } from '../battle/entities';
import { gameSkin } from '../game/skin';

function fixture(search = '', missing = false) {
  vi.stubGlobal('window', { location: { search } });
  const images: { visible: boolean; destroyed: boolean; texture: { key: string }; [key: string]: unknown }[] = [];
  const scene = {
    cameras: { main: { scrollX: 0, width: 960 } },
    textures: { exists: () => !missing, get: () => ({ setFilter: () => {} }) },
    add: { image: (_x: number, _y: number, texture: string) => {
      const node = { visible: true, destroyed: false, texture: { key: texture } } as typeof images[number];
      for (const method of ['setBlendMode', 'setFrame', 'setOrigin', 'setPosition', 'setScale', 'setFlipX', 'setRotation', 'setDepth', 'setAlpha', 'setTint', 'clearTint']) {
        node[method] = (...args: unknown[]) => { node[method + 'Args'] = args; return node; };
      }
      node.setVisible = (value: boolean) => { node.visible = value; return node; };
      node.setTexture = (value: string) => { node.texture.key = value; return node; };
      node.destroy = () => { node.destroyed = true; };
      images.push(node); return node;
    } },
  };
  const field = new BattlefieldProjection();
  const renderer = new EffectRenderer(scene as never, field);
  return { renderer, field, images };
}
afterEach(() => { vi.unstubAllGlobals(); gameSkin.set('default'); });

describe('combat VFX lifecycle', () => {
  it('emits once for a new melee attack, mirrors left, and reuses images after expiry', () => {
    const { renderer, images } = fixture();
    const hero = new Hero();
    renderer.beginFrame(0, [hero], [], true);
    hero.markAttack(0);
    renderer.beginFrame(.016, [hero], []);
    renderer.render();
    expect(renderer.playback.entries.map(fx => fx.clip)).toEqual(['slash']);
    expect(images).toHaveLength(2);
    expect(images[0].setFlipXArgs).toEqual([true]);
    for (let i = 0; i < 10; i++) renderer.beginFrame(.05, [hero], []);
    renderer.render();
    expect(renderer.playback.entries).toHaveLength(0);
    hero.markAttack(300);
    renderer.beginFrame(.016, [hero], []); renderer.render();
    expect(images).toHaveLength(2);
    renderer.destroy();
    expect(images.every(node => node.destroyed)).toBe(true);
  });

  it('separates projectile launch from actual impact and uses the hit snapshot x', () => {
    gameSkin.set('military');
    const { renderer } = fixture();
    const shooter = new Hero(), victim = new Hero(); victim.x = 300;
    renderer.beginFrame(0, [shooter, victim], [], true);
    const shot = new Projectile('ally', 130, victim, 20, 300, 'ranged', {
      tags: [], source: 'hero', attackBonus: 0, burnPerSec: 0, areaRadius: 0, attacker: shooter,
    });
    renderer.beginFrame(.016, [shooter, victim], [shot]);
    expect(renderer.playback.entries.map(fx => fx.clip)).toEqual(['muzzle']);
    renderer.hit({ target: victim, x: 280, amount: 20, kind: 'normal', friendly: false,
      attack: { type: 'ranged', tags: [], source: 'hero' }, attacker: shooter, attackerX: 130 });
    expect(renderer.playback.entries.find(fx => fx.clip === 'bullet')?.x).toBe(280);
  });

  it('shows a ranged launch even when the shot has already resolved within the simulation step', () => {
    gameSkin.set('military');
    const { renderer } = fixture();
    const battle = new Battle(); battle.spawnFreeAllies('foxfireArcher', 1);
    const archer = battle.allies[0];
    renderer.beginFrame(0, [archer], [], true);
    archer.markAttack(400);
    renderer.beginFrame(.016, [archer], []);
    expect(renderer.playback.entries.map(fx => fx.clip)).toEqual(['muzzle']);
  });

  it('shows one boss landing shockwave and identifies the source of pattern damage', () => {
    const { renderer } = fixture();
    const battle = new Battle({ stage: 19, bossAt: 0 }); battle.step(.01);
    const boss = battle.encounter!.boss!; boss.x = 350;
    renderer.beginFrame(0, [battle.hero, boss], [], true);
    boss.setFlying(false);
    renderer.beginFrame(.016, [battle.hero, boss], []);
    expect(renderer.playback.entries.filter(fx => fx.clip === 'slam')).toHaveLength(1);
    battle.drainDamageEvents();
    battle.dealFixedDamage(battle.hero, 10, { type: 'melee', tags: [], source: 'enemy' });
    const hit = battle.drainDamageEvents().find(event => event.target === battle.hero)!;
    expect(hit.attacker).toBe(boss);
    renderer.hit(hit);
    expect(renderer.playback.entries.filter(fx => fx.clip === 'slam')).toHaveLength(1);
  });

  it('keeps one status loop per body, freezes on pause, switches state and cleans up on removal', () => {
    const { renderer } = fixture();
    const hero = new Hero();
    hero.status!.applyBurn(5);
    renderer.beginFrame(0, [hero], [], true);
    renderer.beginFrame(.02, [hero], []);
    const flame = renderer.playback.entries.find(fx => fx.persistent)!;
    expect(flame.clip).toBe('flame');
    renderer.beginFrame(0, [hero], [], false, false);
    expect(flame.age).toBe(0);
    hero.status!.stun(1, false);
    renderer.beginFrame(.02, [hero], []);
    expect(renderer.playback.entries.filter(fx => fx.persistent).map(fx => fx.clip)).toEqual(['stun']);
    renderer.beginFrame(.02, [], []);
    expect(renderer.playback.entries.filter(fx => fx.persistent)).toHaveLength(0);
  });

  it('clears historical bursts during catch-up and never replays the skipped attack', () => {
    const { renderer, images } = fixture();
    const hero = new Hero();
    renderer.beginFrame(0, [hero], [], true);
    hero.markAttack(400);
    renderer.beginFrame(.02, [hero], []); renderer.render();
    hero.markAttack(400);
    renderer.beginFrame(.02, [hero], [], true); renderer.render();
    expect(renderer.playback.entries).toHaveLength(0);
    expect(images.every(image => !image.visible)).toBe(true);
    renderer.beginFrame(.02, [hero], []);
    expect(renderer.playback.entries).toHaveLength(0);
  });

  it('renders healing only after actual healing and ignores tiny regeneration', () => {
    const { renderer } = fixture();
    const hero = new Hero(); hero.hp = 100;
    renderer.beginFrame(0, [hero], [], true);
    hero.heal(.15); renderer.beginFrame(.05, [hero], []);
    expect(renderer.playback.entries).toHaveLength(0);
    hero.status!.blockHeal(2); hero.heal(60); renderer.beginFrame(.05, [hero], []);
    expect(renderer.playback.entries).toHaveLength(0);
    hero.status!.clear(); hero.heal(60); renderer.beginFrame(.05, [hero], []);
    expect(renderer.playback.entries.map(fx => fx.clip)).toEqual(['sparkle']);
  });

  it('distinguishes supportive possession skills from attacks and respects missing/off assets', () => {
    const { renderer } = fixture(); const hero = new Hero();
    renderer.cast(hero, { id: 'blessing', x: hero.x, facing: 1, range: 100, shape: 'circle',
      possessed: { unitId: 'clubGoblin', tint: 'dokkaebi' } });
    expect(renderer.playback.entries.map(fx => fx.clip)).toEqual(['rune', 'sparkle']);
    for (const fallback of [fixture('?vfx=off'), fixture('', true)]) {
      fallback.renderer.beginFrame(0, [hero], []);
      fallback.renderer.cast(hero, { id: 'bladeDance', x: hero.x, facing: 1, range: 300, shape: 'circle' });
      fallback.renderer.render();
      expect(fallback.images).toHaveLength(0);
    }
  });

  it('takes an immutable attack metadata snapshot and preserves projectile area radius', () => {
    const battle = new Battle();
    const victim = battle.spawnEnemy('eggGhost', false, 300);
    victim.hp = victim.maxHp = 10000;
    const tags: ('fire')[] = ['fire'];
    const shot = new Projectile('ally', 300, victim, 20, 300, 'magic', {
      tags, source: 'hero', attackBonus: 0, burnPerSec: 0, areaRadius: 70, attacker: battle.hero,
    });
    battle.projectiles.push(shot); battle.step(.01);
    tags.length = 0;
    const event = battle.drainDamageEvents().find(hit => hit.target === victim)!;
    expect(event.attack?.tags).toEqual(['fire']);
    expect(event.attacker).toBe(battle.hero);
    expect(event.impactRadius).toBe(70);
  });
});
