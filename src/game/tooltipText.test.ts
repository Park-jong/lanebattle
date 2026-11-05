import { describe, expect, it } from 'vitest';
import { noModifiers } from '../battle/modifiers';
import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { yogoeNodeIds } from '../data/upgrades';
import { computeBuildEffects } from './buildEffects';
import { placeTooltip } from './tooltipPlacement';
import { describeSkill, skillStatus } from './skillText';
import { describeUnit, summonStatus } from './unitText';
import { allyIndexForSlot, moveInOrder, defaultSummonOrder } from './summonOrder';

const text = (t: { title: string; lines: string[] }) => `${t.title}\n${t.lines.join('\n')}`;
const skill = (id: Parameters<typeof describeSkill>[0], levels: Record<string, number> = {}) =>
  text(describeSkill(id, computeBuildEffects(levels)));

describe('describeSkill 기본', () => {
  it('부채 바람 (Q): 30 / 6초 / 범위 200 / 넉백 80', () => {
    const t = skill('fanWind');
    expect(t).toContain('부채 바람 (Q)');
    for (const s of ['신력 30', '쿨타임 6초', '범위 200', '피해 30', '넉백 80']) expect(t).toContain(s);
    expect(t).not.toContain('갈래');
  });

  it('축원 (W): 40 / 12초 / 반경 200 / 25% / 25%(6초)', () => {
    const t = skill('blessing');
    expect(t).toContain('축원 (W)');
    for (const s of ['신력 40', '쿨타임 12초', '반경 200', '체력 25% 회복', '공격력 +25%(6초)']) expect(t).toContain(s);
  });

  it('작두 타기 (E): 80 / 40초 / 반경 300 / 피해 200 / 기절 1초', () => {
    const t = skill('bladeDance');
    expect(t).toContain('작두 타기 (E)');
    for (const s of ['신력 80', '쿨타임 40초', '반경 300', '피해 200', '기절 1초']) expect(t).toContain(s);
    expect(t).not.toContain('추가 피해');
  });
});

describe('describeSkill 갈래', () => {
  it('회오리: 범위 300', () => {
    const t = skill('fanWind', { fanWindTornado: 1 });
    expect(t).toContain('범위 300');
    expect(t).toContain('갈래: 회오리');
  });
  it('돌풍: 피해 60, 넉백 120', () => {
    const t = skill('fanWind', { fanWindGust: 1 });
    expect(t).toContain('피해 60, 넉백 120');
    expect(t).toContain('갈래: 돌풍');
  });
  it('큰 굿: 반경 300, 체력 40% 회복', () => {
    const t = skill('blessing', { blessingGrandRite: 1 });
    expect(t).toContain('반경 300, 최대 체력 40% 회복');
    expect(t).toContain('갈래: 큰 굿');
  });
  it('신명 풀이: 공격력 +75%(6초)', () => {
    const t = skill('blessing', { blessingSpiritRelease: 1 });
    expect(t).toContain('공격력 +75%(6초)');
    expect(t).toContain('갈래: 신명 풀이');
  });
  it('칼날 춤: 3초간 초당 40 추가 피해', () => {
    const t = skill('bladeDance', { bladeDanceBlades: 1 });
    expect(t).toContain('3초간 초당 40 추가 피해');
    expect(t).toContain('갈래: 칼날 춤');
  });
  it('신내림: 쿨타임 24초', () => {
    const t = skill('bladeDance', { bladeDancePossession: 1 });
    expect(t).toContain('쿨타임 24초');
    expect(t).toContain('갈래: 신내림');
  });
});

