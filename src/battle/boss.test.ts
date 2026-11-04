import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { BOSS_RULES, BOSSES, getBossDef } from '../data/bosses';
import { computeBuildEffects } from '../game/buildEffects';
import { Battle } from './battle';
import { BossEncounter, type BossHost } from './boss';
import { calcDamage, type AttackInfo, type DamageTarget } from './damage';
import { createEnemy } from './enemyFactory';
import { Base, Fighter, type Body } from './entities';
import { Hero } from './hero';
import { SeededRng } from './rng';

/** 챕터 c(1~5)의 보스 스테이지 번호 */
const bossStage = (chapter: number) => (chapter - 1) * 5 + 4;

function newBossBattle(chapter: number, bossAt = 0): Battle {
  return new Battle({ stage: bossStage(chapter), bossAt, rng: new SeededRng(1) });
}

/** 보스를 등장시키고 돌려준다 */
function withBoss(chapter: number, bossAt = 0): { b: Battle; boss: Fighter } {
  const b = newBossBattle(chapter, bossAt);
  b.step(0.05);
  return { b, boss: b.encounter!.boss! };
}

const resetCooldowns = (b: Battle) => (b as unknown as { cooldowns: number[] }).cooldowns.fill(0);

/** 아군을 소환해 돌려준다 */
function summonAlly(b: Battle, allyId: string): Fighter {
  b.resources.talisman = 200;
  resetCooldowns(b);
  b.summon(ALLIES.findIndex((a) => a.id === allyId));
  return b.allies[b.allies.length - 1];
}

/** 아군을 소환해 대상을 한 번 때리고(strike) 그 아군을 돌려준다 */
function hit(b: Battle, allyId: string, target: Body): Fighter {
  const a = summonAlly(b, allyId);
  strikeBy(b, a, target);
  return a;
}

function strikeBy(b: Battle, a: Fighter, target: Body): void {
  const info: AttackInfo = { type: a.stats.attackType, tags: a.stats.tags, source: 'ally' };
  (b as unknown as { strike: (t: Body, s: object) => void }).strike(target, {
    attacker: a, base: a.attackPower, info, attackBonus: 0, burnPerSec: 0,
  });
}

/** 한 번 때려 대상이 잃은 체력 */
function lost(b: Battle, allyId: string, target: Body): number {
  const before = target.hp;
  hit(b, allyId, target);
  return before - target.hp;
}

const def = (id: string) => ALLIES.find((a) => a.id === id)!;

describe('보스 데이터', () => {
  it('numbers.md 6장 수치 그대로, 처치 부적 100', () => {
    expect(BOSSES.map((x) => [x.name, x.maxHp, x.attack, x.attackInterval, x.range, x.speed])).toEqual([
      ['거대 원귀', 3000, 40, 2.0, 40, 20],
      ['철갑 장승왕', 4500, 50, 2.2, 40, 15],
      ['이무기 강철이', 6000, 55, 2.0, 60, 18],
      ['어둑시니 대왕', 7000, 60, 2.5, 200, 20],
      ['차사왕', 10000, 70, 2.0, 50, 15],
    ]);
    for (const x of BOSSES) expect(x.killTalisman).toBe(100);
    expect(getBossDef(3).name).toBe('이무기 강철이');
  });

  it('보스는 스테이지 성장 공식을 적용하지 않는다', () => {
    const { boss } = withBoss(5);
    expect(boss.maxHp).toBe(10000);
    expect(boss.attackPower).toBe(70);
    expect(boss.isBoss).toBe(true);
  });
});

