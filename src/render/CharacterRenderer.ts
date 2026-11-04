import Phaser from 'phaser';
import { Body, Fighter, Projectile } from '../battle/entities';
import { Hero } from '../battle/hero';
import { HERO } from '../data/hero';
import type { SkillCastEvent } from '../battle/skills';
import { ART_MANIFEST_KEY, artFor, clipFrame, clipSeconds, type CharacterArt } from './art';

export function subjectOf(body: Body): string {
  if (body instanceof Hero) return 'hero:kkomaMudang';
  if (body instanceof Fighter) return `${body.isBoss ? 'boss' : body.team}:${body.defId}`;
  return '';
}

export function artInScene(scene: Phaser.Scene, subject: string): CharacterArt | undefined {
  const art = artFor(scene.cache.json.get(ART_MANIFEST_KEY), subject);
  return art && scene.textures.exists(art.texture) ? art : undefined;
}

export function addArtImage(scene: Phaser.Scene, subject: string, frame: string, x: number, y: number,
  width: number, height: number): Phaser.GameObjects.Image | undefined {
  const art = artInScene(scene, subject);
  if (!art || !scene.textures.get(art.texture).has(frame)) return undefined;
  return scene.add.image(x, y, art.texture, frame).setDisplaySize(width, height);
}

class CharacterView {
  private readonly sprite: Phaser.GameObjects.Image;
  private age = 0;
  private action = 'spawn';
  private actionAge = 0;
  private actionLength: number;
  private attackSerial: number;
  private hitLeft = 0;
  private dead = false;
  private deathAge = 0;
  private wasAlive = true;
  private lastX: number;
  private lastY = 0;
  private facing: 1 | -1;
  private drawn = true;
  private jitter = 0;

  constructor(private readonly body: Body, readonly art: CharacterArt, scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, art.texture, 'idle_00').setDepth(20);
    this.sprite.setOrigin(art.origin.x, art.origin.y);
    this.actionLength = Math.min(0.35, clipSeconds(art, 'spawn'));
    this.attackSerial = body.visualAttack;
    this.lastX = body.x;
    this.facing = body.team === 'ally' ? 1 : -1;
  }

  get isDrawn(): boolean { return this.drawn; }
  get finished(): boolean { return this.dead && this.deathAge >= 0.5; }

  hit(): void { this.hitLeft = 0.12; }

  special(clip: string): void {
    if (!this.dead && this.art.clips[clip]) {
      this.action = clip;
      this.actionAge = 0;
      this.actionLength = 0.4;
    }
  }

  update(dt: number, present: boolean, ground: number, lift: number): void {
    const body = this.body;
    if (body.alive && !this.wasAlive) {
      this.dead = false;
      this.deathAge = 0;
      this.action = 'spawn';
      this.actionAge = 0;
      this.actionLength = 0.35;
      this.hitLeft = 0;
    }
    this.wasAlive = body.alive;
    if (!body.alive || !present) this.dead = true;
    this.age += dt;
    this.hitLeft = Math.max(0, this.hitLeft - dt);
    if (this.dead) this.deathAge += dt;
    else {
      this.actionAge += dt;
      if (body.visualAttack !== this.attackSerial) {
        this.attackSerial = body.visualAttack;
        this.action = 'attack';
        this.actionAge = 0;
        const interval = body instanceof Fighter ? body.stats.attackInterval : HERO.attack.interval;
        this.actionLength = Math.max(0.1, Math.min(0.35, interval / (1 + (body.status?.attackSpeedBonus ?? 0)) * 0.75));
        this.facing = body.visualTargetX < body.x ? -1 : 1;
      } else if (body instanceof Hero && body.visualMoving && this.actionAge >= this.actionLength) this.facing = body.facing;
      else if (body instanceof Fighter && body.visualMoving && this.actionAge >= this.actionLength) this.facing = body.direction;
      else if (body instanceof Hero && this.actionAge >= this.actionLength) this.facing = body.facing;
      this.lastX = body.x;
      const height = body instanceof Fighter ? body.stats.height * body.sizeScale : HERO.height;
      this.lastY = ground - lift - (body.flying && this.art.origin.y === 0.5 ? height / 2 : 0);
    }
    let clip = body.visualMoving ? 'walk' : 'idle';
    if (body instanceof Fighter && body.defId === 'eodduksiniKing' && !body.flying && this.art.clips.ground_idle) clip = 'ground_idle';
    let frameAge = this.age;
    if (body.status?.stunned && !this.dead) { clip = 'idle'; frameAge = 0; }
    else if (this.actionAge < this.actionLength) {
      clip = this.action;
      const count = this.art.clips[clip]?.frames.length ?? 1;
      const start = clip === 'attack' ? 1 : 0;
      frameAge = (start + (count - start) * this.actionAge / Math.max(0.01, this.actionLength)) / (this.art.clips[clip]?.fps ?? 6);
    } else if (this.hitLeft > 0) { clip = 'hit'; frameAge = (0.12 - this.hitLeft) * 2; }
    if (this.dead) { clip = 'death'; frameAge = this.deathAge * clipSeconds(this.art, 'death') / 0.5; }
    const frame = clipFrame(this.art, clip, frameAge);
    this.drawn = !!frame && this.sprite.texture.has(frame);
    this.sprite.setVisible(this.drawn && !this.finished);
    if (!this.drawn) return;
    this.sprite.setFrame(frame!);
    const height = body instanceof Fighter ? body.stats.height * body.sizeScale : HERO.height;
    this.sprite.setScale(height / this.art.bodyHeight).setFlipX(this.facing < 0);
    if (dt > 0) this.jitter = this.hitLeft > 0 ? Math.sin(this.hitLeft * 130) * 1.5 : 0;
    this.sprite.setPosition(this.lastX + this.jitter, this.lastY);
    this.sprite.setAlpha(this.dead ? Math.max(0, 1 - this.deathAge / 0.5) : 1);
    if (this.hitLeft > 0) this.sprite.setTint(0xffbbb0);
    else this.sprite.clearTint();
  }

  destroy(): void { this.sprite.destroy(); }
}

