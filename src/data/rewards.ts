// numbers.md 7장 별 조건, 8장 판 밖 재화 중 클리어 보상

export const STAR_RULES = {
  /** ★2: 서낭당 체력 비율이 이 값 이상 (경계 포함) */
  shrineHpRatio: 0.5,
  /** ★3 시간 비교 허용 오차(초). 틱 누적 오차 흡수용 */
  timeTolerance: 1e-6,
  maxStars: 3,
} as const;

export const CLEAR_REWARD = {
  /** 엽전 = (base + perChapter x (장-1) + perStar x 별) x (보스면 bossMultiplier), 소수는 내림 */
  yeopjeon: { base: 30, perChapter: 10, perStar: 10, bossMultiplier: 1.5 },
} as const;