describe('보스 등장과 성 무적', () => {
  it('기본 60초 뒤 등장하고 그 전에는 없다', () => {
    const b = new Battle({ stage: 4, rng: new SeededRng(1) });
    b.shrine.hp = 1e9; // 웨이브에 지지 않게
    b.step(59.9);
    expect(b.encounter!.state).toBe('pending');
    expect(b.enemies.some((e) => e.isBoss)).toBe(false);
    b.step(0.2);
    expect(b.encounter!.state).toBe('active');
    const boss = b.enemies.find((e) => e.isBoss)!;
    expect(boss.stats.maxHp).toBe(3000);
    expect(BOSS_RULES.appearAt).toBe(60);
    expect(boss.x).toBeCloseTo(b.castle.x - BOSS_RULES.spawnOffset, -1); // 등장 직후 조금 걸어 나옴
  });

  it('bossAt 옵션으로 등장 시각을 바꾼다', () => {
    const b = newBossBattle(2, 10);
    b.step(9.9);
    expect(b.encounter!.boss).toBeNull();
    b.step(0.2);
    expect(b.encounter!.boss!.defId).toBe('ironJangseung');
  });

  it('보스 스테이지가 아니면 보스가 없다', () => {
    for (const stage of [0, 3, 5, 23]) {
      const b = new Battle({ stage, bossAt: 0, rng: new SeededRng(1) });
      b.step(1);
      expect(b.encounter).toBeNull();
      expect(b.enemies.some((e) => e.isBoss)).toBe(false);
      expect(b.castle.invulnerable).toBe(false);
    }
  });

  it('장마다 그 장의 보스가 나온다', () => {
    BOSSES.forEach((d, i) => {
      expect(withBoss(i + 1).boss.defId).toBe(d.id);
    });
  });

  it('보스 처치 전(등장 전 포함)에는 성이 무적, 처치하면 풀려 부수면 승리', () => {
    const b = new Battle({ stage: 4, bossAt: 30, rng: new SeededRng(1) });
    expect(b.castle.invulnerable).toBe(true);
    const hp = b.castle.hp;
    expect(b.castle.takeDamage(500)).toBe(false);
    hit(b, 'clubGoblin', b.castle);
    expect(b.castle.hp).toBe(hp);

    b.step(31);
    const boss = b.encounter!.boss!;
    expect(b.castle.invulnerable).toBe(true);
    hit(b, 'clubGoblin', b.castle);
    expect(b.castle.hp).toBe(hp);

    boss.takeDamage(1e9);
    b.step(0.05);
    expect(b.encounter!.state).toBe('defeated');
    expect(b.castle.invulnerable).toBe(false);
    hit(b, 'clubGoblin', b.castle);
    expect(b.castle.hp).toBeLessThan(hp);

    b.castle.takeDamage(b.castle.hp);
    b.step(0.05);
    expect(b.result).toBe('victory');
  });

  it('보스 처치 시 부적 100을 받는다', () => {
    const { b, boss } = withBoss(1);
    const a = summonAlly(b, 'foxfireArcher');
    b.resources.talisman = 0;
    boss.hp = 1;
    strikeBy(b, a, boss);
    expect(boss.alive).toBe(false);
    expect(b.resources.talisman).toBe(BOSS_RULES.killTalisman);
  });
});

