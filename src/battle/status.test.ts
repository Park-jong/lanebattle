import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { STATUS } from '../data/status';
import { Battle } from './battle';
import { calcDamage, traitMultiplier, type AttackInfo, type DamageTarget } from './damage';
import { Projectile } from './entities';
import { SeededRng } from './rng';

const newBattle = () => new Battle({ stage: 0, rng: new SeededRng(1) });
const idx = (id: string) => ALLIES.findIndex((a) => a.id === id);
const atk = (type: AttackInfo['type'], tags: AttackInfo['tags'] = [], source: AttackInfo['source'] = 'ally'): AttackInfo => ({
  type,
  tags,
  source,
});
const target = (traits: DamageTarget['traits'] = [], extra: Partial<DamageTarget> = {}): DamageTarget => ({
  traits,
  ...extra,
});

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

describe('피해 계산', () => {
  it('순서: 버프 x 특성 x 보스 약점·저항 x 받는 피해 증감', () => {
    // 10 x 1.5(버프) x 1.5(영체+불) x 2(약점) x 0.2(저항) x (1 + 0.2 - 0.1)
    const t = target(['ghost'], {
      weakness: { tags: ['fire'] },
      resistance: { attackTypes: ['ranged'] },
      defenseBreakStacks: 2,
      damageReduction: 0.1,
    });
    expect(calcDamage(10, atk('ranged', ['fire']), t, { attackBonus: 0.5 })).toBeCloseTo(9.9);
  });

  it('약점이 여러 개 맞아도 x2는 한 번, 저항만 맞으면 x0.2', () => {
    const t = target([], { weakness: { attackTypes: ['magic'], tags: ['fire'] } });
    expect(calcDamage(10, atk('magic', ['fire']), t)).toBe(20);
    const r = target([], { resistance: { tags: ['hero'] } });
    expect(calcDamage(10, atk('melee', ['hero'], 'hero'), r)).toBeCloseTo(2);
  });

  it('최소 피해는 1, 받는 피해 감소는 70%까지', () => {
    expect(calcDamage(1, atk('melee'), target([], { resistance: { attackTypes: ['melee'] } }))).toBe(1);
    expect(calcDamage(100, atk('melee'), target([], { damageReduction: 0.9 }))).toBeCloseTo(30);
    // 방어 파괴 증가는 감소 상한과 별개로 더해진다
    expect(calcDamage(100, atk('melee'), target([], { damageReduction: 0.9, defenseBreakStacks: 2 }))).toBeCloseTo(50);
  });

  it('특성 배율: 무리/영체/갑옷/비행', () => {
    expect(traitMultiplier(atk('magic'), target(['swarm']))).toBe(1.5);
    expect(traitMultiplier(atk('ranged'), target(['swarm']))).toBe(1);
    expect(traitMultiplier(atk('melee'), target(['ghost']))).toBe(0.5);
    expect(traitMultiplier(atk('ranged', ['fire']), target(['ghost']))).toBe(1.5);
    expect(traitMultiplier(atk('melee', ['fire']), target(['ghost']))).toBe(0.75);
    expect(traitMultiplier(atk('ranged'), target(['armor']))).toBe(0.5);
    expect(traitMultiplier(atk('magic'), target(['armor']))).toBe(0.5);
    expect(traitMultiplier(atk('melee'), target(['armor']))).toBe(1);
    expect(traitMultiplier(atk('ranged', ['wind']), target(['flying']))).toBe(1.5);
    expect(traitMultiplier(atk('ranged', ['fire']), target(['flying']))).toBe(1);
  });

  it('갑옷은 방어 파괴 3중첩 이상이면 무효', () => {
    expect(traitMultiplier(atk('ranged'), target(['armor'], { defenseBreakStacks: 2 }))).toBe(0.5);
    expect(traitMultiplier(atk('ranged'), target(['armor'], { defenseBreakStacks: 3 }))).toBe(1);
    expect(calcDamage(10, atk('ranged'), target(['armor'], { defenseBreakStacks: 3 }))).toBeCloseTo(13);
  });

  it('지속 피해는 공격력 버프와 최소 1을 적용하지 않고 불 배율은 받는다', () => {
    expect(calcDamage(0.2, atk('magic', ['fire']), target(['ghost']), { dot: true, attackBonus: 5 })).toBeCloseTo(0.3);
    // 유형 배율(갑옷의 마법 x0.5)은 지속 피해에 적용되지 않는다
    expect(calcDamage(1, atk('magic', ['fire']), target(['armor']), { dot: true })).toBe(1);
    expect(calcDamage(1, atk('magic', ['fire']), target([], { defenseBreakStacks: 2 }), { dot: true })).toBeCloseTo(1.2);
  });

  it('영웅 공격은 근접 + 영웅 태그로 계산된다 (영체 x0.5)', () => {
    const b = newBattle();
    const ghost = b.spawnEnemy('maidenGhost', false, 140);
    b.step(0.05);
    expect(ghost.maxHp - ghost.hp).toBeCloseTo(12.5);
  });
});

