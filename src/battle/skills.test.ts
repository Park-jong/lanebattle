import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { Battle } from './battle';
import { SeededRng } from './rng';
import type { Fighter } from './entities';

const HX = 1000;
const BIG_HP = 100000;

/** 영웅을 가운데에 두고 신력을 가득 채운 전투 */
function setup(): Battle {
  const b = new Battle({ stage: 0, rng: new SeededRng(1) });
  b.hero.x = HX;
  b.resources.spirit = b.resources.maxSpirit;
  return b;
}

/** 맞아도 죽지 않도록 체력을 키운 적 */
function enemy(b: Battle, id: string, x: number): Fighter {
  const e = b.spawnEnemy(id, false, x);
  e.maxHp = e.hp = BIG_HP;
  return e;
}

function ally(b: Battle, id: string, x: number): Fighter {
  b.resources.talisman = 500;
  b.summon(ALLIES.findIndex((a) => a.id === id));
  const a = b.allies[b.allies.length - 1];
  a.x = x;
  return a;
}

const lost = (e: Fighter) => BIG_HP - e.hp;

describe('스킬 공통', () => {
  it('성공하면 신력을 쓰고 쿨타임이 시작된다', () => {
    const b = setup();
    expect(b.castSkill('fanWind')).toBe('ok');
    expect(b.skillCooldown('fanWind')).toBe(6);
    expect(b.castSkill('blessing')).toBe('ok');
    expect(b.skillCooldown('blessing')).toBe(12);
    expect(b.resources.spirit).toBe(b.resources.maxSpirit - 30 - 40);
    b.resources.spirit = b.resources.maxSpirit;
    expect(b.castSkill('bladeDance')).toBe('ok');
    expect(b.skillCooldown('bladeDance')).toBe(40);
    expect(b.resources.spirit).toBe(b.resources.maxSpirit - 80);
  });

  it('쿨타임 중이면 실패하고 소모가 없다', () => {
    const b = setup();
    b.castSkill('fanWind');
    const spirit = b.resources.spirit;
    expect(b.castSkill('fanWind')).toBe('cooldown');
    expect(b.resources.spirit).toBe(spirit);
    expect(b.skillCooldown('fanWind')).toBe(6);
  });

  it('신력이 부족하면 실패하고 쿨타임이 시작되지 않는다', () => {
    const b = setup();
    b.resources.spirit = 29;
    expect(b.castSkill('fanWind')).toBe('noSpirit');
    expect(b.resources.spirit).toBe(29);
    expect(b.skillCooldown('fanWind')).toBe(0);
  });

  it('영웅 사망, 기절, 전투 종료, 잘못된 ID는 실패한다', () => {
    const dead = setup();
    dead.hero.takeDamage(99999);
    expect(dead.castSkill('fanWind')).toBe('heroDead');
    const stunned = setup();
    stunned.applyStun(stunned.hero, 1);
    expect(stunned.castSkill('fanWind')).toBe('stunned');
    expect(stunned.resources.spirit).toBe(stunned.resources.maxSpirit);
    const ended = setup();
    ended.result = 'victory';
    expect(ended.castSkill('fanWind')).toBe('ended');
    expect(setup().castSkill('nope' as never)).toBe('invalidSkill');
  });

  it('쿨타임은 전투 시간으로 줄고 영웅이 죽어도 계속 줄어든다', () => {
    const b = setup();
    b.castSkill('fanWind');
    b.step(1);
    expect(b.skillCooldown('fanWind')).toBeCloseTo(5);
    b.hero.takeDamage(99999);
    b.step(1);
    expect(b.skillCooldown('fanWind')).toBeCloseTo(4);
  });

  it('스킬 적중은 신력을 충전하지 않는다', () => {
    const b = setup();
    enemy(b, 'geuseundae', HX + 50);
    b.resources.spirit = 100;
    b.castSkill('bladeDance');
    expect(b.resources.spirit).toBe(20);
  });
});

describe('부채 바람', () => {
  it('앞쪽만 맞는다 (오른쪽을 보고 있을 때)', () => {
    const b = setup();
    const front = enemy(b, 'geuseundae', HX + 100);
    const back = enemy(b, 'geuseundae', HX - 100);
    b.castSkill('fanWind');
    expect(lost(front)).toBeCloseTo(30);
    expect(lost(back)).toBe(0);
  });

  it('왼쪽을 보면 왼쪽만 맞는다', () => {
    const b = setup();
    b.step(0.1, { moveDir: -1 });
    expect(b.hero.facing).toBe(-1);
    const hx = b.hero.x;
    const front = enemy(b, 'geuseundae', hx - 100);
    const back = enemy(b, 'geuseundae', hx + 100);
    b.castSkill('fanWind');
    expect(lost(front)).toBeCloseTo(30);
    expect(lost(back)).toBe(0);
  });

  it('200 경계는 대상 반지름을 고려한다', () => {
    const b = setup();
    const inside = enemy(b, 'geuseundae', HX);
    inside.x = HX + 200 + inside.radius;
    const outside = enemy(b, 'geuseundae', HX + 200 + inside.radius + 1);
    b.castSkill('fanWind');
    expect(lost(inside)).toBeCloseTo(30);
    expect(lost(outside)).toBe(0);
  });

  it('넉백 80, 보스는 넉백이 없다', () => {
    const b = setup();
    const e = enemy(b, 'geuseundae', HX + 100);
    const boss = enemy(b, 'geuseundae', HX + 100);
    boss.stats.boss = true;
    b.castSkill('fanWind');
    expect(e.x).toBe(HX + 180);
    expect(boss.x).toBe(HX + 100);
  });

  it('비행 적에게 바람 x1.5, 갑옷 적에게 마법 x0.5, 무리 적에게 마법 x1.5', () => {
    const b = setup();
    const fly = enemy(b, 'eodduksini', HX + 50);
    const armor = enemy(b, 'jangseungSpirit', HX + 50);
    const swarm = enemy(b, 'eggGhost', HX + 50);
    b.castSkill('fanWind');
    expect(lost(fly)).toBeCloseTo(45);
    expect(lost(armor)).toBeCloseTo(15);
    expect(lost(swarm)).toBeCloseTo(45);
  });

  it('기지는 피해를 받지 않는다', () => {
    const b = setup();
    b.hero.x = b.castle.x - 50;
    const hp = b.castle.hp;
    b.castSkill('fanWind');
    expect(b.castle.hp).toBe(hp);
  });
});