interface Fx { image: Phaser.GameObjects.Image; art: CharacterArt; clip: string; age: number; duration: number; }

/** All display clocks are advanced manually, so pause/result overlays freeze them together. */
export class CharacterRenderer {
  private readonly views = new Map<Body, CharacterView>();
  private readonly shots = new Map<Projectile, Phaser.GameObjects.Image>();
  private effects: Fx[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  update(dt: number, bodies: Body[], ground: number, lift: (body: Body) => number): void {
    const present = new Set(bodies);
    for (const body of bodies) {
      if (this.views.has(body) || !body.alive) continue;
      const art = artInScene(this.scene, subjectOf(body));
      if (art && this.scene.textures.get(art.texture).has('idle_00')) this.views.set(body, new CharacterView(body, art, this.scene));
    }
    for (const [body, view] of this.views) {
      view.update(dt, present.has(body), ground, lift(body));
      if (view.finished && body.kind !== 'hero') { view.destroy(); this.views.delete(body); }
    }
    for (const fx of this.effects) {
      fx.age += dt;
      const frame = clipFrame(fx.art, fx.clip, fx.age / fx.duration * clipSeconds(fx.art, fx.clip));
      if (frame && fx.image.texture.has(frame)) fx.image.setFrame(frame);
      fx.image.setAlpha(Math.max(0, 1 - fx.age / fx.duration));
    }
    this.effects = this.effects.filter((fx) => { if (fx.age < fx.duration) return true; fx.image.destroy(); return false; });
  }

  shows(body: Body): boolean { return this.views.get(body)?.isDrawn ?? false; }
  hit(body: Body): void { this.views.get(body)?.hit(); }

  cast(hero: Body, event: SkillCastEvent, ground: number): void {
    const clip = { fanWind: 'skill_fan', blessing: 'skill_blessing', bladeDance: 'skill_blade' }[event.id];
    this.views.get(hero)?.special(clip);
    const fx = { fanWind: 'fx_fan', blessing: 'fx_blessing', bladeDance: 'fx_blade' }[event.id];
    const art = artInScene(this.scene, subjectOf(hero));
    if (!art?.clips[fx]) return;
    const frame = art.clips[fx].frames[0];
    if (!this.scene.textures.get(art.texture).has(frame)) return;
    const image = this.scene.add.image(event.x, ground - 20, art.texture, frame).setDepth(25)
      .setDisplaySize(Math.min(420, event.range * 1.6), Math.min(220, event.range)).setFlipX(event.facing < 0);
    this.effects.push({ image, art, clip: fx, age: 0, duration: 0.35 });
  }

  projectile(p: Projectile, ground: number, clock: number): boolean {
    const shooter = p.payload.attacker;
    const art = shooter ? artInScene(this.scene, subjectOf(shooter)) : undefined;
    const clip = art && Object.keys(art.clips).find((key) => key.startsWith('projectile_'));
    const frame = art && clip ? clipFrame(art, clip, clock) : undefined;
    if (!art || !frame || !this.scene.textures.get(art.texture).has(frame)) return false;
    let image = this.shots.get(p);
    if (!image) {
      image = this.scene.add.image(p.x, ground - 24, art.texture, frame).setDepth(24);
      this.shots.set(p, image);
    }
    image.setFrame(frame).setPosition(p.x, ground - 24).setDisplaySize(p.attackType === 'magic' ? 20 : 16, 14)
      .setFlipX(p.target.x < p.x);
    return true;
  }

  pruneProjectiles(alive: readonly Projectile[]): void {
    const living = new Set(alive);
    for (const [p, image] of this.shots) if (!living.has(p)) { image.destroy(); this.shots.delete(p); }
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy();
    for (const image of this.shots.values()) image.destroy();
    for (const fx of this.effects) fx.image.destroy();
    this.views.clear(); this.shots.clear(); this.effects = [];
  }
}
