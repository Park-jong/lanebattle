import { browserStorage, type StorageLike } from './save';

export type GameSkin = 'default' | 'military';

/** Cosmetic preference is separate from campaign progress and test saves. */
export class SkinPreference {
  private value: GameSkin;
  constructor(private readonly storage: StorageLike | null, private readonly key: string, search = '') {
    const requested = new URLSearchParams(search).get('skin');
    let saved: string | null = null;
    try { saved = storage?.getItem(key) ?? null; } catch { /* Memory-only preference. */ }
    this.value = (requested === 'default' || requested === 'military' ? requested : saved) === 'military' ? 'military' : 'default';
  }
  get current(): GameSkin { return this.value; }
  set(value: GameSkin): void {
    this.value = value;
    try { this.storage?.setItem(this.key, value); } catch { /* Keep the current session usable. */ }
  }
  toggle(): void { this.set(this.value === 'default' ? 'military' : 'default'); }
}

const search = typeof window === 'undefined' ? '' : window.location.search;
export const gameSkin = new SkinPreference(browserStorage(), 'lane-defense.game-skin', search);