describe('축원', () => {
  it('최대 체력 25%를 회복하고 공격력 +25% 버프가 6초 뒤 사라진다', () => {
    const b = setup();
    const a = ally(b, ALLIES[0].id, HX + 150);
    a.hp = 1;
    b.hero.hp = 1;
    b.castSkill('blessing');
    expect(a.hp).toBeCloseTo(1 + a.maxHp * 0.25);
    expect(b.hero.hp).toBeCloseTo(1 + b.hero.maxHp * 0.25);
    expect(a.status!.attackBonus).toBeCloseTo(0.25);
    expect(b.hero.status!.attackBonus).toBeCloseTo(0.25);
    b.step(5.9);
    expect(a.status!.attackBonus).toBeCloseTo(0.25);
    b.step(0.2);
    expect(a.status!.attackBonus).toBe(0);
  });

  it('회복 차단 중이면 회복이 없다', () => {
    const b = setup();
    b.hero.hp = 10;
    b.blockHeal(b.hero, 5);
    b.castSkill('blessing');
    expect(b.hero.hp).toBe(10);
  });

  it('버프 해제 중이면 버프가 걸리지 않는다', () => {
    const b = setup();
    b.dispelBuffs(b.hero, 5);
    b.castSkill('blessing');
    expect(b.hero.status!.attackBonus).toBe(0);
  });

  it('반경 밖 아군은 제외된다', () => {
    const b = setup();
    const near = ally(b, ALLIES[0].id, HX + 100);
    const far = ally(b, ALLIES[1].id, HX - 400);
    near.hp = far.hp = 1;
    b.castSkill('blessing');
    expect(near.hp).toBeGreaterThan(1);
    expect(far.hp).toBe(1);
    expect(far.status!.attackBonus).toBe(0);
  });
});

describe('작두 타기', () => {
  it('반경 300 안에 피해 200, 밖은 제외', () => {
    const b = setup();
    const inside = enemy(b, 'geuseundae', HX + 250);
    const behind = enemy(b, 'geuseundae', HX - 250);
    const outside = enemy(b, 'geuseundae', HX + 400);
    b.castSkill('bladeDance');
    expect(lost(inside)).toBeCloseTo(200);
    expect(lost(behind)).toBeCloseTo(200);
    expect(lost(outside)).toBe(0);
  });

  it('비행 적도 맞는다', () => {
    const b = setup();
    const fly = enemy(b, 'eodduksini', HX + 100);
    b.castSkill('bladeDance');
    expect(lost(fly)).toBeCloseTo(200);
  });

  it('1초 기절 뒤 다시 움직인다', () => {
    const b = setup();
    const e = enemy(b, 'geuseundae', HX + 250);
    b.castSkill('bladeDance');
    expect(e.status!.stunned).toBe(true);
    const x = e.x;
    b.step(0.5);
    expect(e.x).toBe(x);
    b.step(0.6);
    expect(e.status!.stunned).toBe(false);
    b.step(0.5);
    expect(e.x).toBeLessThan(x);
  });

  it('보스는 0.5초만 경직된다', () => {
    const b = setup();
    const boss = enemy(b, 'geuseundae', HX + 100);
    boss.stats.boss = true;
    b.castSkill('bladeDance');
    b.step(0.4);
    expect(boss.status!.stunned).toBe(true);
    b.step(0.2);
    expect(boss.status!.stunned).toBe(false);
  });

  it('기지는 피해를 받지 않는다', () => {
    const b = setup();
    b.hero.x = b.castle.x - 50;
    const hp = b.castle.hp;
    b.castSkill('bladeDance');
    expect(b.castle.hp).toBe(hp);
  });
});

describe('스킬 피해와 공격력 버프', () => {
  it('축원 버프가 있어도 스킬 피해는 고정 수치다', () => {
    const b = setup();
    b.castSkill('blessing');
    expect(b.hero.status!.attackBonus).toBeCloseTo(0.25);
    b.resources.spirit = b.resources.maxSpirit;
    const e = enemy(b, 'geuseundae', HX + 100);
    b.castSkill('bladeDance');
    expect(lost(e)).toBeCloseTo(200);
  });
});