describe('보스 상성', () => {
  it('거대 원귀: 불 약점 x2, 근접 저항 x0.2', () => {
    const { b, boss } = withBoss(1);
    expect(lost(b, 'foxfireArcher', boss)).toBeCloseTo(10 * 2); // 원거리 + 불
    expect(lost(b, 'gumiho', boss)).toBeCloseTo(22 * 2); // 마법 + 불, 범위 하나
    expect(lost(b, 'clubGoblin', boss)).toBeCloseTo(14 * 0.2);
    expect(lost(b, 'magpieFlock', boss)).toBeCloseTo(7); // 상성 없음
  });

  it('철갑 장승왕: 근접·방어 파괴 약점은 x2 한 번, 원거리·마법 저항', () => {
    const { b, boss } = withBoss(2);
    expect(lost(b, 'bulgasari', boss)).toBeCloseTo(20 * 2); // 근접 + 방어 파괴 = 한 번만
    boss.status!.clear();
    expect(lost(b, 'clubGoblin', boss)).toBeCloseTo(14 * 2);
    expect(lost(b, 'foxfireArcher', boss)).toBeCloseTo(10 * 0.2);
    expect(lost(b, 'yeongdeungWind', boss)).toBeCloseTo(8 * 0.2);
  });

  it('이무기 강철이: 바람·근접 약점은 한 번, 불 저항', () => {
    const { b, boss } = withBoss(3);
    boss.hp = 3000;
    expect(lost(b, 'oneLegGoblin', boss)).toBeCloseTo(18 * 2); // 근접 + 바람
    expect(lost(b, 'magpieFlock', boss)).toBeCloseTo(7 * 2); // 원거리 + 바람
    expect(lost(b, 'clubGoblin', boss)).toBeCloseTo(14 * 2);
  });

  it('어둑시니 대왕: 원거리 약점, 근접 저항, 비행 유닛 약점', () => {
    const { b, boss } = withBoss(4);
    expect(boss.flying).toBe(true);
    expect(lost(b, 'magpieFlock', boss)).toBeCloseTo(7 * 2 * 2); // 약점 x2 한 번 x 까치 비행 적 x2 (비행 중 대왕)
    expect(lost(b, 'samjokgo', boss)).toBeCloseTo(14 * 2);
    expect(lost(b, 'yeongdeungWind', boss)).toBeCloseTo(8); // 마법은 상성 없음
    boss.setFlying(false); // 착지
    expect(lost(b, 'clubGoblin', boss)).toBeCloseTo(14 * 0.2);
    expect(lost(b, 'magpieFlock', boss)).toBeCloseTo(7 * 2); // 착지 중: 약점 x2만, 까치 x2 없음
  });

  it('대왕 vs 까치 떼 ③: 비행 중 x3 x 약점 x2, 경직 없음, 착지 중에는 배율 없음', () => {
    const b = new Battle({ stage: bossStage(4), bossAt: 0, rng: new SeededRng(1), modifiers: computeBuildEffects({ magpieFlockAwaken: 1 }) });
    b.step(0.05);
    const boss = b.encounter!.boss!;
    expect(boss.flying).toBe(true);
    expect(lost(b, 'magpieFlock', boss)).toBeCloseTo(7 * 3 * 2);
    expect(boss.status!.stunned).toBe(false);
    boss.setFlying(false);
    expect(lost(b, 'magpieFlock', boss)).toBeCloseTo(7 * 2);
    expect(boss.status!.stunned).toBe(false);
  });

  it('대왕 vs 까치 떼 ① 강화 + ③: 7 x 1.25 x 3 x 2', () => {
    const levels = { magpieFlockBasic: 1, magpieFlockAwaken: 1 };
    const b = new Battle({ stage: bossStage(4), bossAt: 0, rng: new SeededRng(1), modifiers: computeBuildEffects(levels) });
    b.step(0.05);
    expect(lost(b, 'magpieFlock', b.encounter!.boss!)).toBeCloseTo(7 * 1.25 * 3 * 2);
  });

  it('비행 유닛 약점은 공격 유형과 별개로 판정된다', () => {
    const target: DamageTarget = { traits: [], weakness: { flyingAttacker: true }, resistance: { attackTypes: ['melee'] } };
    const melee: AttackInfo = { type: 'melee', tags: [], source: 'ally' };
    expect(calcDamage(10, melee, target)).toBeCloseTo(10 * 0.2);
    expect(calcDamage(10, { ...melee, attackerFlying: true }, target)).toBeCloseTo(10 * 2 * 0.2);
  });

  it('차사왕: 영웅 기본 공격과 스킬이 약점', () => {
    const { b, boss } = withBoss(5);
    boss.x = 140;
    const before = boss.hp;
    b.step(0.05); // 영웅(x=130) 기본 공격: 25 x 2
    expect(before - boss.hp).toBeCloseTo(50);

    b.resources.spirit = 100;
    const mid = boss.hp;
    expect(b.castSkill('bladeDance')).toBe('ok');
    expect(mid - boss.hp).toBeCloseTo(200 * 2);
    expect(lost(b, 'clubGoblin', boss)).toBeCloseTo(14); // 일반 아군은 상성 없음
  });

  it('차사왕: 칼날 춤 지속 피해도 영웅 약점 x2 (W3 결정)', () => {
    const b = new Battle({ stage: bossStage(5), bossAt: 0, rng: new SeededRng(1), modifiers: computeBuildEffects({ bladeDanceBlades: 1 }) });
    b.step(0.05);
    const boss = b.encounter!.boss!;
    boss.x = 140;
    b.resources.spirit = 100;
    b.castSkill('bladeDance');
    b.hero.status!.stun(10000, false); // 영웅 기본 공격 차단
    const mid = boss.hp;
    b.step(1);
    expect(mid - boss.hp).toBeCloseTo(40 * 2, 0);
  });

  it('약점·저항이 동시에 해당하면 곱한다', () => {
    const target: DamageTarget = {
      traits: [], weakness: { tags: ['fire'] }, resistance: { attackTypes: ['ranged'] },
    };
    const info: AttackInfo = { type: 'ranged', tags: ['fire'], source: 'ally' };
    expect(calcDamage(10, info, target)).toBeCloseTo(10 * 2 * 0.2);
    // 약점이 여러 개 해당해도 x2는 한 번
    const multi: DamageTarget = { traits: [], weakness: { tags: ['fire'], attackTypes: ['ranged'] } };
    expect(calcDamage(10, info, multi)).toBeCloseTo(20);
  });
});