describe('비행 타게팅', () => {
  it('근접 아군은 비행 적을 치지 않고 지나간다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'clubGoblin');
    const flyer = b.spawnEnemy('eodduksini', false, ally.x + 10);
    const x0 = ally.x;
    b.step(0.05);
    expect(flyer.hp).toBe(flyer.maxHp);
    expect(ally.x).toBeGreaterThan(x0);
  });

  it('영웅의 근접 공격도 비행 적을 치지 않는다', () => {
    const b = newBattle();
    const flyer = b.spawnEnemy('eodduksini', false, b.hero.x + 10);
    b.step(0.05);
    expect(flyer.hp).toBe(flyer.maxHp);
  });

  it('원거리 아군은 비행 적을 친다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'foxfireArcher');
    const flyer = b.spawnEnemy('eodduksini', false, ally.x + 100);
    b.step(1);
    expect(flyer.hp).toBeLessThan(flyer.maxHp);
  });

  it('아군 비행 유닛은 적 근접 공격의 대상이 아니지만 원거리 적에게는 맞는다', () => {
    const b = newBattle();
    const bird = withAlly(b, 'samjokgo');
    b.spawnEnemy('eggGhost', false, bird.x + 15);
    b.step(0.5);
    expect(bird.hp).toBe(bird.maxHp);

    const b2 = newBattle();
    const bird2 = withAlly(b2, 'samjokgo');
    b2.spawnEnemy('waterGhostThrower', false, bird2.x + 100);
    b2.step(1);
    expect(bird2.hp).toBeLessThan(bird2.maxHp);
  });
});

describe('마법 범위 피해', () => {
  it('투사체가 도착하면 대상 위치 반경 안의 적 모두(비행 포함)가 맞는다', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const main = b.spawnEnemy('eggGhost', false, 1000);
    const near = b.spawnEnemy('eggGhost', false, 1040);
    const flyer = b.spawnEnemy('eodduksini', false, 960);
    const far = b.spawnEnemy('eggGhost', false, 1100);
    const payload = { tags: ['fire'] as const, source: 'ally' as const, attackBonus: 0, burnPerSec: 6, areaRadius: 60 };
    b.projectiles.push(new Projectile('ally', 995, main, 22, 420, 'magic', payload));
    b.step(0.05);
    expect(main.maxHp - main.hp).toBeCloseTo(33); // 무리 x1.5
    expect(near.maxHp - near.hp).toBeCloseTo(33);
    expect(flyer.maxHp - flyer.hp).toBeCloseTo(22);
    expect(far.hp).toBe(far.maxHp);
    expect(near.status!.burning).toBe(true);
    expect(far.status!.burning).toBe(false);
  });

  it('구미호 공격은 범위 피해와 화상을 건다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'gumiho');
    const a = b.spawnEnemy('eggGhost', false, ally.x + 100);
    const c = b.spawnEnemy('eggGhost', false, ally.x + 130);
    b.step(1);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(c.hp).toBeLessThan(c.maxHp);
    expect(a.status!.burning && c.status!.burning).toBe(true);
  });
});

