import { STAGES } from '../../data/stages';

export const CHAPTER_TITLES = ['등불 장터', '장승 고개', '마른 나루', '달그림자 숲', '혼불 길'] as const;

/** Continue at the first uncleared stage; after clearing all, revisit a missing star. */
export function recommendedStage(stars: readonly number[]): number {
  const uncleared = STAGES.findIndex((_, i) => !(stars[i] > 0));
  if (uncleared >= 0) return uncleared;
  const missingStars = STAGES.findIndex((_, i) => stars[i] < 3);
  return missingStars >= 0 ? missingStars : STAGES.length - 1;
}