describe('A1: 화상의 보스 상성은 불 태그로만 판정', () => {
  const burn: AttackInfo = { type: 'magic', tags: ['fire'], source: 'ally' };

  it('화상은 마법 약점·저항에 영향받지 않는다', () => {
    const weakMagic: DamageTarget = { traits: [], weakness: { attackTypes: ['magic'] } };
    const resistMagic: DamageTarget = { traits: [], resistance: { attackTypes: ['magic'] } };
    expect(calcDamage(10, burn, weakMagic, { dot: true })).toBeCloseTo(10);
    expect(calcDamage(10, burn, resistMagic, { dot: true })).toBeCloseTo(10);
    // 일반 마법 공격은 그대로 상성을 받는다
    expect(calcDamage(10, burn, weakMagic)).toBeCloseTo(20);
  });

  it('불 태그 약점·저항은 화상에 적용된다', () => {
    expect(calcDamage(10, burn, { traits: [], weakness: { tags: ['fire'] } }, { dot: true })).toBeCloseTo(20);
    expect(calcDamage(10, burn, { traits: [], resistance: { tags: ['fire'] } }, { dot: true })).toBeCloseTo(2);
  });

  it('거대 원귀의 화상은 x2 (초당 10 -> 20)', () => {
    const { b, boss } = withBoss(1);
    b.applyBurn(boss, 10);
    const before = boss.hp;
    b.step(1);
    expect(before - boss.hp).toBeCloseTo(20, 1);
  });

  it('철갑 장승왕은 마법 저항이 있어도 화상은 그대로 받는다', () => {
    const { b, boss } = withBoss(2);
    b.applyBurn(boss, 10);
    const before = boss.hp;
    b.step(1);
    expect(before - boss.hp).toBeCloseTo(10, 1);
  });
});

describe('보스 상태 효과', () => {
  it('넉백은 무효', () => {
    const { b, boss } = withBoss(1);
    boss.x = 1000;
    b.knockback(boss, 100);
    expect(boss.x).toBe(1000);
  });

  it('기절은 0.5초 경직으로 대체', () => {
    const { b, boss } = withBoss(1);
    b.applyStun(boss, 3);
    expect(boss.status!.stunned).toBe(true);
    b.step(0.6);
    expect(boss.status!.stunned).toBe(false);
  });

  it('해태의 붙잡기도 0.5초 경직', () => {
    const { b, boss } = withBoss(1);
    boss.x = 140;
    b.resources.talisman = 200;
    resetCooldowns(b);
    b.summon(ALLIES.findIndex((a) => a.id === 'haetae'));
    b.step(0.05);
    expect(boss.status!.stunned).toBe(true);
    b.step(0.6);
    expect(boss.status!.stunned).toBe(false);
  });
});

/** 패턴 단독 검증용 가짜 전장. 웨이브 없이 호출만 기록한다 */
class FakeHost implements BossHost {
  allies: Fighter[] = [];
  enemies: Fighter[] = [];
  livingHero: Body | null = null;
  shrine = new Base('ally', 80, 1000, 50, 90);
  castle = new Base('enemy', 2320, 1200, 70, 130);
  damage: { target: Body; base: number }[] = [];
  knocks: { target: Body; distance: number }[] = [];
  dispels: { target: Body; duration: number }[] = [];
  suppressed = false;
  chargeFactor = 1;
  freeEnemySlots = Infinity;

