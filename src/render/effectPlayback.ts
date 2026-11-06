import type { GameSkin } from '../game/skin';

export type EffectId = 'slash' | 'bullet' | 'blunt' | 'explosion' | 'muzzle' | 'wind' | 'heal'
  | 'blades' | 'slam' | 'rune' | 'flame' | 'stun' | 'sparkle' | 'poof';
export interface EffectFrame { color: { texture: string; frame: string }; glow: { texture: string; frame: string }; }
export interface EffectClip {
  duration: number; loop: boolean; width: number; height: number; origin: number[]; frames: EffectFrame[];
}
export interface EffectManifest {
  revision: string; seed: number;
  pages: { skin: string; texture: string; image: string; atlas: string; width: number; height: number }[];
  clips: Record<GameSkin, Record<EffectId, EffectClip>>;
}
export interface EffectRequest {
  clip: EffectId; x: number; y: number; width: number; height?: number; depth: number;
  priority?: number; facing?: number; rotation?: number; alpha?: number; tint?: number;
  duration?: number; delay?: number; persistent?: boolean;
}
export interface EffectInstance extends EffectRequest { id: number; age: number; priority: number; }
export const EFFECT_LIMITS = { total: 64, ordinary: 36, persistent: 16, ordinaryPerFrame: 12 } as const;

/** Bounded presentation clock. It never advances simulation time or consumes battle randomness. */
export class EffectPlayback {
  readonly entries: EffectInstance[] = [];
  private serial = 0;
  private emitted = 0;

  beginFrame(dt: number, manifest: Record<EffectId, EffectClip>): void {
    this.emitted = 0;
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const fx = this.entries[i];
      fx.age += elapsed;
      if (!fx.persistent && fx.age >= (fx.duration ?? manifest[fx.clip].duration)) this.entries.splice(i, 1);
    }
  }

  play(request: EffectRequest): EffectInstance | undefined {
    const priority = request.priority ?? 1;
    if (!Number.isFinite(request.x + request.y + request.width) || request.width <= 0) return;
    if (request.persistent && this.entries.filter(fx => fx.persistent).length >= EFFECT_LIMITS.persistent) return;
    if (priority < 2 && !request.persistent) {
      if (this.emitted >= EFFECT_LIMITS.ordinaryPerFrame ||
        this.entries.filter(fx => !fx.persistent && fx.priority < 2).length >= EFFECT_LIMITS.ordinary) return;
    }
    if (this.entries.length >= EFFECT_LIMITS.total) {
      const disposable = this.entries.findIndex(fx => !fx.persistent && fx.priority < priority);
      if (disposable < 0) return;
      this.entries.splice(disposable, 1);
    }
    const fx = { ...request, id: ++this.serial, age: -(request.delay ?? 0), priority };
    this.entries.push(fx);
    if (priority < 2 && !request.persistent) this.emitted++;
    return fx;
  }

  stop(fx: EffectInstance): void {
    const index = this.entries.indexOf(fx);
    if (index >= 0) this.entries.splice(index, 1);
  }
  has(fx: EffectInstance): boolean { return this.entries.includes(fx); }
  clear(): void { this.entries.length = 0; this.emitted = 0; }
}

export function effectFrameIndex(clip: EffectClip, age: number, duration = clip.duration, persistent = false): number {
  const time = Math.max(0, age) / Math.max(.001, duration);
  const phase = persistent && clip.loop ? time % 1 : Math.min(1, time);
  return Math.min(clip.frames.length - 1, Math.floor(phase * clip.frames.length));
}
