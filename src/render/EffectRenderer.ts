import Phaser from 'phaser';
import { Body, Fighter, type Projectile } from '../battle/entities';
import { Hero } from '../battle/hero';
import type { DamageEvent } from '../battle/damageEvents';
import type { SkillCastEvent } from '../battle/skills';
import { ALLIES } from '../data/allies';
import { HERO } from '../data/hero';
import { possessionSkillsOf } from '../data/possession';
import { gameSkin, type GameSkin } from '../game/skin';
import { TAG_COLORS } from '../scenes/palette';
import { BattlefieldProjection } from './battlefield';
import { EffectPlayback, effectFrameIndex, type EffectId, type EffectInstance, type EffectRequest } from './effectPlayback';
import { PIXELFX } from './pixelfxManifest';

interface Nodes { color: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; }
interface BodyState { attack: number; healing: number; alive: boolean; flying: boolean; }

/** Sprite-only VFX, independent from character animation and combat rules. */
export class EffectRenderer {
  readonly playback = new EffectPlayback();
  private readonly nodes = new Map<number, Nodes>();
  private readonly free: Nodes[] = [];
  private readonly tracked = new Map<Body, BodyState>();
  private readonly statuses = new Map<Body, EffectInstance>();
  private readonly projectiles = new WeakSet<Projectile>();
  private readonly deaths = new WeakSet<Body>();
  private readonly lastHit = new WeakMap<Body, number>();
  private readonly lastBlast = new WeakMap<Body, number>();
  private readonly lastLaunch = new WeakMap<Body, number>();
  private readonly lastBossShock = new WeakMap<Body, number>();
  private clock = 0;
  private accepting = true;
  private shakeLeft = 0;
  private shakeAmplitude = 0;
  private readonly skin: GameSkin;
  private readonly enabled: boolean;