describe('화상', () => {
  it('총 피해는 초당 피해 x 3초', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const e = b.spawnEnemy('jangseungSpirit', false, 1000);
    b.applyBurn(e, 4);
    b.step(4);
    expect(e.maxHp - e.hp).toBeCloseTo(12, 5);
    expect(e.status!.burning).toBe(false);
  });

  it('다시 걸리면 시간만 갱신하고 중첩되지 않는다', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const e = b.spawnEnemy('jangseungSpirit', false, 1000);
    b.applyBurn(e, 4);
    b.step(2);
    b.applyBurn(e, 4);
    expect(e.status!.burnStacks).toBe(1);
    b.step(4);
    expect(e.maxHp - e.hp).toBeCloseTo(4 * 5, 5); // 2초 + 갱신 후 3초
  });

  it('최대 중첩 파라미터: 기본 1, 2로 늘리면 두 배', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const e = b.spawnEnemy('jangseungSpirit', false, 1000);
    b.applyBurn(e, 4, 2);
    b.applyBurn(e, 4, 2);
    b.applyBurn(e, 4, 2);
    expect(e.status!.burnStacks).toBe(2);
    b.step(4);
    expect(e.maxHp - e.hp).toBeCloseTo(24, 5);
  });

  it('영체는 화상 피해 x1.5, 방어 파괴는 +10%/중첩', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const g = b.spawnEnemy('maidenGhost', false, 1000);
    b.applyBurn(g, 4);
    b.applyDefenseBreak(g);
    b.step(4);
    expect(g.maxHp - g.hp).toBeCloseTo(12 * 1.5 * 1.1, 5);
  });

  it('불 태그 아군의 공격은 화상을 걸고 화상으로 죽이면 처치 보상을 준다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'foxfireArcher');
    const e = b.spawnEnemy('jangseungSpirit', false, ally.x + 100);
    b.step(1);
    expect(e.status!.burning).toBe(true);
    const e2 = b.spawnEnemy('eggGhost', false, 1000);
    e2.hp = 0.1;
    b.applyBurn(e2, 4);
    const before = b.resources.talisman;
    b.step(0.05);
    expect(e2.alive).toBe(false);
    expect(b.resources.talisman).toBeGreaterThan(before + 2.9);
  });

  it('불 태그가 아닌 아군 공격은 화상을 걸지 않는다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'clubGoblin');
    const e = b.spawnEnemy('jangseungSpirit', false, ally.x + 30);
    b.step(0.5);
    expect(e.status!.burning).toBe(false);
  });
});