describe('skillStatus', () => {
  const ok = { heroAlive: true, stunned: false, cooldown: 0, spirit: 100, spiritCost: 40 };
  it('사용 가능', () => expect(skillStatus(ok)).toEqual({ text: '사용 가능', ok: true }));
  it('신력 부족', () => {
    expect(skillStatus({ ...ok, spirit: 12.7 })).toEqual({ text: '신력 부족 (현재 12/필요 40)', ok: false });
  });
  it('쿨타임', () => expect(skillStatus({ ...ok, cooldown: 3.25 }).text).toBe('쿨타임 3.3초'));
  it('사망은 다른 사유보다 먼저', () => {
    expect(skillStatus({ ...ok, heroAlive: false, stunned: true, cooldown: 2, spirit: 0 }).text).toBe('영웅 부활 중');
  });
  it('기절', () => expect(skillStatus({ ...ok, stunned: true }).text).toBe('기절 중'));
});

const unit = (id: string, levels: Record<string, number> = {}, key = '1') =>
  text(describeUnit(id, computeBuildEffects(levels), key));

describe('describeUnit 기본 (numbers.md 4장)', () => {
  const expected: Record<string, string[]> = {
    clubGoblin: ['도깨비', '근접', '부적 30', '쿨타임 1.5초', '체력 120', '공격력 14', '간격 0.8초', '사거리 20', '이동 속도 60', '고유 능력 없음'],
    oneLegGoblin: ['도깨비·바람', '부적 55', '쿨타임 4초', '체력 150', '공격력 18', '사거리 22', '이동 속도 110', '첫 공격 피해 x3'],
    sumoGoblin: ['부적 60', '쿨타임 5초', '체력 220', '공격력 16', '간격 1.2초', '이동 속도 55', '3번째 공격마다 넉백 60 + 기절 0.5초'],
    foxfireArcher: ['불', '원거리', '부적 50', '쿨타임 3초', '체력 70', '공격력 10', '사거리 180', '화상 초당 4'],
    gumiho: ['마법', '부적 120', '쿨타임 10초', '체력 160', '공격력 22', '간격 2초', '사거리 160', '반경 60', '화상 초당 6'],
    bulgasari: ['신수', '부적 110', '체력 300', '공격력 20', '간격 1.3초', '방어 파괴 1중첩 (최대 5중첩'],
    haetae: ['부적 140', '쿨타임 15초', '체력 700', '이동 속도 35', '8초마다 앞의 적 하나를 2초 붙잡음'],
    samjokgo: ['신수·불', '비행', '부적 150', '쿨타임 20초', '체력 180', '사거리 170', '반경 150', '공격력 +20%', '화상 초당 4'],
    magpieFlock: ['바람', '비행', '부적 25', '쿨타임 2초', '체력 50', '공격력 7', '간격 0.7초', '사거리 140', '이동 속도 80', '비행 적에게 피해 x2'],
    yeongdeungWind: ['부적 70', '쿨타임 8초', '체력 90', '사거리 150', '반경 180', '이동 속도 +15%', '공격 속도 +15%', '25% 빗나감', '반경 40'],
  };
  it('유닛 10종 모두 핵심 수치가 들어간다', () => {
    expect(Object.keys(expected).sort()).toEqual(ALLIES.map((a) => a.id).sort());
    for (const [id, needles] of Object.entries(expected)) {
      const t = unit(id);
      for (const n of needles) expect(t, `${id}: ${n}`).toContain(n);
      expect(t).not.toContain('강화:');
    }
  });
});

