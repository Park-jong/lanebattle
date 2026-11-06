import { describe, expect, it } from 'vitest';
import { getBossDef } from '../data/bosses';
import { COMBAT } from '../data/combat';
import { STAGES } from '../data/stages';
import { CHAPTER_ENEMIES, CHAPTER_THEME, STAGE_COUNT } from '../data/waves';
import { Battle } from './battle';
import { SeededRng } from './rng';
import { getStageDef, getStageInfo } from './stage';
import { availableEnemyIds } from './wave';

describe('스테이지 표 25개', () => {
  it('25개이고 번호가 0~24 순서다', () => {
    expect(STAGES).toHaveLength(25);
    expect(STAGES).toHaveLength(STAGE_COUNT);
    STAGES.forEach((s, i) => expect(s.number).toBe(i));
  });

  it.each(STAGES.map((s) => [s.number, s] as const))('스테이지 %i가 numbers.md 공식과 같다', (n, s) => {
    const chapter = Math.floor(n / 5) + 1;
    const order = (n % 5) + 1;
    const boss = order === 5;
    expect(s.chapter).toBe(chapter);
    expect(s.order).toBe(order);
    expect(s.code).toBe(`${chapter}-${order}`);
    expect(s.castleHp).toBe(6000 + 750 * n);
    expect(s.isBossStage).toBe(boss);
    expect(s.bossId).toBe(boss ? getBossDef(chapter).id : undefined);
    expect(s.waveCount).toBe(9);
    expect(s.firstWaveTime).toBe(5);
    expect(s.waveInterval).toBe(20);
    expect(s.threeStarSeconds).toBe(boss ? 300 : 200);
    expect(s.themeEnemyId).toBe(CHAPTER_THEME[chapter - 1]);
    expect(s.enemyIds).toEqual(CHAPTER_ENEMIES[chapter - 1].filter((e) => e.fromOrder <= order).map((e) => e.enemyId));
    expect(s.name.length).toBeGreaterThan(0);
    if (boss) expect(s.name).toContain(getBossDef(chapter).name);
  });

  it('이름이 서로 다르다', () => {
    expect(new Set(STAGES.map((s) => s.name)).size).toBe(25);
  });

  it('getStageInfo와 availableEnemyIds는 표를 따른다', () => {
    for (const s of STAGES) {
      expect(getStageInfo(s.number)).toEqual({ number: s.number, chapter: s.chapter, order: s.order, isBossStage: s.isBossStage });
      expect(availableEnemyIds(s.number)).toEqual(s.enemyIds);
    }
    expect(() => getStageDef(25)).toThrow(RangeError);
    expect(() => getStageDef(-1)).toThrow(RangeError);
    expect(() => getStageDef(1.5)).toThrow(RangeError);
  });

  it('Battle의 성 체력과 보스 여부가 표에서 온다', () => {
    for (const n of [0, 4, 9, 24]) {
      const b = new Battle({ stage: n, rng: new SeededRng(1) });
      expect(b.castle.maxHp).toBe(COMBAT.castle.baseHp + COMBAT.castle.hpPerStage * n);
      expect(b.encounter !== null).toBe(STAGES[n].isBossStage);
      if (b.encounter) expect(b.encounter.def.id).toBe(STAGES[n].bossId);
    }
  });
});