describe('감속·넉백·기절', () => {
  it('감속은 가장 강한 것만 적용되고 끝나면 풀린다', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const e = b.spawnEnemy('eggGhost', false, 1000);
    b.applySlow(e, 0.2, 3);
    b.applySlow(e, 0.5, 1);
    expect(e.status!.moveMultiplier).toBeCloseTo(0.5);
    const x0 = e.x;
    b.step(0.05);
    expect(x0 - e.x).toBeCloseTo(65 * 0.05 * 0.5);
    b.step(1);
    expect(e.status!.moveMultiplier).toBeCloseTo(0.8);
    b.step(2);
    expect(e.status!.moveMultiplier).toBe(1);
  });

  it('넉백은 진행 반대로 밀고 서낭당·성 위치에서 멈춘다', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const ally = withAlly(b, 'clubGoblin', 300);
    b.knockback(ally, 60);
    expect(ally.x).toBe(240);
    b.knockback(ally, 1000);
    expect(ally.x).toBe(COMBAT.shrine.x);
    const e = b.spawnEnemy('eggGhost', false, 2300);
    b.knockback(e, 100);
    expect(e.x).toBe(COMBAT.castle.x);
  });

  it('보스는 넉백이 무효', () => {
    const b = newBattle();
    const boss = b.spawnEnemy('jangseungSpirit', false, 1000);
    boss.stats.boss = true;
    b.knockback(boss, 80);
    expect(boss.x).toBe(1000);
  });

  it('기절 중에는 이동·공격이 멈춘다', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const e = b.spawnEnemy('eggGhost', false, 1000);
    b.applyStun(e, 1);
    b.step(0.5);
    expect(e.x).toBe(1000);
    b.step(0.6);
    expect(e.x).toBeLessThan(1000);

    const ally = withAlly(b, 'clubGoblin', 300);
    const victim = b.spawnEnemy('jangseungSpirit', false, 320);
    b.applyStun(ally, 1);
    b.step(0.5);
    expect(victim.hp).toBe(victim.maxHp);
    b.step(0.6);
    expect(victim.hp).toBeLessThan(victim.maxHp);
  });

  it('보스는 기절 대신 0.5초 경직', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const boss = b.spawnEnemy('eggGhost', false, 1000);
    boss.stats.boss = true;
    b.applyStun(boss, 5);
    b.step(0.4);
    expect(boss.x).toBe(1000);
    b.step(0.3);
    expect(boss.x).toBeLessThan(1000);
  });

  it('영웅도 기절하면 이동·공격을 못 한다', () => {
    const b = newBattle();
    const e = b.spawnEnemy('jangseungSpirit', false, b.hero.x + 20);
    b.applyStun(b.hero, 1);
    const x0 = b.hero.x;
    b.step(0.5, { moveDir: 1 });
    expect(b.hero.x).toBe(x0);
    expect(e.hp).toBe(e.maxHp);
  });

  it('기지에는 상태 효과가 걸리지 않는다', () => {
    const b = newBattle();
    b.applyBurn(b.castle, 4);
    b.applyStun(b.castle, 1);
    b.applyDefenseBreak(b.castle);
    b.knockback(b.castle, 50);
    expect(b.castle.status).toBeNull();
    expect(b.castle.x).toBe(COMBAT.castle.x);
    expect(b.addBuff(b.shrine, { attack: 1 }, 1)).toBe(false);
  });
});

describe('방어 파괴', () => {
  it('맞을 때마다 1중첩, 최대 5중첩', () => {
    const b = newBattle();
    const e = b.spawnEnemy('eggGhost', false, 1000);
    for (let i = 0; i < 7; i++) b.applyDefenseBreak(e);
    expect(e.status!.defenseBreakStacks).toBe(STATUS.defenseBreak.maxStacks);
    expect(e.damageTarget.defenseBreakStacks).toBe(5);
    expect(calcDamage(10, atk('melee'), e.damageTarget)).toBeCloseTo(15);
  });

  it('최대 중첩은 파라미터로 바꿀 수 있다', () => {
    const b = newBattle();
    const e = b.spawnEnemy('eggGhost', false, 1000);
    for (let i = 0; i < 5; i++) b.applyDefenseBreak(e, 3);
    expect(e.status!.defenseBreakStacks).toBe(3);
  });

  it('6초 지속, 맞을 때마다 시간 갱신', () => {
    const b = newBattle();
    b.hero.x = 1500;
    const e = b.spawnEnemy('jangseungSpirit', false, 1900);
    b.applyDefenseBreak(e);
    b.step(4);
    b.applyDefenseBreak(e);
    b.step(4);
    expect(e.status!.defenseBreakStacks).toBe(2);
    b.step(2.1);
    expect(e.status!.defenseBreakStacks).toBe(0);
  });
});