  addEnemy(e: Fighter): void {
    this.enemies.push(e);
  }
  spawnEnemy(id: string, elite: boolean, x: number): Fighter {
    const e = createEnemy(id, 4, elite, x);
    this.enemies.push(e);
    return e;
  }
  dealFixedDamage(target: Body, base: number): void {
    this.damage.push({ target, base });
  }
  knockback(target: Body, distance: number): void {
    this.knocks.push({ target, distance });
  }
  dispelBuffs(target: Body, duration: number): void {
    this.dispels.push({ target, duration });
  }
  setAllyBonusesSuppressed(value: boolean): void {
    this.suppressed = value;
  }
  setTalismanChargeFactor(f: number): void {
    this.chargeFactor = f;
  }
}

function ally(x: number, id = 'clubGoblin'): Fighter {
  return new Fighter('ally', id, { ...def(id), traits: [], killTalisman: 0, scale: 1, elite: false }, x);
}

/** 패턴 시험 장비: 등장 시각 0, 0.05초 틱으로 진행 */
function rig(chapter: number) {
  const host = new FakeHost();
  const enc = new BossEncounter(getBossDef(chapter), host, 0);
  let t = 0;
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / 0.05); i++) {
      t += 0.05;
      enc.update(t, 0.05);
    }
  };
  run(0.05); // 등장
  return { host, enc, boss: enc.boss!, run };
}

describe('거대 원귀: 달걀귀신 소환', () => {
  it('10초마다 5마리를 보스 근처에 소환한다 (스테이지 성장 적용)', () => {
    const { host, boss, run } = rig(1);
    boss.x = 1000;
    run(9.85);
    expect(host.enemies.filter((e) => !e.isBoss)).toHaveLength(0);
    run(0.1);
    const eggs = host.enemies.filter((e) => e.defId === 'eggGhost');
    expect(eggs).toHaveLength(5);
    for (const e of eggs) expect(Math.abs(e.x - 1000)).toBeLessThanOrEqual(60);
    expect(eggs[0].maxHp).toBeCloseTo(70 * (1 + 0.12 * 4)); // 스테이지 4 성장
    run(10);
    expect(host.enemies.filter((e) => e.defId === 'eggGhost')).toHaveLength(10);
  });

  it('보스가 죽으면 더 소환하지 않는다', () => {
    const { host, boss, run } = rig(1);
    boss.takeDamage(1e9);
    run(25);
    expect(host.enemies.filter((e) => !e.isBoss)).toHaveLength(0);
  });
});

describe('철갑 장승왕: 갑옷', () => {
  it('10초마다 +1 중첩, 중첩당 받는 피해 -8%, 최대 6', () => {
    const { enc, boss, run } = rig(2);
    expect(enc.armorStacks).toBe(0);
    run(9.85);
    expect(enc.armorStacks).toBe(0);
    run(0.1);
    expect(enc.armorStacks).toBe(1);
    expect(boss.damageTarget.damageReduction).toBeCloseTo(0.08);
    run(100);
    expect(enc.armorStacks).toBe(6);
    expect(boss.damageTarget.damageReduction).toBeCloseTo(0.48);
    expect(enc.statusLabel).toBe('갑옷 6/6');
  });

  it('받는 피해 감소 상한 70%가 적용된다', () => {
    const { b, boss } = withBoss(2);
    b.step(60); // 갑옷 6중첩 (48%)
    boss.status!.addBuff({ damageReduction: 0.5 }, 30);
    boss.hp = boss.maxHp;
    expect(lost(b, 'clubGoblin', boss)).toBeCloseTo(14 * 2 * 0.3);
  });

  it('방어 파괴가 걸릴 때마다 갑옷 1중첩을 벗기고 방어 파괴도 쌓인다', () => {
    const { b, boss } = withBoss(2);
    b.step(30);
    expect(b.encounter!.armorStacks).toBe(3);
    b.applyDefenseBreak(boss);
    expect(b.encounter!.armorStacks).toBe(2);
    expect(boss.status!.defenseBreakStacks).toBe(1);
    hit(b, 'bulgasari', boss); // 불가사리 공격 한 번 = 방어 파괴 1중첩 + 갑옷 -1
    expect(b.encounter!.armorStacks).toBe(1);
    expect(boss.status!.defenseBreakStacks).toBe(2);
    expect(boss.damageTarget.damageReduction).toBeCloseTo(0.08);
  });

  it('갑옷이 없으면 더 벗기지 않는다', () => {
    const { b, boss } = withBoss(2);
    b.applyDefenseBreak(boss);
    expect(b.encounter!.armorStacks).toBe(0);
  });
});