  constructor(private readonly scene: Phaser.Scene, private readonly field: BattlefieldProjection) {
    this.skin = gameSkin.current;
    this.enabled = new URLSearchParams(window.location.search).get('vfx') !== 'off';
    for (const page of PIXELFX.pages) {
      if (scene.textures.exists(page.texture)) scene.textures.get(page.texture).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  beginFrame(dt: number, bodies: readonly Body[], shots: readonly Projectile[], suppress = false, active = true): void {
    const elapsed = Math.min(.1, Math.max(0, dt));
    this.accepting = this.enabled && active && !suppress;
    this.clock += elapsed;
    this.shakeLeft = Math.max(0, this.shakeLeft - elapsed);
    this.playback.beginFrame(elapsed, PIXELFX.clips[this.skin]);
    if (suppress) { this.playback.clear(); this.statuses.clear(); this.shakeLeft = 0; }
    const present = new Set(bodies);
    for (const [body, previous] of this.tracked) {
      if (!present.has(body)) {
        if (previous.alive && !body.alive && this.accepting) this.death(body);
        this.tracked.delete(body);
      }
    }
    // Hero and boss get first choice of the limited persistent slots.
    const ordered = [...bodies].sort((a, b) => Number(b.kind === 'hero') - Number(a.kind === 'hero') || Number(b.isBoss) - Number(a.isBoss));
    for (const body of ordered) {
      const old = this.tracked.get(body);
      if (this.accepting) {
        if ((!old || !old.alive) && body.alive) this.arrive(body);
        if (old?.alive && !body.alive) this.death(body);
        if (body.alive && body.isBoss && old?.flying && !body.flying) this.bossShock(body);
        if (body.alive && old && old.attack !== body.visualAttack) this.attack(body);
        if (body.alive && old && body.visualHealing - old.healing >= Math.max(1, body.maxHp * .015)) {
          this.play({ clip: 'sparkle', x: body.x, y: this.chest(body), width: Math.min(70, this.field.height(body) * .7),
            depth: this.field.depth(body) + .3, alpha: .85, priority: body.kind === 'hero' ? 2 : 1 });
        }
      }
      this.tracked.set(body, { attack: body.visualAttack, healing: body.visualHealing, alive: body.alive, flying: body.flying });
    }
    for (const shot of shots) {
      if (this.projectiles.has(shot)) continue;
      this.projectiles.add(shot);
      const owner = shot.payload.attacker;
      if (!this.accepting || !owner) continue;
      const launch = this.field.projectile(shot);
      const facing = shot.target.x < shot.x ? -1 : 1;
      this.launch(owner, shot.attackType, shot.x, launch.y, facing);
    }
    // Removed, dead, dispelled or offscreen owners immediately release their loop.
    for (const [body, fx] of this.statuses) {
      const wanted = present.has(body) && body.alive && this.visible(body.x, 100) ? this.statusClip(body) : undefined;
      if (!wanted || fx.clip !== wanted || !this.playback.has(fx)) {
        this.playback.stop(fx); this.statuses.delete(body);
      }
    }
    if (this.accepting) for (const body of ordered) this.syncStatus(body);
  }

  private chest(body: Body): number { return this.field.ground(body) - this.field.elevation(body) - this.field.height(body) * .55; }
  private visible(x: number, radius: number): boolean {
    const camera = this.scene.cameras.main;
    return x + radius >= camera.scrollX && x - radius <= camera.scrollX + camera.width;
  }

  play(request: EffectRequest): EffectInstance | undefined {
    if (!this.accepting || !this.visible(request.x, request.width)) return;
    const clip = PIXELFX.clips[this.skin][request.clip];
    const first = clip.frames[0];
    if (!this.scene.textures.exists(first.color.texture) || !this.scene.textures.exists(first.glow.texture)) return;
    return this.playback.play(request);
  }

  private attack(body: Body): void {
    const profile = body instanceof Fighter ? body.stats : body instanceof Hero && body.possessedId
      ? ALLIES.find(ally => ally.id === body.possessedId) : undefined;
    const type = profile?.attackType ?? HERO.attack.type;
    const height = this.field.height(body), facing = body.visualTargetX < body.x ? -1 : 1;
    if (type !== 'melee') {
      // Also covers a close-range projectile that is fired and resolved within one simulation step.
      this.launch(body, type, body.x, this.chest(body), facing);
      return;
    }
    this.play({ clip: body.isBoss ? 'blades' : 'slash', x: body.x + facing * Math.min(35, this.field.width(body) * .45),
      y: this.chest(body), width: Math.min(body.isBoss ? 180 : 108, height * 1.1),
      depth: this.field.depth(body) + .2, facing, alpha: body.kind === 'hero' || body.isBoss ? .95 : .65,
      priority: body.kind === 'hero' || body.isBoss ? 2 : 1 });
  }

  private launch(owner: Body, type: 'ranged' | 'magic', x: number, y: number, facing: number): void {
    if (this.clock - (this.lastLaunch.get(owner) ?? -Infinity) < .035) return;
    this.lastLaunch.set(owner, this.clock);
    if (type === 'ranged' && this.skin === 'military') {
      this.play({ clip: 'muzzle', x: x + facing * this.field.width(owner) * .35, y,
        width: Math.min(52, this.field.height(owner) * .55), depth: this.field.depth(owner) + .2, facing });
    } else if (type === 'magic') {
      this.play({ clip: 'sparkle', x, y, width: 28, duration: .25, depth: this.field.depth(owner) + .2, alpha: .55 });
    }
  }

  hit(event: DamageEvent): void {
    if (!this.accepting || event.kind === 'burn') return;
    const body = event.target, previous = this.lastHit.get(body) ?? -Infinity;
    if (event.killed) this.death(body);
    if (this.clock - previous < .055) return;
    this.lastHit.set(body, this.clock);
    const attack = event.attack;
    const facing = event.attackerX !== undefined ? (event.x < event.attackerX ? -1 : 1) : (event.friendly ? -1 : 1);
    const guarded = event.kind === 'immune' || event.kind === 'resist';
    if (!guarded && event.attacker?.isBoss && !event.attacker.flying) this.bossShock(event.attacker);
    const clip: EffectId = guarded ? 'bullet' : attack?.type === 'magic' ? 'explosion' : attack?.type === 'ranged' ? 'bullet' : 'blunt';
    const weak = event.kind === 'weak', radius = event.impactRadius ?? 0;
    let width = Math.max(32, Math.min(76, this.field.height(body) * .75)) * (weak ? 1.18 : 1);
    if (guarded) width *= .65;
    if (radius > 0 && !guarded) {
      const source = event.attacker;
      if (source && this.clock - (this.lastBlast.get(source) ?? -Infinity) < .08) return;
      if (source) this.lastBlast.set(source, this.clock);
      width = Math.min(180, Math.max(80, radius * 2));
    }
    this.play({ clip, x: event.x, y: this.chest(body), width, facing,
      depth: this.field.depth(body) + .35, alpha: guarded ? .45 : weak ? 1 : .8,
      tint: guarded ? 0xa6c9e1 : attack?.tags.includes('fire') ? 0xffbb79 : undefined,
      duration: clip === 'explosion' && radius === 0 ? .32 : undefined,
      priority: event.attacker?.kind === 'hero' || event.attacker?.isBoss || body.isBoss ? 2 : 1 });
  }

  cast(hero: Hero, event: SkillCastEvent): void {
    if (!this.accepting) return;
    const ground = this.field.ground(hero), depth = this.field.depth(hero) + .4;
    if (event.possessed) {
      const effects = possessionSkillsOf(event.possessed.unitId)?.[event.id].effects ?? [];
      const offensive = effects.some(effect => effect.kind === 'hit' || effect.kind === 'repeat' || effect.kind === 'charge');
      const tint = TAG_COLORS[event.possessed.tint];
      if (!offensive) {
        this.play({ clip: 'rune', x: event.x, y: ground, width: Math.min(260, Math.max(100, event.range * 1.1)),
          depth: 7, priority: 2, duration: .8, alpha: .75, tint });
        this.play({ clip: 'sparkle', x: hero.x, y: this.chest(hero), width: 90, depth, priority: 2, tint });
        return;
      }
      const isFire = event.possessed.tint === 'fire';
      const clip = isFire ? 'explosion' : event.possessed.tint === 'wind' ? 'wind' : 'blades';
      const x = event.shape === 'fan' ? event.x + event.facing * event.range * .42 : event.x;
      this.play({ clip, x, y: ground - this.field.height(hero) * .3, width: Math.min(430, Math.max(120, event.range * 1.35)),
        depth, priority: 2, facing: event.facing, tint, alpha: .85 });
      if (event.id === 'bladeDance') this.shake(1.2);
      return;
    }
    if (event.id === 'fanWind') {
      this.play({ clip: 'wind', x: event.x + event.facing * event.range * .4, y: ground - 20,
        width: event.range * 1.2, height: Math.min(100, event.range * .45), depth, facing: event.facing, priority: 2 });
    } else if (event.id === 'blessing') {
      this.play({ clip: 'heal', x: event.x, y: ground, width: event.range * 2, depth: 7, priority: 2, alpha: .85 });
    } else {
      this.play({ clip: 'blades', x: event.x, y: this.chest(hero), width: Math.min(400, event.range * 1.15),
        depth, priority: 2, facing: event.facing, alpha: .72 });
      this.play({ clip: 'blades', x: event.x, y: this.chest(hero), width: Math.min(330, event.range),
        depth: depth + .01, priority: 2, facing: -event.facing, delay: .14, duration: .4, alpha: .42 });
      this.play({ clip: 'slam', x: event.x, y: ground, width: event.range * 1.7, height: 130, depth: 7, priority: 2, alpha: .6 });
      this.shake(1.4);
    }
  }

  private arrive(body: Body): void {
    this.deaths.delete(body);
    if (body.isBoss) {
      this.play({ clip: 'slam', x: body.x, y: this.field.ground(body), width: 270, height: 130, depth: 7, priority: 2, alpha: .75 });
      this.shake(1);
    } else if (body instanceof Hero && body.possessedId) {
      this.play({ clip: 'sparkle', x: body.x, y: this.chest(body), width: 110, depth: this.field.depth(body) + .2, priority: 2, tint: 0xffe6a0 });
    } else if (body.team === 'ally' && body.kind !== 'base') {
      this.play({ clip: 'sparkle', x: body.x, y: this.field.ground(body) - 8, width: 45,
        depth: this.field.depth(body) + .1, alpha: .5, duration: .45 });
    }
  }

  private bossShock(body: Body): void {
    if (this.clock - (this.lastBossShock.get(body) ?? -Infinity) < .2) return;
    this.lastBossShock.set(body, this.clock);
    this.play({ clip: 'slam', x: body.x, y: this.field.ground(body), width: 260, height: 115,
      depth: 7, priority: 2, alpha: .65 });
    if (this.visible(body.x, 150)) this.shake(1.3);
  }

  private death(body: Body): void {
    if (this.deaths.has(body) || body.kind === 'base') return;
    this.deaths.add(body);
    this.play({ clip: body.isBoss ? 'explosion' : 'poof', x: body.x, y: this.chest(body),
      width: Math.min(body.isBoss ? 260 : 85, this.field.height(body) * 1.15),
      depth: this.field.depth(body) + .4, priority: body.isBoss ? 2 : 0, alpha: body.isBoss ? .9 : .4 });
    if (body.isBoss) {
      this.play({ clip: 'slam', x: body.x, y: this.field.ground(body), width: 300, height: 140, depth: 7, priority: 2 });
      this.shake(1.6);
    }
  }

  private statusClip(body: Body): EffectId | undefined {
    if (body.status?.stunned) return 'stun';
    if (body.status?.burning) return 'flame';
    if ((body.status?.buffed && !body.status.buffsDisabled) || (body instanceof Hero && body.possessedId)) return 'rune';
    return;
  }

  private syncStatus(body: Body): void {
    const clip = body.alive && this.visible(body.x, 100) ? this.statusClip(body) : undefined;
    if (!clip) return;
    let fx = this.statuses.get(body);
    if (!fx) {
      fx = this.play({ clip, x: body.x, y: 0, width: 40, depth: 7, persistent: true, priority: 0,
        alpha: clip === 'rune' ? .28 : clip === 'flame' ? .65 : .9 });
      if (!fx) return;
      this.statuses.set(body, fx);
    }
    const width = this.field.width(body), height = this.field.height(body);
    fx.x = body.x;
    fx.y = clip === 'stun' ? this.field.top(body) - 6 : this.field.ground(body) - this.field.elevation(body);
    fx.width = clip === 'stun' ? Math.min(65, Math.max(32, width * .8))
      : clip === 'flame' ? Math.min(75, height * .6) : Math.max(38, Math.min(110, width * 1.5));
    if (clip === 'flame') fx.height = Math.min(90, height * .65);
    if (clip === 'rune') fx.height = fx.width * .55;
    fx.depth = clip === 'rune' ? 7 : this.field.depth(body) + .25;
  }

  private shake(amplitude: number): void { this.shakeLeft = .18; this.shakeAmplitude = amplitude; }
  get cameraOffset(): { x: number; y: number } {
    const amplitude = this.shakeAmplitude * Math.min(1, this.shakeLeft / .18);
    return { x: Math.sin(this.clock * 107) * amplitude, y: Math.cos(this.clock * 91) * amplitude * .5 };
  }

  render(): void {
    const live = new Set(this.playback.entries.map(fx => fx.id));
    for (const [id, pair] of this.nodes) if (!live.has(id)) {
      pair.color.setVisible(false); pair.glow.setVisible(false);
      this.free.push(pair); this.nodes.delete(id);
    }
    for (const fx of this.playback.entries) {
      const clip = PIXELFX.clips[this.skin][fx.clip];
      const frame = clip.frames[effectFrameIndex(clip, fx.age, fx.duration, fx.persistent)];
      let pair = this.nodes.get(fx.id);
      if (!pair) {
        pair = this.free.pop() ?? {
          color: this.scene.add.image(0, 0, frame.color.texture, frame.color.frame),
          glow: this.scene.add.image(0, 0, frame.glow.texture, frame.glow.frame).setBlendMode(Phaser.BlendModes.ADD),
        };
        this.nodes.set(fx.id, pair);
      }
      const duration = fx.duration ?? clip.duration;
      const fade = fx.persistent ? 1 : Math.min(1, Math.max(0, (duration - fx.age) / Math.min(.1, duration * .25)));
      for (const layer of ['color', 'glow'] as const) {
        const node = pair[layer], ref = frame[layer];
        if (node.texture.key !== ref.texture) node.setTexture(ref.texture, ref.frame); else node.setFrame(ref.frame);
        node.setOrigin(clip.origin[0], clip.origin[1]).setPosition(fx.x, fx.y)
          .setScale(fx.width / clip.width, fx.height !== undefined ? fx.height / clip.height : fx.width / clip.width)
          .setFlipX((fx.facing ?? 1) < 0).setRotation(fx.rotation ?? 0)
          .setDepth(fx.depth + (layer === 'glow' ? .001 : 0))
          .setAlpha((fx.alpha ?? 1) * fade * (layer === 'glow' ? .65 : 1)).setVisible(fx.age >= 0);
        if (fx.tint !== undefined) node.setTint(fx.tint); else node.clearTint();
      }
    }
  }

  destroy(): void {
    for (const pair of [...this.nodes.values(), ...this.free]) { pair.color.destroy(); pair.glow.destroy(); }
    this.nodes.clear(); this.free.length = 0; this.playback.clear(); this.tracked.clear(); this.statuses.clear();
  }
}