describe('버프·오라', () => {
  it('공격력 버프가 피해에 반영되고 끝나면 사라진다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'clubGoblin', 300);
    const e = b.spawnEnemy('jangseungSpirit', false, 320);
    expect(b.addBuff(ally, { attack: 0.5 }, 0.5)).toBe(true);
    b.step(0.05);
    expect(e.maxHp - e.hp).toBeCloseTo(14 * 1.5);
    b.step(0.6);
    expect(ally.status!.buffed).toBe(false);
  });

  it('공격 속도 +100%는 공격 간격을 절반으로 나눈다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'clubGoblin', 300);
    b.spawnEnemy('jangseungSpirit', false, 320);
    b.addBuff(ally, { attackSpeed: 1 }, 5);
    b.step(0.05);
    expect(ally.attackCooldown).toBeCloseTo(0.4);
  });

  it('이동 속도 버프, 받는 피해 감소 버프', () => {
    const b = newBattle();
    const ally = withAlly(b, 'clubGoblin', 300);
    b.addBuff(ally, { moveSpeed: 0.5, damageReduction: 0.5 }, 5);
    b.step(0.05);
    expect(ally.x - 300).toBeCloseTo(60 * 1.5 * 0.05);
    const e = b.spawnEnemy('eggGhost', false, ally.x + 15);
    e.hp = 1e6;
    const hp0 = ally.hp;
    b.step(0.05);
    expect(hp0 - ally.hp).toBeCloseTo(9 * 0.5);
  });

  it('오라는 반경 안의 아군에게만 걸리고 소유자가 죽으면 사라진다', () => {
    const b = newBattle();
    const owner = withAlly(b, 'clubGoblin', 500);
    const inside = withAlly(b, 'sumoGoblin', 550);
    const outside = withAlly(b, 'sumoGoblin', 700);
    for (const a of [owner, inside, outside]) a.stats.speed = 0;
    b.addAura(owner, { radius: 100, effect: { attack: 0.2 } });
    b.step(0.05);
    expect(owner.status!.attackBonus).toBeCloseTo(0.2);
    expect(inside.status!.attackBonus).toBeCloseTo(0.2);
    expect(outside.status!.attackBonus).toBe(0);
    owner.hp = 0;
    b.step(0.05);
    expect(inside.status!.attackBonus).toBe(0);
  });

  it('오라 밖으로 나가면 효과가 즉시 사라진다', () => {
    const b = newBattle();
    const owner = withAlly(b, 'clubGoblin', 500);
    owner.stats.speed = 0;
    b.addAura(owner, { radius: 100, effect: { moveSpeed: 0.15 } });
    b.hero.x = 550;
    b.step(0.05);
    expect(b.hero.status!.buffed).toBe(true);
    b.hero.x = 900;
    b.step(0.05);
    expect(b.hero.status!.buffed).toBe(false);
  });

  it('버프 해제 중에는 기존 버프·오라가 꺼지고 새 버프도 걸리지 않는다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'clubGoblin', 500);
    ally.stats.speed = 0;
    b.addBuff(ally, { attack: 0.5 }, 10);
    b.addAura(ally, { radius: 100, effect: { attack: 0.2 } });
    b.step(0.05);
    expect(ally.status!.attackBonus).toBeCloseTo(0.7);
    b.dispelBuffs(ally, 2);
    expect(ally.status!.attackBonus).toBe(0);
    expect(b.addBuff(ally, { attack: 0.5 }, 10)).toBe(false);
    b.step(1);
    expect(ally.status!.attackBonus).toBe(0);
    b.step(1.1);
    expect(b.addBuff(ally, { attack: 0.5 }, 10)).toBe(true);
    b.step(0.05);
    expect(ally.status!.attackBonus).toBeCloseTo(0.7);
  });
});

describe('회복 차단', () => {
  it('차단 중에는 영웅 자연 회복이 멈추고 끝나면 재개된다', () => {
    const b = newBattle();
    b.hero.hp = 100;
    b.blockHeal(b.hero, 2);
    b.step(1.5);
    expect(b.hero.hp).toBe(100);
    b.step(1.5);
    expect(b.hero.hp).toBeGreaterThan(101);
  });

  it('heal은 차단 중 0을 돌려준다', () => {
    const b = newBattle();
    const ally = withAlly(b, 'clubGoblin');
    ally.hp = 50;
    b.blockHeal(ally, 1);
    expect(ally.heal(30)).toBe(0);
    expect(ally.hp).toBe(50);
    b.step(1.1);
    expect(ally.heal(30)).toBe(30);
  });
});

