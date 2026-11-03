import type { Tag } from '../data/types';

// docs/design.md 8번 오방색 규칙: 태그별 색
export const TAG_COLORS: Record<Tag, number> = {
  dokkaebi: 0x3b6fd4, // 청
  fire: 0xd9473b, // 적
  divine: 0xe0b52e, // 황
  wind: 0xcfe8f5, // 백
  hero: 0xf5f0e0,
};

/** 적(귀신)은 흑 (먹색·보라 톤) */
export const ENEMY_COLOR = 0x3d2f55;

function mix(a: number, b: number): number {
  const r = (((a >> 16) & 0xff) + ((b >> 16) & 0xff)) >> 1;
  const g = (((a >> 8) & 0xff) + ((b >> 8) & 0xff)) >> 1;
  const bl = ((a & 0xff) + (b & 0xff)) >> 1;
  return (r << 16) | (g << 8) | bl;
}

/** 두 태그면 두 색을 섞는다 */
export function colorForTags(tags: readonly Tag[]): number {
  if (tags.length === 0) return ENEMY_COLOR;
  return tags.map((t) => TAG_COLORS[t]).reduce(mix);
}
