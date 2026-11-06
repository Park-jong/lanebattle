export interface ArtClip {
  frames: string[];
  fps: number;
  loop: boolean;
}

export interface CharacterArt {
  skinId?: 'default' | 'military';
  subjectKey: string;
  texture: string;
  image: string;
  atlas: string;
  origin: { x: number; y: number };
  bodyHeight: number;
  bodyWidth: number;
  /** Screen body height and overhead extent; independent of combat dimensions. */
  displayHeight?: number;
  displayTop?: number;
  canvas: { width: number; height: number };
  clips: Record<string, ArtClip>;
}

export const ART_MANIFEST_KEY = 'character-art-manifest';
export const MILITARY_MANIFEST_KEY = 'military-art-manifest';

/** Manifest is optional: a failed asset request keeps the original shapes usable. */
export function artList(raw: unknown): CharacterArt[] {
  if (!raw || typeof raw !== 'object' || !('characters' in raw) || !Array.isArray(raw.characters)) return [];
  return raw.characters.filter((v): v is CharacterArt => !!v && typeof v === 'object' &&
    typeof v.subjectKey === 'string' && typeof v.texture === 'string' && typeof v.image === 'string' &&
    typeof v.atlas === 'string' && Number.isFinite(v.bodyHeight) && v.bodyHeight > 0 &&
    Number.isFinite(v.bodyWidth) && v.bodyWidth > 0 && !!v.clips && !!v.origin && !!v.canvas &&
    (v.displayHeight === undefined || Number.isFinite(v.displayHeight) && v.displayHeight > 0) &&
    (v.displayTop === undefined || Number.isFinite(v.displayTop) && v.displayTop > 0) &&
    Number.isFinite(v.origin.x) && Number.isFinite(v.origin.y) &&
    Number.isFinite(v.canvas.width) && v.canvas.width > 0 && Number.isFinite(v.canvas.height) && v.canvas.height > 0);
}

export function artAssetUrl(path: string, base: string): string {
  return `${base}assets/characters/${path}`;
}

export function artFor(raw: unknown, subject: string, skin = 'default'): CharacterArt | undefined {
  const entries = artList(raw).filter((a) => a.subjectKey === subject);
  return entries.find(a => (a.skinId ?? 'default') === skin)
    ?? entries.find(a => (a.skinId ?? 'default') === 'default');
}

export function clipFrame(art: CharacterArt, name: string, age: number): string | undefined {
  const clip = art.clips[name] ?? art.clips.idle;
  if (!clip?.frames.length) return undefined;
  const index = Math.max(0, Math.floor(age * clip.fps));
  return clip.frames[clip.loop ? index % clip.frames.length : Math.min(index, clip.frames.length - 1)];
}

export function clipSeconds(art: CharacterArt, name: string): number {
  const clip = art.clips[name];
  return clip?.frames.length && clip.fps > 0 ? clip.frames.length / clip.fps : 0;
}
