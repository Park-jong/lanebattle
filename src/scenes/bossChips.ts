import type { BossDef } from '../data/bosses';

export interface ChipSpec {
  text: string;
  color: string;
  background: string;
}

/** 보스 약점(노란 칩)·저항(회색 칩) 표기. 전투 화면과 지도가 같이 쓴다 */
export function bossChipSpecs(def: Pick<BossDef, 'weaknessLabels' | 'resistanceLabels'>): ChipSpec[] {
  return [
    ...def.weaknessLabels.map((l) => ({ text: `약점: ${l}`, color: '#1a1a1a', background: '#ffd84a' })),
    ...def.resistanceLabels.map((l) => ({ text: `저항: ${l}`, color: '#1a1a1a', background: '#a0a0a0' })),
  ];
}
