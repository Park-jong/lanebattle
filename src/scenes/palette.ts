import type { Tag } from '../data/types';
import type { SkillId } from '../data/skills';

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

// 메뉴 화면용 색 (한지 + 먹 + 오방색)
export const PAPER = 0xf3ead4;
export const PAPER_DARK = 0xd9cba6;
export const INK = 0x2b2622;
export const NIGHT = 0x14172b;
/** 오방색: 청 적 황 백 흑 */
export const FIVE_COLORS = [0x3b6fd4, 0xd9473b, 0xe0b52e, 0xf5f0e0, 0x1b1d26] as const;
/** 장(1~5)별 포인트 색 */
export function chapterColor(chapter: number): number {
  return FIVE_COLORS[(chapter - 1) % FIVE_COLORS.length];
}

// 전투 HUD 색
export const HUD_PANEL = 0x1a1e33;
export const HUD_STRIP = 0x10142a;
export const BUTTON_FILL = 0x2b2f48;
export const BUTTON_FILL_ACTION = 0x4a4a6b;
export const BUTTON_FILL_GATHER = 0x6b5a3a;
export const SHRINE_COLOR = 0xe0b52e;
export const HERO_COLOR = 0xf5f0e0;

/** 데미지 숫자 색 (css 문자열) */
export const FLOATER_COLORS = {
  weak: '#ffe040',
  resist: '#9aa0ad',
  normal: '#ffffff',
  friendly: '#ff5a5a',
  burn: '#ff9a3c',
  immune: '#8fd0ff',
} as const;

/** 스킬 버튼 테두리: 스킬 성격에 맞는 오방색 */
export const SKILL_COLORS: Record<SkillId, number> = {
  fanWind: TAG_COLORS.wind,
  blessing: TAG_COLORS.divine,
  bladeDance: TAG_COLORS.fire,
};
