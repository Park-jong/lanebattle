import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { ABILITIES, getAbility } from '../data/abilities';
import { Battle } from './battle';
import { calcDamage, type AttackInfo } from './damage';
import { Projectile } from './entities';
import { SeededRng } from './rng';

const newBattle = (seed = 1) => {
  const b = new Battle({ stage: 0, rng: new SeededRng(seed) });
  // 웨이브가 섞이지 않게 끈다
  (b as unknown as { director: { update: () => [] } }).director = { update: () => [] };
  return b;
};
const idx = (id: string) => ALLIES.findIndex((a) => a.id === id);
const atk = (type: AttackInfo['type'], tags: AttackInfo['tags'] = []): AttackInfo => ({ type, tags, source: 'ally' });

/** 영웅을 멀리 치워 두고 아군 하나를 소환한다 */
function withAlly(b: Battle, id: string, x = 500) {
  b.hero.x = 1500;
  b.resources.talisman = 200;
  (b as unknown as { cooldowns: number[] }).cooldowns.fill(0);
  b.summon(idx(id));
  const ally = b.allies[b.allies.length - 1];
  ally.x = x;
  return ally;
}

describe('아군 고유 능력', () => {
  it('방망이병은 능력이 없다', () => {
    expect(getAbility('clubGoblin')).toEqual({});
    expect(getAbility('foxfireArcher')).toEqual({});
  });

  it('외다리 도깨비: 첫 공격 x3, 다음 공격은 x1', () => {
    const b = newBattle();
    withAlly(b, 'oneLegGoblin');
    const foe = b.spawnEnemy('jangseungSpirit', false, 510);
    b.step(0.05);
    expect(foe.hp).toBeCloseTo(400 - 18 * 3);
    b.step(1.1); // 1.0초 간격으로 한 번 더
    expect(foe.hp).toBeCloseTo(400 - 54 - 18);
  });

  it('씨름 도깨비: 3번째 공격마다 넉백 60 + 기절 0.5초', () => {
    const b = newBattle();
    withAlly(b, 'sumoGoblin');
    const foe = b.spawnEnemy('jangseungSpirit', false, 510);
    b.step(2.0); // 공격 2회 (0.05초, 1.25초)
    expect(foe.hp).toBeCloseTo(400 - 32);
    expect(foe.x).toBe(510);
    expect(foe.status!.stunned).toBe(false);
    b.step(0.6); // 3번째 공격 (2.45초)
    expect(foe.hp).toBeCloseTo(400 - 48);
    expect(foe.x).toBeCloseTo(570);
    expect(foe.status!.stunned).toBe(true);
    b.step(0.6);
    expect(foe.status!.stunned).toBe(false);
  });

  it('불가사리: 공격마다 방어 파괴 1중첩, 3중첩이면 갑옷이 무효', () => {
    const b = newBattle();
    withAlly(b, 'bulgasari');
    const foe = b.spawnEnemy('jangseungSpirit', false, 510);
    b.step(0.05);
    expect(foe.status!.defenseBreakStacks).toBe(1);
    // 1중첩: 갑옷 x0.5 x (1 + 0.1)
    expect(calcDamage(10, atk('ranged'), foe.damageTarget)).toBeCloseTo(5.5);
    b.step(2.7); // 공격 3회 (0.05, 1.35, 2.65초)
    expect(foe.status!.defenseBreakStacks).toBe(3);
    // 3중첩: 갑옷 무효, 받는 피해 +30%
    expect(calcDamage(10, atk('ranged'), foe.damageTarget)).toBeCloseTo(13);
  });

  it('해태: 8초마다 앞의 적을 2초 붙잡는다 (소환 직후 사용 가능)', () => {
    const b = newBattle();
    withAlly(b, 'haetae');
    const foe = b.spawnEnemy('jangseungSpirit', false, 520);
    b.step(0.05);
    expect(foe.status!.stunned).toBe(true);
    b.step(2.1); // 2.15초
    expect(foe.status!.stunned).toBe(false);
    b.step(5.7); // 7.85초: 아직 쿨타임
    expect(foe.status!.stunned).toBe(false);
    b.step(0.3); // 8.15초: 두 번째 붙잡기
    expect(foe.status!.stunned).toBe(true);
  });

  it('해태: 사거리 안에서 가장 앞(x가 큰) 적을 붙잡고, 비행은 제외', () => {
    const b = newBattle();
    withAlly(b, 'haetae', 500);
    const near = b.spawnEnemy('jangseungSpirit', false, 510);
    const front = b.spawnEnemy('jangseungSpirit', false, 520);
    const flyer = b.spawnEnemy('eodduksini', false, 530);
    b.step(0.05);
    expect(front.status!.stunned).toBe(true);
    expect(near.status!.stunned).toBe(false);
    expect(flyer.status!.stunned).toBe(false);
  });

  it('해태: 보스는 0.5초 경직으로 대체', () => {
    const b = newBattle();
    withAlly(b, 'haetae');
    const boss = b.spawnEnemy('jangseungSpirit', false, 520);
    boss.stats.boss = true;
    b.step(0.05);
    expect(boss.status!.stunned).toBe(true);
    b.step(0.5);
    expect(boss.status!.stunned).toBe(false);
  });

  it('삼족오: 반경 150 안 아군(영웅 포함)만 공격력 +20%', () => {
    const b = newBattle();
    withAlly(b, 'samjokgo', 500);
    const near = withAlly(b, 'clubGoblin', 600);
    const far = withAlly(b, 'clubGoblin', 700);
    const edge = withAlly(b, 'clubGoblin', 650);
    b.hero.x = 620;
    b.step(0.05);
    expect(near.status!.attackBonus).toBeCloseTo(0.2);
    expect(edge.status!.attackBonus).toBeCloseTo(0.2); // 정확히 150
    expect(far.status!.attackBonus).toBe(0);
    expect(b.hero.status!.attackBonus).toBeCloseTo(0.2);
  });

  it('영등 바람: 반경 180 안 아군 이동·공격 속도 +15%', () => {
    const b = newBattle();
    withAlly(b, 'yeongdeungWind', 500);
    const near = withAlly(b, 'clubGoblin', 680);
    const far = withAlly(b, 'clubGoblin', 700);
    b.step(0.05);
    expect(near.status!.attackSpeedBonus).toBeCloseTo(0.15);
    expect(near.status!.moveMultiplier).toBeCloseTo(1.15);
    expect(far.status!.attackSpeedBonus).toBe(0);
    expect(far.status!.moveMultiplier).toBe(1);
  });

  /** 적 투사체 하나를 대상 바로 앞에서 쏘고, 맞았는지(체력이 줄었는지) 돌려준다 */
  function shootAt(b: Battle, target: { x: number; hp: number; maxHp: number }): boolean {
    target.hp = target.maxHp;
    b.projectiles.push(
      new Projectile('enemy', target.x + 5, target as never, 10, 420, 'ranged', {
        tags: [],
        source: 'enemy',
        attackBonus: 0,
        burnPerSec: 0,
        areaRadius: 0,
      }),
    );
    b.step(0.05);
    return target.hp < target.maxHp;
  }

  it('영등 바람: 반경 안 아군을 노리는 적 투사체가 약 25% 빗나간다', () => {
    const b = newBattle(7);
    withAlly(b, 'yeongdeungWind', 500).status!.stun(1e6, false);
    const inside = withAlly(b, 'clubGoblin', 520);
    const outside = withAlly(b, 'clubGoblin', 700);
    for (const a of [inside, outside]) a.status!.stun(1000, false);
    let missIn = 0;
    let missOut = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      if (!shootAt(b, inside)) missIn++;
      if (!shootAt(b, outside)) missOut++;
    }
    expect(missIn / n).toBeGreaterThan(0.22);
    expect(missIn / n).toBeLessThan(0.28);
    expect(missOut).toBe(0);
  });

  it('영등 바람이 여럿이어도 빗나감 확률은 합산하지 않는다', () => {
    const b = newBattle(11);
    for (const x of [500, 505, 510]) withAlly(b, 'yeongdeungWind', x).status!.stun(1e6, false);
    const target = withAlly(b, 'clubGoblin', 520);
    target.status!.stun(1000, false);
    let miss = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (!shootAt(b, target)) miss++;
    expect(miss / n).toBeGreaterThan(0.22);
    expect(miss / n).toBeLessThan(0.28);
  });

  it('까치 떼: 비행 적에게 x2, 비행의 바람 x1.5와 곱해져 x3', () => {
    const b = newBattle();
    withAlly(b, 'magpieFlock');
    const flyer = b.spawnEnemy('eodduksini', false, 600);
    b.step(0.5);
    expect(flyer.hp).toBeCloseTo(80 - 7 * 2 * 1.5);

    const b2 = newBattle();
    withAlly(b2, 'magpieFlock');
    const egg = b2.spawnEnemy('eggGhost', false, 600);
    b2.step(0.5);
    expect(egg.hp).toBeCloseTo(70 - 7);
  });
});