describe('이무기 강철이', () => {
  it('불 피해를 받으면 저항 적용 전 피해량만큼 회복한다', () => {
    const { b, boss } = withBoss(3);
    boss.hp = 3000;
    hit(b, 'foxfireArcher', boss); // 피해 10 x 0.2 = 2, 회복 10
    expect(boss.hp).toBeCloseTo(3000 - 2 + 10);
  });

  it('회복 차단 중에는 회복하지 않고 저항 피해만 받는다', () => {
    const { b, boss } = withBoss(3);
    boss.hp = 3000;
    boss.status!.blockHeal(5);
    hit(b, 'foxfireArcher', boss);
    expect(boss.hp).toBeCloseTo(3000 - 2);
  });

  it('화상도 불 피해라 회복한다 (초당 10 -> 피해 2, 회복 10)', () => {
    const { b, boss } = withBoss(3);
    boss.hp = 3000;
    b.applyBurn(boss, 10);
    b.step(1);
    expect(boss.hp).toBeCloseTo(3000 + 8, 1);
  });

  it('불이 아닌 피해로는 회복하지 않는다', () => {
    const { b, boss } = withBoss(3);
    boss.hp = 3000;
    expect(lost(b, 'clubGoblin', boss)).toBeCloseTo(28);
  });

  it('가뭄: 살아 있는 동안 부적 충전 -40%, 죽으면 원래대로', () => {
    const { b, boss } = withBoss(3);
    expect(b.resources.talismanPerSec).toBeCloseTo(8 * 0.6);
    const before = b.resources.talisman;
    b.step(1);
    expect(b.resources.talisman - before).toBeCloseTo(4.8, 1);
    boss.takeDamage(1e9);
    b.step(0.05);
    expect(b.resources.talismanPerSec).toBe(8);
  });

  it('12초마다 앞쪽 반경 100에 피해 80 + 넉백 100 (뒤쪽·범위 밖 제외)', () => {
    const { host, boss, run } = rig(3);
    boss.x = 1000;
    const near = ally(950);
    const edge = ally(905); // 앞 95
    const far = ally(880); // 앞 120, 반지름 11 -> 109
    const behind = ally(1050);
    const hero = new Hero();
    hero.x = 960;
    host.allies = [near, edge, far, behind];
    host.livingHero = hero;
    run(11.85);
    expect(host.damage).toHaveLength(0);
    run(0.1);
    expect(host.damage.map((d) => d.target)).toEqual(expect.arrayContaining([near, edge, hero]));
    expect(host.damage).toHaveLength(3);
    for (const d of host.damage) expect(d.base).toBe(80);
    expect(host.knocks).toHaveLength(3);
    for (const k of host.knocks) expect(k.distance).toBe(100);
    run(12);
    expect(host.damage).toHaveLength(6);
  });
});

