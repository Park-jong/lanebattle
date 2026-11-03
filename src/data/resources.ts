// numbers.md 3장 자원
export const RESOURCES = {
  talisman: { start: 50, max: 200, chargePerSec: 8 },
  spirit: { start: 50, max: 100, chargePerSec: 5, perHeroHit: 2 },
  /** 기운 모으기: 단계별 비용, 단계마다 충전/최대치 증가 */
  gather: {
    costs: [60, 110, 160, 210, 260] as readonly number[],
    chargeBonusPerLevel: 3,
    maxBonusPerLevel: 60,
  },
} as const;
