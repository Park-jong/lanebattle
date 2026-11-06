import { describe, expect, it } from 'vitest';
import { SkinPreference } from './skin';

describe('cosmetic skin preference', () => {
  it('persists a choice without touching campaign saves', () => {
    const values = new Map([['campaign', 'keep']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: () => {} };
    const skin = new SkinPreference(storage, 'skin');
    skin.toggle();
    expect(new SkinPreference(storage, 'skin').current).toBe('military');
    expect(values.get('campaign')).toBe('keep');
    expect(new SkinPreference(storage, 'skin', '?skin=default').current).toBe('default');
    expect(new SkinPreference(storage, 'skin', '?skin=unknown').current).toBe('military');
  });
  it('supports blocked storage and in-memory switching', () => {
    const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); }, removeItem: () => {} };
    const skin = new SkinPreference(blocked, 'skin', '?skin=military');
    expect(skin.current).toBe('military');
    skin.toggle();
    expect(skin.current).toBe('default');
  });
});
