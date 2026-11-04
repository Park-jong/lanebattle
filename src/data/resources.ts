// numbers.md 3장 자원
export const RESOURCES = {
  talisman: { start: 50, max: 200, chargePerSec: 8 },
  spirit: { start: 50, max: 100, chargePerSec: 5, perHeroHit: 2 },
  /**
   * 기운 모으기: 단계별 비용, 단계마다 충전/최대치 증가.
   * 기본은 baseMaxLevel단계까지이고, 6·7단계는 "큰 살림" 업그레이드로 열린다 (기존 수열을 이어 비용 +50씩)
   */
  gather: {
    costs: [60, 110, 160, 210, 260, 310, 360] as readonly number[],
    baseMaxLevel: 5,
    chargeBonusPerLevel: 3,
    maxBonusPerLevel: 60,
  },
} as const;
