import type { BuildTab } from '../../game/buildText';
import type { UpgradeNode } from '../../data/upgrades';

export type BuildSkin = 'default' | 'military';
export interface BuildTheme {
  id: BuildSkin;
  name: string;
  title: string;
  subtitle: string;
  bg: number;
  panel: number;
  raised: number;
  edge: number;
  accent: number;
  glow: number;
  text: string;
  muted: string;
  accentText: string;
  tabs: Record<BuildTab, string>;
}

export const BUILD_THEMES: Record<BuildSkin, BuildTheme> = {
  default: {
    id: 'default', name: '무속', title: '신명의 길', subtitle: '한밤의 힘을 깨우다',
    bg: 0x0b161a, panel: 0x122428, raised: 0x20383b, edge: 0x385557,
    accent: 0xe9bd73, glow: 0x75cbb7, text: '#f5ead4', muted: '#9bafaa', accentText: '#e9bd73',
    tabs: { mudang: '무당', yogoe: '요괴', yeongye: '연계', salim: '살림', order: '소환 순서' },
  },
  military: {
    id: 'military', name: '밀리터리', title: '택티컬 코어', subtitle: '전술 강화 시스템',
    bg: 0x0b111d, panel: 0x121e2e, raised: 0x223449, edge: 0x3b506a,
    accent: 0x8edce8, glow: 0x97edc2, text: '#e7f2fa', muted: '#9aacc0', accentText: '#8edce8',
    tabs: { mudang: '지휘관', yogoe: '병과', yeongye: '합동 전술', salim: '군수 지원', order: '배치 순서' },
  },
};

// Presentation only: stable upgrade IDs, costs and combat definitions stay in data/upgrades.
const MILITARY_NODES: Record<string, string> = {
  bellTraining: '대검 전투 교범', sturdyBody: '전투 체력 단련', quickRevive: '신속 재투입', spiritSpring: '축전 효율 개선',
  fanWindTornado: '브리치 웨이브: 확산 방출', fanWindGust: '브리치 웨이브: 고압 방출',
  blessingGrandRite: '리커버리 오더: 광역 구호', blessingSpiritRelease: '리커버리 오더: 총공세 지령',
  bladeDanceBlades: '제로 아워: 잔류 충격', bladeDancePossession: '제로 아워: 급속 재충전',
  mudangAwakening: '전자기 대검 출력 개방', deepSpirit: '예비 축전지', descent: '오버드라이브', ghostGate: '전면 동원',
  dokkaebiGatheringI: '돌격 편제 Ⅰ', dokkaebiGatheringII: '돌격 편제 Ⅱ', emberI: '소이 탄두 Ⅰ', emberII: '소이 탄두 Ⅱ',
  guardianVowI: '방호 협약 Ⅰ', guardianVowII: '방호 협약 Ⅱ', tailwindI: '기동 전술 Ⅰ', tailwindII: '기동 전술 Ⅱ',
  dokkaebiFire: '돌파 사격', guardFormation: '방호 진형', fireWind: '소이 확산', divineBlessing: '중장갑 지원',
  linkRing: '합동 데이터링크', hundredDemons: '통합 작전', generousStart: '초기 보급', charmPouch: '보급 한도',
  qiCycle: '보급 순환', thriftyLiving: '보급 효율', spoils: '전장 회수', bigEconomy: '보급망 확장', spiritCharm: '에너지 전환',
};

export const MILITARY_UNITS: Record<string, string> = {
  clubGoblin: '아카네', oneLegGoblin: '하야테', sumoGoblin: '미카', foxfireArcher: '아오이', gumiho: '쿠레하',
  bulgasari: '쿠로가네', haetae: '세이라', samjokgo: '레이카', magpieFlock: '히바리', yeongdeungWind: '후우카',
};

const MILITARY_CORE: Record<string, string> = {
  clubGoblin: '신속 증원', oneLegGoblin: '강화 돌파', sumoGoblin: '연속 제압', foxfireArcher: '소이탄 강화',
  gumiho: '폭발 범위', bulgasari: '장갑 파쇄', haetae: '제압 유지', samjokgo: '지휘 증폭',
  magpieFlock: '복수 배치', yeongdeungWind: '전파 증폭',
};
const MILITARY_AWAKEN: Record<string, string> = {
  clubGoblin: '추가 증원', oneLegGoblin: '관통 돌파', sumoGoblin: '충돌 제압', foxfireArcher: '다중 사격',
  gumiho: '3연속 포격', bulgasari: '장갑 회수', haetae: '광역 방호', samjokgo: '소이 지원',
  magpieFlock: '고속 요격', yeongdeungWind: '반사 교란',
};

export function buildNodeName(node: UpgradeNode, skin: BuildSkin): string {
  if (skin === 'default') return node.name;
  if (MILITARY_NODES[node.id]) return MILITARY_NODES[node.id];
  const unit = Object.keys(MILITARY_UNITS).find(id => node.id.startsWith(id));
  if (!unit) return node.name;
  if (node.possessionOf) return `직접 통제: ${MILITARY_UNITS[unit]}`;
  if (node.id.endsWith('Basic')) return '기초 전투 훈련';
  return (node.id.endsWith('Core') ? MILITARY_CORE[unit] : MILITARY_AWAKEN[unit]) ?? node.name;
}