describe('적 고유 능력', () => {
  it('물귀신 투척병: 맞은 대상 이동 속도 -30%, 2초', () => {
    const b = newBattle();
    const club = withAlly(b, 'clubGoblin', 500);
    const thrower = b.spawnEnemy('waterGhostThrower', false, 560);
    b.step(0.5);
    expect(club.status!.slowRatio).toBeCloseTo(0.3);
    expect(club.status!.moveMultiplier).toBeCloseTo(0.7);
    thrower.hp = 0;
    b.step(2.2);
    expect(club.status!.slowed).toBe(false);
  });

  it('손각시: 맞은 대상 회복 차단 4초', () => {
    const b = newBattle();
    const club = withAlly(b, 'clubGoblin', 500);
    const sonGakshi = b.spawnEnemy('sonGakshi', false, 560);
    b.step(0.6);
    expect(club.status!.healBlocked).toBe(true);
    expect(club.heal(10)).toBe(0);
    sonGakshi.hp = 0;
    b.step(4.2);
    expect(club.status!.healBlocked).toBe(false);
    expect(club.heal(10)).toBeGreaterThan(0);
  });

  it('저승사자: 6초마다 반경 120 안 아군(영웅 포함)의 버프를 3초 해제', () => {
    const b = newBattle();
    const inside = withAlly(b, 'clubGoblin', 1100);
    const outside = withAlly(b, 'clubGoblin', 1200);
    b.hero.x = 1115;
    for (const a of [inside, outside]) {
      a.status!.stun(1000, false);
      b.addBuff(a, { attack: 0.5 }, 1000);
    }
    b.addBuff(b.hero, { attack: 0.5 }, 1000);
    const reaper = b.spawnEnemy('grimReaper', false, 1000);
    b.step(5.9);
    expect(inside.status!.attackBonus).toBeCloseTo(0.5); // 아직 해제 전
    reaper.x = 1000;
    b.step(0.2); // 6초
    expect(inside.status!.attackBonus).toBe(0);
    expect(b.hero.status!.attackBonus).toBe(0);
    expect(outside.status!.attackBonus).toBeCloseTo(0.5);
    expect(b.addBuff(inside, { attack: 0.5 }, 1)).toBe(false); // 해제 중
    b.step(3.2); // 9.3초: 해제가 끝나고 다음 펄스(12초) 전
    expect(inside.status!.buffsDisabled).toBe(false);
  });

  it('처녀귀신: 근접 아군을 지나쳐 원거리 아군을 노린다', () => {
    const b = newBattle();
    const club = withAlly(b, 'clubGoblin', 500);
    const archer = withAlly(b, 'foxfireArcher', 440);
    club.status!.stun(1000, false);
    b.spawnEnemy('maidenGhost', false, 520);
    b.step(0.4);
    expect(club.hp).toBe(club.maxHp);
    expect(archer.hp).toBe(archer.maxHp);
    b.step(0.6);
    expect(club.hp).toBe(club.maxHp);
    expect(archer.hp).toBeLessThan(archer.maxHp);
  });

  it('처녀귀신: 근접 아군을 근접 아군이 공격할 수 있고, 사거리 안에 원거리가 없으면 전진한다', () => {
    const b = newBattle();
    const club = withAlly(b, 'clubGoblin', 500);
    const maiden = b.spawnEnemy('maidenGhost', false, 515);
    b.step(0.05);
    expect(club.hp).toBe(club.maxHp);
    expect(maiden.hp).toBeLessThan(maiden.maxHp); // 영체: 근접 x0.5 = 7
    expect(maiden.hp).toBeCloseTo(90 - 7);
    expect(maiden.x).toBeLessThan(515);
  });

  it('처녀귀신: 서낭당에 닿으면 서낭당을 공격하고, 기절·넉백에는 걸린다', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const maiden = b.spawnEnemy('maidenGhost', false, 120);
    b.step(0.05);
    expect(b.shrine.hp).toBe(1000 - 14);
    b.applyStun(maiden, 1);
    const x = maiden.x;
    b.step(0.5);
    expect(maiden.x).toBe(x);
    b.knockback(maiden, 60);
    expect(maiden.x).toBeCloseTo(x + 60);
  });

  it('그슨대: 5초마다 최대 체력·공격력 x1.15, 현재 체력도 같은 양 늘고 최대 6회', () => {
    const b = newBattle();
    const g = b.spawnEnemy('geuseundae', false, 2300);
    g.hp = 100;
    b.blockHeal(g, 1000); // 회복 차단과 무관해야 한다
    b.step(4.9);
    expect(g.maxHp).toBe(150);
    b.step(0.2); // 5초
    expect(g.maxHp).toBeCloseTo(172.5);
    expect(g.hp).toBeCloseTo(122.5);
    expect(g.attackPower).toBeCloseTo(16.1);
    expect(g.sizeScale).toBeCloseTo(1.08);
    expect(g.radius).toBeCloseTo(14 * 1.08);

    b.step(40); // 6회 이후에는 더 자라지 않는다
    expect(g.maxHp).toBeCloseTo(150 * 1.15 ** 6); // 346.96
    expect(g.hp).toBeCloseTo(100 + (150 * 1.15 ** 6 - 150)); // 296.96
    expect(g.attackPower).toBeCloseTo(14 * 1.15 ** 6); // 32.38
    expect(g.sizeScale).toBeCloseTo(1.08 ** 6);
    expect(g.abilityState.growthCount).toBe(ABILITIES.geuseundae.growth!.maxCount);
  });

  it('강철이: 불 태그 피해와 화상이 무효', () => {
    const b = newBattle();
    withAlly(b, 'foxfireArcher', 500);
    const gang = b.spawnEnemy('gangcheol', false, 560);
    b.step(0.6);
    expect(gang.hp).toBe(gang.maxHp);
    expect(gang.status!.burning).toBe(false);
    expect(calcDamage(10, atk('ranged', ['fire']), gang.damageTarget)).toBe(0);
    // 불이 아니면 맞는다 (갑옷 원거리 x0.5)
    expect(calcDamage(10, atk('ranged', ['wind']), gang.damageTarget)).toBe(5);
  });

  it('강철이: 구미호의 범위 피해도 0, 같이 맞은 다른 적은 피해와 화상', () => {
    const b = newBattle();
    withAlly(b, 'gumiho', 500);
    const egg = b.spawnEnemy('eggGhost', false, 600);
    const gang = b.spawnEnemy('gangcheol', false, 630);
    b.step(0.5);
    expect(egg.hp).toBeLessThan(egg.maxHp);
    expect(egg.status!.burning).toBe(true);
    expect(gang.hp).toBe(gang.maxHp);
    expect(gang.status!.burning).toBe(false);
  });

  it('두억시니: 유닛과 영웅을 무시하고 서낭당으로 직진한다', () => {
    const b = newBattle();
    const club = withAlly(b, 'clubGoblin', 590);
    club.status!.stun(1000, false);
    b.hero.x = 595;
    const demon = b.spawnEnemy('dueoksini', false, 600);
    b.step(1);
    expect(club.hp).toBe(club.maxHp);
    expect(b.hero.hp).toBe(b.hero.maxHp);
    expect(demon.x).toBeLessThan(600 - 50);
  });

  it('두억시니: 서낭당에 피해 x2, 아군은 정상적으로 공격할 수 있다', () => {
    const b = newBattle();
    b.hero.x = 140;
    const demon = b.spawnEnemy('dueoksini', false, 120);
    b.step(0.05);
    expect(b.shrine.hp).toBe(1000 - 60);
    expect(b.hero.hp).toBe(b.hero.maxHp);
    expect(demon.hp).toBeLessThan(demon.maxHp); // 영웅이 때림
  });

  it('두억시니: 넉백과 기절에는 걸린다', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const demon = b.spawnEnemy('dueoksini', false, 600);
    b.knockback(demon, 60);
    expect(demon.x).toBe(660);
    b.applyStun(demon, 1);
    b.step(0.5);
    expect(demon.x).toBe(660);
    b.step(1);
    expect(demon.x).toBeLessThan(660);
  });
});