describe('어둑시니 대왕: 비행과 착지', () => {
  it('평소 비행이라 근접 아군이 칠 수 없다', () => {
    const { b, boss } = withBoss(4);
    boss.x = 140;
    b.resources.talisman = 200;
    resetCooldowns(b);
    b.summon(ALLIES.findIndex((a) => a.id === 'clubGoblin'));
    b.hero.status!.dispel(0);
    b.step(0.5);
    expect(boss.hp).toBe(boss.maxHp);
  });

  it('15초마다 3초간 내려오고, 내려오는 순간 반경 120에 피해 120', () => {
    const { host, boss, run } = rig(4);
    boss.x = 1000;
    const inside = ally(1100);
    const behind = ally(900); // 뒤쪽도 반경 안
    const outside = ally(1200);
    const hero = new Hero();
    hero.x = 1050;
    host.allies = [inside, behind, outside];
    host.livingHero = hero;
    expect(boss.flying).toBe(true);
    run(14.85);
    expect(boss.flying).toBe(true);
    expect(host.damage).toHaveLength(0);
    run(0.1);
    expect(boss.flying).toBe(false);
    expect(host.damage.map((d) => d.target)).toEqual(expect.arrayContaining([inside, behind, hero]));
    expect(host.damage).toHaveLength(3);
    for (const d of host.damage) expect(d.base).toBe(120);
    run(2.8);
    expect(boss.flying).toBe(false);
    run(0.2);
    expect(boss.flying).toBe(true);
    run(12);
    expect(boss.flying).toBe(false);
    expect(host.damage).toHaveLength(6);
  });

  it('착지 중에는 근접 아군의 공격 대상이 된다', () => {
    const { b, boss } = withBoss(4);
    boss.x = 140;
    boss.setFlying(false);
    b.resources.talisman = 200;
    resetCooldowns(b);
    b.summon(ALLIES.findIndex((a) => a.id === 'clubGoblin'));
    b.step(0.1);
    expect(boss.hp).toBeLessThan(boss.maxHp);
  });
});

describe('차사왕: 연계·오라 무효', () => {
  it('살아 있는 동안 연계와 오라를 끄고, 죽으면 되돌린다', () => {
    const { b, boss } = withBoss(5);
    expect(b.synergyDisabled).toBe(true);
    b.resources.talisman = 200;
    resetCooldowns(b);
    b.summon(ALLIES.findIndex((a) => a.id === 'samjokgo'));
    resetCooldowns(b);
    b.summon(ALLIES.findIndex((a) => a.id === 'clubGoblin'));
    const club = b.allies[1];
    b.step(0.05);
    expect(club.status!.attackBonus).toBe(0);
    expect(b.auraCircles).toHaveLength(0);

    boss.takeDamage(1e9);
    b.step(0.05);
    expect(b.synergyDisabled).toBe(false);
    expect(club.status!.attackBonus).toBeCloseTo(0.2);
    expect(b.auraCircles).toHaveLength(1);
  });

  it('일반 스테이지에서는 오라가 정상 동작한다', () => {
    const b = new Battle({ stage: 0, rng: new SeededRng(1) });
    b.resources.talisman = 200;
    b.summon(ALLIES.findIndex((a) => a.id === 'samjokgo'));
    resetCooldowns(b);
    b.summon(ALLIES.findIndex((a) => a.id === 'clubGoblin'));
    b.step(0.05);
    expect(b.allies[1].status!.attackBonus).toBeCloseTo(0.2);
  });

  it('20초마다 모든 아군·영웅 버프 해제 3초 + 아군 유닛 피해 30 (영웅 제외)', () => {
    const { host, boss, run } = rig(5);
    const a1 = ally(500);
    const a2 = ally(2000);
    const hero = new Hero();
    host.allies = [a1, a2];
    host.livingHero = hero;
    expect(host.suppressed).toBe(true);
    run(19.85);
    expect(host.dispels).toHaveLength(0);
    run(0.1);
    expect(host.dispels.map((d) => d.target)).toEqual(expect.arrayContaining([a1, a2, hero]));
    for (const d of host.dispels) expect(d.duration).toBe(3);
    expect(host.damage.map((d) => d.target)).toEqual([a1, a2]);
    for (const d of host.damage) expect(d.base).toBe(30);
    run(20);
    expect(host.damage).toHaveLength(4);

    boss.takeDamage(1e9);
    run(0.05);
    expect(host.suppressed).toBe(false);
  });

  it('버프 해제는 실제 전투에서 아군의 버프를 막는다', () => {
    const { b } = withBoss(5);
    const club = summonAlly(b, 'clubGoblin');
    club.hp = club.maxHp = 1e6;
    b.step(20);
    expect(club.status!.buffsDisabled).toBe(true);
    expect(club.status!.addBuff({ attack: 0.5 }, 5)).toBe(false);
    b.step(3.1);
    expect(club.status!.buffsDisabled).toBe(false);
  });
});