const TERMS: [string, string][] = [
  ['거대 원귀', '하이브 마더'], ['철갑 장승왕', '저거너트'], ['이무기 강철이', '멜트다운'], ['어둑시니 대왕', '오버로드'], ['차사왕', '타이런트'],
  ['도깨비 방망이병', '아카네'], ['외다리 도깨비', '하야테'], ['씨름 도깨비', '미카'], ['여우불 사수', '아오이'],
  ['영등 바람', '후우카'], ['까치 떼', '히바리'], ['불가사리', '쿠로가네'], ['삼족오', '레이카'], ['구미호', '쿠레하'], ['해태', '세이라'],
  ['부채 바람', '브리치 웨이브'], ['작두 타기', '제로 아워'], ['축원', '리커버리 오더'],
  ['무당 트리', '지휘관 트리'], ['요괴 유닛', '병과'], ['살림 트리', '군수 지원 트리'], ['연계 트리', '합동 전술 트리'],
  ['신명', '강화 포인트'], ['엽전', '크레딧'], ['신력', '지휘 에너지'], ['부적', '보급'], ['기운 모으기', '보급 증강'],
  ['무당', '지휘관'], ['요괴', '병과'], ['빙의', '직접 통제'], ['강림', '오버드라이브'], ['귀문개방', '전면 동원'],
  ['방망이병', '아카네'], ['도깨비', '돌격'], ['신수', '방호'], ['바람 유닛', '기동 병과'],
];

/** Translate visible prose without mutating saved data or the combat model. */
export function buildCopy(text: string, skin: BuildSkin): string {
  if (skin === 'default') return text;
  return TERMS.reduce((result, [from, to]) => result.split(from).join(to), text);
}

export function shortNodeName(node: UpgradeNode, skin: BuildSkin): string {
  if (node.possessionOf) return skin === 'default' ? '빙의' : '직접 통제';
  const compact: Record<string, string> = skin === 'military' ? {
    bellTraining: '대검 교범', sturdyBody: '전투 단련', spiritSpring: '축전 효율', mudangAwakening: '출력 개방',
    deepSpirit: '예비 축전', linkRing: '데이터링크', bladeDancePossession: '급속 충전',
  } : {};
  if (compact[node.id]) return compact[node.id];
  const name = buildNodeName(node, skin);
  return name.includes(': ') ? name.split(': ')[1] : name;
}

export type BuildIcon = 'bell' | 'sword' | 'heart' | 'revive' | 'battery' | 'wind' | 'fan' | 'heal' | 'blades'
  | 'flame' | 'sun' | 'shield' | 'ghost' | 'link' | 'coin' | 'pouch' | 'cycle' | 'bolt' | 'gate'
  | 'medal' | 'target' | 'drone' | 'missile' | 'fist' | 'hammer' | 'lock' | 'question' | 'order' | 'crate' | 'shockwave';

export function unitIcon(id: string): BuildIcon {
  return ({ clubGoblin: 'sword', oneLegGoblin: 'bolt', sumoGoblin: 'fist', foxfireArcher: 'target', gumiho: 'missile',
    bulgasari: 'hammer', haetae: 'shield', samjokgo: 'drone', magpieFlock: 'missile', yeongdeungWind: 'wind' } as const)[id] ?? 'ghost';
}

export function nodeIcon(node: UpgradeNode, skin: BuildSkin): BuildIcon {
  if (node.finalStage) return node.finalStage === 'ghostGate' ? 'gate' : node.finalStage === 'descent' ? 'sun' : skin === 'military' ? 'target' : 'ghost';
  if (node.tree === 'yogoe') {
    if (node.id.endsWith('Basic')) return 'shield';
    if (node.id.endsWith('Awaken')) return 'medal';
    return unitIcon(Object.keys(MILITARY_UNITS).find(id => node.id.startsWith(id)) ?? '');
  }
  if (node.id.startsWith('fanWind')) return skin === 'default' ? node.id.endsWith('Tornado') ? 'fan' : 'wind'
    : node.id.endsWith('Tornado') ? 'wind' : 'shockwave';
  if (node.id.startsWith('blessing')) return node.id.endsWith('GrandRite') ? 'heal' : 'sword';
  if (node.id.startsWith('bladeDance')) return node.id.endsWith('Blades') ? 'blades' : 'cycle';
  if (/ember|Fire|fireWind/.test(node.id)) return 'flame';
  if (/guardian|guardFormation/.test(node.id)) return 'shield';
  if (/tailwind/.test(node.id)) return 'wind';
  if (/dokkaebi/.test(node.id)) return 'fist';
  return ({ bellTraining: skin === 'default' ? 'bell' : 'sword', sturdyBody: 'heart', quickRevive: 'revive',
    spiritSpring: skin === 'default' ? 'pouch' : 'battery', mudangAwakening: 'sun', deepSpirit: 'battery',
    divineBlessing: 'heal', linkRing: 'link', hundredDemons: 'gate', generousStart: skin === 'military' ? 'crate' : 'coin', charmPouch: skin === 'military' ? 'crate' : 'pouch',
    qiCycle: 'cycle', thriftyLiving: 'coin', spoils: 'medal', bigEconomy: 'gate', spiritCharm: 'bolt' } as const)[node.id] ?? 'link';
}