describe('describeUnit 업그레이드 반영', () => {
  it('① 기본 강화: 체력·공격 +25%', () => {
    const t = unit('clubGoblin', { [yogoeNodeIds('clubGoblin').basic]: 1 });
    expect(t).toContain('체력 150');
    expect(t).toContain('공격력 17.5');
    expect(t).toContain('강화: ①');
  });
  it('방망이병 ②: 비용 24, 쿨타임 1.05', () => {
    const ids = yogoeNodeIds('clubGoblin');
    const t = unit('clubGoblin', { [ids.basic]: 1, [ids.core]: 1 });
    expect(t).toContain('부적 24');
    expect(t).toContain('쿨타임 1.05초');
    expect(t).toContain('강화: ①②');
  });
  it('여우불 ②: 화상 초당 7', () => {
    const ids = yogoeNodeIds('foxfireArcher');
    const t = unit('foxfireArcher', { [ids.basic]: 1, [ids.core]: 1 });
    expect(t).toContain('화상 초당 7');
    expect(t).not.toContain('화상 초당 4');
  });
  it('해태 ②: 붙잡기 3.5초', () => {
    const ids = yogoeNodeIds('haetae');
    expect(unit('haetae', { [ids.basic]: 1, [ids.core]: 1 })).toContain('3.5초 붙잡음');
  });
  it('③ 각성은 문구 한 줄이 "각성:"으로 추가된다', () => {
    const ids = yogoeNodeIds('clubGoblin');
    const t = unit('clubGoblin', { [ids.basic]: 1, [ids.core]: 1, [ids.awaken]: 1 });
    expect(t).toContain('각성: 적 처치 시 10% 확률로');
    expect(t).toContain('강화: ①②③');
  });
  it('구미호 ②: 범위 84 (부동소수 오차 없음)', () => {
    const ids = yogoeNodeIds('gumiho');
    expect(unit('gumiho', { [ids.basic]: 1, [ids.core]: 1 })).toContain('반경 84 범위 피해');
  });
});

describe('describeUnit 키 표시', () => {
  it('소환 순서를 바꾸면 그 버튼의 키가 제목에 나온다', () => {
    const order = moveInOrder(defaultSummonOrder(), 'gumiho', -4);
    const slot = order.indexOf('gumiho');
    expect(slot).toBe(0);
    const id = ALLIES[allyIndexForSlot(order, 0)].id;
    expect(describeUnit(id, noModifiers(), String((slot + 1) % 10)).title).toBe('구미호 (1)');
    expect(describeUnit('clubGoblin', noModifiers(), '0').title).toBe('도깨비 방망이병 (0)');
  });
});

describe('summonStatus', () => {
  const ok = { allyCount: 3, maxAllies: COMBAT.maxAllies, cooldown: 0, talisman: 100, cost: 30 };
  it('소환 가능', () => expect(summonStatus(ok)).toEqual({ text: '소환 가능', ok: true }));
  it('부적 부족', () => {
    expect(summonStatus({ ...ok, talisman: 20.9 }).text).toBe('부적 부족 (현재 20/필요 30)');
  });
  it('쿨타임', () => expect(summonStatus({ ...ok, cooldown: 1.26 }).text).toBe('쿨타임 1.3초'));
  it('아군 최대', () => {
    expect(summonStatus({ ...ok, allyCount: COMBAT.maxAllies, cooldown: 2, talisman: 0 }).text).toBe(`아군 최대(${COMBAT.maxAllies})`);
  });
});

describe('placeTooltip', () => {
  const screen = { w: 960, h: 540 };
  const tip = { w: 280, h: 160 };
  it('버튼 위쪽 가운데에 놓는다', () => {
    const p = placeTooltip({ x: 400, y: 432, w: 66, h: 66 }, tip, screen);
    expect(p.x).toBe(400 + 33 - 140);
    expect(p.y).toBe(432 - 6 - 160);
  });
  it('오른쪽 끝 버튼은 화면 밖으로 잘리지 않는다', () => {
    const p = placeTooltip({ x: 880, y: 432, w: 66, h: 66 }, tip, screen);
    expect(p.x + tip.w).toBeLessThanOrEqual(screen.w - 4);
  });
  it('왼쪽 끝은 여백 안으로 민다', () => {
    expect(placeTooltip({ x: 0, y: 432, w: 66, h: 66 }, tip, screen).x).toBe(4);
  });
  it('위쪽이 모자라면 버튼 아래에 놓고 화면 안에 둔다', () => {
    const p = placeTooltip({ x: 100, y: 20, w: 66, h: 66 }, tip, screen);
    expect(p.y).toBe(20 + 66 + 6);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y + tip.h).toBeLessThanOrEqual(screen.h);
  });
  it('아래로도 넘치면 아래 끝에 맞춘다', () => {
    const p = placeTooltip({ x: 100, y: 400, w: 66, h: 66 }, { w: 280, h: 600 }, screen);
    expect(p.y).toBe(4);
  });
});
