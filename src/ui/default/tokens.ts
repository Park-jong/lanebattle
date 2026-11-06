import { skinText } from '../../game/skinText';
import { gameSkin } from '../../game/skin';
/** Shared layout tokens; cosmetic text follows the selected game skin. */
export const DEFAULT_UI = {
  font: '"Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif',
  displayFont: '"MidnightDisplay", "Malgun Gothic", system-ui, sans-serif',
  night: 0x111a2b,
  panel: 0x1c2a3c,
  panelRaised: 0x293c50,
  edge: 0x64788a,
  gold: 0xe8bd69,
  paper: 0xf4e9cf,
  paperShade: 0xe7d8b5,
  ink: 0x302c28,
  teal: 0x75c6b5,
  danger: 0xf08c7b,
  text: '#f4e9cf',
  muted: '#b8c6d2',
  darkText: '#302c28',
  goldText: '#f0cd89',
  goodText: '#98ddc3',
  dangerText: '#ffac9c',
} as const;

const UNIT_NAMES: Record<string, string> = {
  clubGoblin: '방망이병', oneLegGoblin: '외다리', sumoGoblin: '씨름꾼',
  foxfireArcher: '여우불', gumiho: '구미호', bulgasari: '불가사리',
  haetae: '해태', samjokgo: '삼족오', magpieFlock: '까치 떼', yeongdeungWind: '영등 바람',
};

export function unitShortName(id: string, fallback: string): string {
  return gameSkin.current === 'military' ? skinText(fallback) : UNIT_NAMES[id] ?? fallback;
}

/** Keep legible type; full skill names remain available in the detail panel. */
export function skillShortName(name: string): string {
  name = skinText(name);
  const short = name.length > 8 ? `${name.slice(0, 7)}…` : name;
  if (short.length <= 4) return short;
  const space = short.lastIndexOf(' ', 4);
  const at = space > 0 && short.length - space - 1 <= 4 ? space : 4;
  return `${short.slice(0, at).trim()}\n${short.slice(at).trim()}`;
}
