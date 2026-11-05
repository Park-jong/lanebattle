import { STAGES } from './stages';
import { COMBAT } from './combat';

export type BaseKind = 'gutdang' | 'ruinedShrine' | 'jangseungGate' | 'serpentGate' | 'ghostTree' | 'netherGate';
export type DamagePhase = 0 | 1 | 2 | 3;

export interface BaseAppearance {
  kind: BaseKind;
  name: string;
  shortName: string;
  chapter: number;
  variant: number;
  boss: boolean;
  width: number;
  height: number;
  roof: number;
  accent: number;
  glow: number;
}

const ENEMY_KINDS: readonly BaseKind[] = ['ruinedShrine', 'jangseungGate', 'serpentGate', 'ghostTree', 'netherGate'];
const SHORT_NAMES = ['폐사당', '장승문', '용문', '귀신목', '귀왕문'];
const ALLY_NAMES = ['장터 굿당', '서낭재 굿당', '나루 굿당', '대숲 굿당', '혼불 굿당'];
const ENEMY_NAMES = [
  ['등불 삼킨 폐사당', '솟대 아래 폐사당', '우물귀의 사당', '버려진 주막 사당', '원귀왕의 굿판'],
  ['장승 귀문', '돌무더기 귀문', '안개 서린 장승문', '부러진 장승 관문', '철갑 장승왕의 성문'],
  ['나루터 혼문', '메마른 이무기 수문', '침몰선의 귀문', '깊은 소의 용문', '강철이의 용문'],
  ['대숲 귀신나무', '죽순 뿌리 고목', '달그림자 원귀목', '미로의 귀신나무', '어둑시니의 둥지목'],
  ['혼불 귀왕문', '삼도천 저승문', '망자의 돌계단 문', '저승 궁문', '차사왕의 심판문'],
] as const;
const ROOFS = [0x3e6969, 0x4d6460, 0x405a6e, 0x3d6651, 0x4b536d];
const ENEMY_ACCENTS = [0x93649f, 0x8da27a, 0x5ba9ae, 0x8cab73, 0xb17a9f];

/** 기지의 외형만 결정한다. 스테이지 수치·전투 판정·저장 데이터와 독립적이다. */
export function baseAppearance(stage: number, team: 'ally' | 'enemy'): BaseAppearance {
  const def = STAGES[Math.max(0, Math.min(STAGES.length - 1, Math.floor(stage)))];
  const ch = def.chapter - 1;
  return {
    kind: team === 'ally' ? 'gutdang' : ENEMY_KINDS[ch],
    name: team === 'ally' ? ALLY_NAMES[ch] : ENEMY_NAMES[ch][def.order - 1],
    shortName: team === 'ally' ? '굿당' : SHORT_NAMES[ch],
    chapter: def.chapter, variant: def.order - 1, boss: def.isBossStage,
    width: team === 'ally' ? 196 : def.isBossStage ? 228 : 212,
    height: team === 'ally' ? 166 : def.isBossStage ? 190 : 180,
    roof: team === 'ally' ? ROOFS[ch] : [0x534357, 0x4c5554, 0x3c6771, 0x3a584a, 0x3c344d][ch],
    accent: team === 'ally' ? 0xd4ae65 : ENEMY_ACCENTS[ch],
    glow: team === 'ally' ? 0xffdc89 : [0xc68bef, 0xb8db9b, 0x78e1d6, 0xbde792, 0xc596ff][ch],
  };
}

export function baseDamagePhase(hp: number, maxHp: number): DamagePhase {
  const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
  return ratio <= 0 ? 3 : ratio <= 0.33 ? 2 : ratio <= 0.66 ? 1 : 0;
}

/** 큰 건축물이 화면 양 끝에서 잘리지 않도록 외형 중심만 보정한다. */
export function baseVisualCenter(combatX: number, width: number): number {
  return Math.max(width / 2 + 12, Math.min(COMBAT.battlefieldLength - width / 2 - 12, combatX));
}
