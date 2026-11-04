import { describe, expect, it } from 'vitest';
import { POSSESSION_SKILLS } from '../data/possession';
import { describePossessionSkill } from './skillText';

describe('빙의 스킬 툴팁', () => {
  it('이름·유닛·비용·쿨타임·효과 문구를 데이터에서 만든다 (여우불 연사)', () => {
    const t = describePossessionSkill('foxfireArcher', 'fanWind')!;
    expect(t.title).toBe('여우불 연사 (Q)');
    expect(t.lines[0]).toBe('빙의: 여우불 사수');
    expect(t.lines[1]).toBe('신력 12 / 쿨타임 3.6초');
    expect(t.lines[2]).toBe('가장 가까운 적 3명: 피해 40 + 화상 초당 8 (원거리)');
  });

  it('슬롯마다 공통 비용·쿨타임이 보인다 (W 16/7.2, E 32/24)', () => {
    expect(describePossessionSkill('gumiho', 'blessing')!.lines[1]).toBe('신력 16 / 쿨타임 7.2초');
    expect(describePossessionSkill('gumiho', 'bladeDance')!.lines[1]).toBe('신력 32 / 쿨타임 24초');
  });

  it('연속 타격은 간격·횟수·총 피해, 돌진·소환·버프도 문구가 나온다', () => {
    expect(describePossessionSkill('gumiho', 'bladeDance')!.lines[2]).toBe(
      '0.2초 간격 9회, 반경 300 적: 피해 45 + 화상 초당 6 (마법) (피해 총 405)',
    );
    expect(describePossessionSkill('oneLegGoblin', 'bladeDance')!.lines[2]).toBe(
      '앞으로 400 돌진, 지나간 길의 적: 피해 300 + 기절·붙잡기 1초 (근접)',
    );
    expect(describePossessionSkill('clubGoblin', 'blessing')!.lines[2]).toBe(
      '도깨비 방망이병 3마리 무료 소환 (아군 상한까지, 부적 미사용)',
    );
    expect(describePossessionSkill('clubGoblin', 'bladeDance')!.lines[2]).toBe(
      '10초간 도깨비 아군과 영웅 공격력 +50%, 공격 속도 +30%',
    );
    expect(describePossessionSkill('sumoGoblin', 'bladeDance')!.lines[2]).toBe(
      '앞쪽 250 범위 모든 적: 피해 320 + 넉백 200 + 밀려난 적이 부딪힌 적도 피해 40 (근접)',
    );
    expect(describePossessionSkill('gumiho', 'blessing')!.lines[2]).toBe(
      '반경 200 적: 기절·붙잡기 1.5초 + 감속 40% 4초 (마법)',
    );
  });

  it('15개 스킬 모두 이름이 제목에 들어가고 마지막 줄에 고정 피해 안내가 있다', () => {
    let count = 0;
    for (const [unitId, set] of Object.entries(POSSESSION_SKILLS)) {
      for (const [slot, skill] of Object.entries(set)) {
        const t = describePossessionSkill(unitId, slot as 'fanWind' | 'blessing' | 'bladeDance')!;
        expect(t.title).toContain(skill.name);
        expect(t.lines[t.lines.length - 1]).toContain('고정 수치');
        count++;
      }
    }
    expect(count).toBe(15);
  });

  it('스킬이 준비 중인 유닛(6~10)은 null', () => {
    expect(describePossessionSkill('bulgasari', 'fanWind')).toBeNull();
  });
});
