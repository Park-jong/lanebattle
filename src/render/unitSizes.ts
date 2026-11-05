import type { Team } from '../data/types';

/** 전투 판정과 분리한 표시 배율. 기존 1.3배를 하한으로 체격·역할에 맞춰 키운다. */
export const UNIT_DISPLAY_SCALES: Record<Team, Readonly<Record<string, number>>> = {
  ally: {
    clubGoblin: 1.3,
    oneLegGoblin: 1.4,
    sumoGoblin: 1.7,
    foxfireArcher: 1.3,
    gumiho: 1.5,
    bulgasari: 1.85,
    haetae: 1.8,
    samjokgo: 1.65,
    magpieFlock: 1.3,
    yeongdeungWind: 1.4,
  },
  enemy: {
    eggGhost: 1.3,
    waterGhostThrower: 1.3,
    maidenGhost: 1.45,
    jangseungSpirit: 1.7,
    eodduksini: 1.5,
    geuseundae: 1.5,
    sonGakshi: 1.4,
    grimReaper: 1.6,
    gangcheol: 1.8,
    dueoksini: 1.8,
  },
};
