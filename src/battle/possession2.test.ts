import { describe, expect, it } from 'vitest';
import { COMBAT } from '../data/combat';
import { POSSESSION_SKILLS } from '../data/possession';
import { possessionNodeId } from '../data/upgrades';
import { computeBuildEffects } from '../game/buildEffects';
import { Battle } from './battle';
import { Projectile, type Fighter } from './entities';
import { SeededRng, type Rng } from './rng';

// 11-2: 유닛 6~10(불가사리·해태·삼족오·까치 떼·영등 바람) 빙의 스킬 15개

const HX = 1000;
const BIG_HP = 100000;
const constRng = (value: number): Rng => ({ next: () => value });

function possess(unitId: string, levels: Record<string, number> = {}, rng: Rng = new SeededRng(1), stage = 0, bossAt?: number): Battle {
  const modifiers = computeBuildEffects({ [possessionNodeId(unitId)]: 1, ...levels });
  const b = new Battle({ stage, rng, modifiers, bossAt });
  b.hero.x = HX;
  b.resources.spirit = b.resources.maxSpirit;
  return b;
}

function foe(b: Battle, id: string, dx: number, hp = BIG_HP): Fighter {
  const e = b.spawnEnemy(id, false, b.hero.x + dx);
  e.maxHp = e.hp = hp;
  return e;
}

const lost = (e: Fighter) => BIG_HP - e.hp;

/** 부적 없이 아군 한 마리를 x에 두고, 움직이지 않게 얼린다 */
function allyAt(b: Battle, id: string, x: number): Fighter {
  b.spawnFreeAllies(id, 1);
  const a = b.allies[b.allies.length - 1];
  a.x = x;
  a.status!.stun(10000, false);
  return a;
}

/** 보스 스테이지(챕터 c)에서 보스를 등장시키고 영웅을 보스 왼쪽 dx에 둔다 */
function bossFight(unitId: string, chapter: number, dx: number) {
  const b = possess(unitId, {}, new SeededRng(1), (chapter - 1) * 5 + 4, 0);
  b.step(0.05);
  const boss = b.encounter!.boss!;
  b.hero.x = boss.x - dx;
  b.hero.facing = 1;
  b.resources.spirit = b.resources.maxSpirit;
  return { b, boss };
}

/** 적 투사체 하나를 대상에게 쏘고 한 틱 진행한 뒤 피해를 받았는지 */
function shotHits(b: Battle, target: Fighter): boolean {
  const before = target.hp;
  b.projectiles.push(
    new Projectile('enemy', target.x + 5, target as never, 10, 420, 'ranged', {
      tags: [], source: 'enemy', attackBonus: 0, burnPerSec: 0, areaRadius: 0,
    }),
  );
  b.step(0.05);
  return target.hp < before;
}

describe('유닛 6 불가사리 스킬', () => {
  it('쇠 씹기: 앞쪽 120 범위 근접 피해 90 + 방어 파괴 3중첩 (비행·뒤쪽·범위 밖 제외)', () => {
    const b = possess('bulgasari');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 134); // 134 - 14 = 120
    const out = foe(b, 'geuseundae', 140);
    const behind = foe(b, 'geuseundae', -50);
    const bird = foe(b, 'eodduksini', 50);
    b.castSkill('fanWind');
    expect([lost(a), lost(edge), lost(out), lost(behind), lost(bird)]).toEqual([90, 90, 0, 0, 0]);
    expect([a.status!.defenseBreakStacks, edge.status!.defenseBreakStacks, out.status!.defenseBreakStacks]).toEqual([3, 3, 0]);
  });

  it('쇠 갑옷: 6초간 영웅 −50%, 반경 150 다른 아군 −25% (영웅은 −75%가 아님), 해제 중인 아군·반경 밖 제외', () => {
    const b = possess('bulgasari');
    const near = allyAt(b, 'clubGoblin', HX + 140);
    const far = allyAt(b, 'clubGoblin', HX + 300);
    const dispelled = allyAt(b, 'clubGoblin', HX + 100);
    b.dispelBuffs(dispelled, 20);
    b.castSkill('blessing');
    b.step(0.05);
    expect(b.hero.status!.damageReduction).toBeCloseTo(0.5);
    expect(near.status!.damageReduction).toBeCloseTo(0.25);
    expect(far.status!.damageReduction).toBe(0);
    expect(dispelled.status!.damageReduction).toBe(0);
    b.step(5.8);
    expect(b.hero.status!.damageReduction).toBeCloseTo(0.5);
    b.step(0.3);
    expect([b.hero.status!.damageReduction, near.status!.damageReduction]).toEqual([0, 0]);
  });

  it('탐식: 반경 250 근접 피해 420 + 방어 파괴 5중첩, 처치 1마리당 영웅 최대 체력 10% 회복', () => {
    const b = possess('bulgasari');
    const weak1 = foe(b, 'geuseundae', 50, 100);
    const weak2 = foe(b, 'geuseundae', -80, 100);
    const tank = foe(b, 'geuseundae', 260); // 260 - 14 = 246
    const out = foe(b, 'geuseundae', 270); // 256 > 250
    const bird = foe(b, 'eodduksini', 100);
    b.hero.hp = 100;
    b.castSkill('bladeDance');
    expect([weak1.alive, weak2.alive]).toEqual([false, false]);
    expect(lost(tank)).toBe(420);
    expect(tank.status!.defenseBreakStacks).toBe(5);
    expect([lost(out), lost(bird)]).toEqual([0, 0]);
    expect(b.hero.hp).toBeCloseTo(100 + 2 * b.hero.maxHp * 0.1);
  });

  it('탐식: 처치가 없으면 회복도 없고, 회복 차단 중이면 처치해도 회복 0', () => {
    const none = possess('bulgasari');
    foe(none, 'geuseundae', 50);
    none.hero.hp = 100;
    none.castSkill('bladeDance');
    expect(none.hero.hp).toBe(100);

    const blocked = possess('bulgasari');
    foe(blocked, 'geuseundae', 50, 100);
    blocked.hero.hp = 100;
    blocked.blockHeal(blocked.hero, 5);
    blocked.castSkill('bladeDance');
    expect(blocked.hero.hp).toBe(100);
  });
});

describe('유닛 7 해태 스킬', () => {
  it('정의의 일격: 앞쪽 150 범위 근접 피해 90 + 붙잡기 2초', () => {
    const b = possess('haetae');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 164); // 150
    const out = foe(b, 'geuseundae', 170);
    const behind = foe(b, 'geuseundae', -50);
    b.castSkill('fanWind');
    expect([lost(a), lost(edge), lost(out), lost(behind)]).toEqual([90, 90, 0, 0]);
    expect([a.status!.stunned, edge.status!.stunned, out.status!.stunned, behind.status!.stunned]).toEqual([true, true, false, false]);
    b.step(1.9);
    expect(a.status!.stunned).toBe(true);
    b.step(0.2);
    expect(a.status!.stunned).toBe(false);
  });

  it('정의의 일격: 보스는 붙잡기 대신 0.5초 경직 (거대 원귀 근접 저항 ×0.2 = 18)', () => {
    const { b, boss } = bossFight('haetae', 1, 100);
    const hp = boss.hp;
    b.castSkill('fanWind');
    expect(hp - boss.hp).toBeCloseTo(18);
    expect(boss.status!.stunned).toBe(true);
    b.step(0.6);
    expect(boss.status!.stunned).toBe(false);
  });

  it('수호 진형: 8초간 반경 200 아군(영웅 포함) 받는 피해 −35%, 영웅 중심 오라', () => {
    const b = possess('haetae');
    const near = allyAt(b, 'clubGoblin', HX + 190);
    const far = allyAt(b, 'clubGoblin', HX + 210);
    b.castSkill('blessing');
    b.step(0.05);
    expect(b.hero.status!.damageReduction).toBeCloseTo(0.35);
    expect(near.status!.damageReduction).toBeCloseTo(0.35);
    expect(far.status!.damageReduction).toBe(0);
    expect(b.auraCircles).toEqual([{ x: HX, radius: 200 }]);
    b.step(7.8);
    expect(near.status!.damageReduction).toBeCloseTo(0.35);
    b.step(0.3);
    expect(near.status!.damageReduction).toBe(0);
    expect(b.auraCircles).toEqual([]);
  });

  it('오라형은 영웅이 버프 해제 중이면 꺼지고, 해제가 풀리면 남은 시간 동안 다시 켜진다', () => {
    const b = possess('haetae');
    const near = allyAt(b, 'clubGoblin', HX + 100);
    b.castSkill('blessing');
    b.dispelBuffs(b.hero, 3);
    b.step(0.05);
    expect([b.hero.status!.damageReduction, near.status!.damageReduction]).toEqual([0, 0]);
    b.step(3);
    expect(near.status!.damageReduction).toBeCloseTo(0.35);
  });

  it('차사왕이 살아 있으면 오라형은 무효 (수호 진형)', () => {
    const { b } = bossFight('haetae', 5, 300);
    const near = allyAt(b, 'clubGoblin', b.hero.x + 100);
    b.castSkill('blessing');
    b.step(0.05);
    expect(near.status!.damageReduction).toBe(0);
    expect(b.auraCircles).toEqual([]);
  });

  it('해태의 심판: 반경 300 마법 피해 450 + 기절 2초 (비행 포함, 갑옷 ×0.5 = 225), 서낭당 최대 체력 10% 회복', () => {
    const b = possess('haetae');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 314); // 300
    const out = foe(b, 'geuseundae', 320);
    const back = foe(b, 'geuseundae', -200);
    const bird = foe(b, 'eodduksini', 200);
    const armor = foe(b, 'jangseungSpirit', 150);
    b.shrine.hp = 100;
    b.castSkill('bladeDance');
    expect([lost(a), lost(edge), lost(out), lost(back), lost(bird), lost(armor)]).toEqual([450, 450, 0, 450, 450, 225]);
    expect([a.status!.stunned, out.status!.stunned, bird.status!.stunned]).toEqual([true, false, true]);
    expect(b.shrine.hp).toBeCloseTo(100 + b.shrine.maxHp * 0.1);
  });

  it('해태의 심판: 서낭당은 최대 체력을 넘지 않는다', () => {
    const b = possess('haetae');
    b.shrine.hp = b.shrine.maxHp - 10;
    b.castSkill('bladeDance');
    expect(b.shrine.hp).toBe(b.shrine.maxHp);
  });
});

describe('유닛 8 삼족오 스킬', () => {
  it('태양 깃: 가까운 적 3명(비행·뒤쪽 포함)에게 원거리 67.5 + 화상 9, 4번째는 제외', () => {
    const b = possess('samjokgo');
    const back = foe(b, 'geuseundae', -30);
    const bird = foe(b, 'eodduksini', 60);
    const front = foe(b, 'geuseundae', 110);
    const fourth = foe(b, 'geuseundae', 160);
    b.castSkill('fanWind');
    expect([lost(back), lost(bird), lost(front), lost(fourth)]).toEqual([67.5, 67.5, 67.5, 0]);
    expect([back.status!.burnDps, bird.status!.burnDps, front.status!.burnDps, fourth.status!.burnDps]).toEqual([9, 9, 9, 0]);
  });

  it('태양 깃 상성: 영체 불 ×1.5 = 101.25, 강철이 불 무효(피해·화상 없음)', () => {
    const b = possess('samjokgo');
    const ghost = foe(b, 'maidenGhost', 30);
    const steel = foe(b, 'gangcheol', 60);
    b.castSkill('fanWind');
    expect(lost(ghost)).toBeCloseTo(101.25);
    expect(lost(steel)).toBe(0);
    expect(steel.status!.burnDps).toBe(0);
  });

  it('태양 오라: 10초간 반경 250 아군(영웅 포함) 공격력 +50%', () => {
    const b = possess('samjokgo');
    const near = allyAt(b, 'clubGoblin', HX + 250);
    const far = allyAt(b, 'clubGoblin', HX + 251);
    b.castSkill('blessing');
    b.step(0.05);
    expect([b.hero.status!.attackBonus, near.status!.attackBonus, far.status!.attackBonus]).toEqual([0.5, 0.5, 0]);
    b.step(9.8);
    expect(near.status!.attackBonus).toBeCloseTo(0.5);
    b.step(0.3);
    expect([b.hero.status!.attackBonus, near.status!.attackBonus]).toEqual([0, 0]);
  });

  it('일식: 반경 600 모든 적(비행 포함, 기지 제외) 마법 330 + 화상 18, 갑옷 ×0.5, 강철이 무효', () => {
    const b = possess('samjokgo');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 614); // 600
    const out = foe(b, 'geuseundae', 620);
    const back = foe(b, 'geuseundae', -300);
    const bird = foe(b, 'eodduksini', 400);
    const armor = foe(b, 'jangseungSpirit', 200);
    const steel = foe(b, 'gangcheol', 300);
    const castleHp = b.castle.hp;
    b.castSkill('bladeDance');
    expect([lost(a), lost(edge), lost(out), lost(back), lost(bird), lost(armor), lost(steel)]).toEqual([330, 330, 0, 330, 330, 165, 0]);
    expect([a.status!.burnDps, out.status!.burnDps, armor.status!.burnDps, steel.status!.burnDps]).toEqual([18, 0, 18, 0]);
    expect(b.castle.hp).toBe(castleHp);
  });

  it('일식 vs 거대 원귀: 불 약점 ×2 = 660 (근접 저항과 무관한 마법)', () => {
    const { b, boss } = bossFight('samjokgo', 1, 100);
    const hp = boss.hp;
    b.castSkill('bladeDance');
    expect(hp - boss.hp).toBeCloseTo(660);
  });
});

describe('유닛 9 까치 떼 스킬', () => {
  it('까치 떼 쇄도: 앞쪽 400 범위 가까운 적 5명에게 원거리 52.5, 땅 위 적은 52.5 (6번째·범위 밖·뒤쪽 제외)', () => {
    const b = possess('magpieFlock');
    const list = [60, 120, 180, 240, 300].map((dx) => foe(b, 'geuseundae', dx));
    const sixth = foe(b, 'geuseundae', 350);
    const behind = foe(b, 'geuseundae', -50);
    b.castSkill('fanWind');
    expect(list.map(lost)).toEqual([52.5, 52.5, 52.5, 52.5, 52.5]);
    expect([lost(sixth), lost(behind)]).toEqual([0, 0]);
  });

  it('까치 떼 쇄도: 400 경계(414)까지, 비행 적은 ×2 (바람 태그 비행 ×1.5와 곱해져 157.5)', () => {
    const b = possess('magpieFlock');
    const edge = foe(b, 'geuseundae', 414);
    const out = foe(b, 'geuseundae', 420);
    const bird = foe(b, 'eodduksini', 100);
    b.castSkill('fanWind');
    expect([lost(edge), lost(out)]).toEqual([52.5, 0]);
    expect(lost(bird)).toBeCloseTo(157.5);
  });

  it('길조: 8초간 반경 250 아군(영웅 포함) 공격 속도 +40%, 반경 밖·해제 중 제외', () => {
    const b = possess('magpieFlock');
    const near = allyAt(b, 'clubGoblin', HX + 200);
    const far = allyAt(b, 'clubGoblin', HX + 400);
    const dispelled = allyAt(b, 'clubGoblin', HX + 100);
    b.dispelBuffs(dispelled, 20);
    b.castSkill('blessing');
    b.step(0.05);
    expect([b.hero.status!.attackSpeedBonus, near.status!.attackSpeedBonus]).toEqual([0.4, 0.4]);
    expect([far.status!.attackSpeedBonus, dispelled.status!.attackSpeedBonus]).toEqual([0, 0]);
    b.step(7.8);
    expect(near.status!.attackSpeedBonus).toBeCloseTo(0.4);
    b.step(0.3);
    expect([b.hero.status!.attackSpeedBonus, near.status!.attackSpeedBonus]).toEqual([0, 0]);
  });

  it('오작교: 까치 떼 6마리를 부적 없이 소환, 아군 28마리면 2마리만', () => {
    const b = possess('magpieFlock');
    b.resources.talisman = 77;
    b.castSkill('bladeDance');
    expect(b.allies.map((a) => a.defId)).toEqual(Array(6).fill('magpieFlock'));
    expect(b.resources.talisman).toBe(77);

    const full = possess('magpieFlock');
    full.spawnFreeAllies('clubGoblin', COMBAT.maxAllies - 2);
    full.castSkill('bladeDance');
    expect(full.allies).toHaveLength(COMBAT.maxAllies);
    expect(full.allies.filter((a) => a.defId === 'magpieFlock')).toHaveLength(2);
  });

  it('오작교: 반경 600 비행 적만 2초 경직 (땅 위 적·반경 밖 제외, 피해 없음)', () => {
    const b = possess('magpieFlock');
    const bird = foe(b, 'eodduksini', 400);
    const behind = foe(b, 'eodduksini', -500);
    const out = foe(b, 'eodduksini', 620);
    const ground = foe(b, 'geuseundae', 100);
    b.castSkill('bladeDance');
    expect([bird.status!.stunned, behind.status!.stunned, out.status!.stunned, ground.status!.stunned]).toEqual([true, true, false, false]);
    expect([lost(bird), lost(ground)]).toEqual([0, 0]);
    b.step(1.9);
    expect(bird.status!.stunned).toBe(true);
    b.step(0.2);
    expect(bird.status!.stunned).toBe(false);
  });

  it('오작교: 보스는 0.5초 경직, 비행 상태일 때만 대상 (어둑시니 대왕 착지 중이면 제외)', () => {
    const { b, boss } = bossFight('magpieFlock', 4, 100);
    (boss as Fighter).setFlying(true);
    b.castSkill('bladeDance');
    expect(boss.status!.stunned).toBe(true);
    b.step(0.6);
    expect(boss.status!.stunned).toBe(false);

    const landed = bossFight('magpieFlock', 4, 100);
    (landed.boss as Fighter).setFlying(false);
    landed.b.castSkill('bladeDance');
    expect(landed.boss.status!.stunned).toBe(false);
  });
});

describe('유닛 10 영등 바람 스킬', () => {
  it('돌개바람: 앞쪽 250 범위 마법 67.5 + 넉백 120 (비행 ×1.5, 무리 ×1.5, 뒤쪽·범위 밖 제외)', () => {
    const b = possess('yeongdeungWind');
    const a = foe(b, 'geuseundae', 100);
    const edge = foe(b, 'geuseundae', 264); // 250
    const out = foe(b, 'geuseundae', 270);
    const behind = foe(b, 'geuseundae', -50);
    const bird = foe(b, 'eodduksini', 50);
    const swarm = foe(b, 'eggGhost', 60);
    b.castSkill('fanWind');
    expect([lost(a), lost(edge), lost(out), lost(behind)]).toEqual([67.5, 67.5, 0, 0]);
    expect(lost(bird)).toBeCloseTo(101.25);
    expect(lost(swarm)).toBeCloseTo(101.25);
    expect([a.x, out.x, behind.x]).toEqual([HX + 220, HX + 270, HX - 50]);
  });

  it('돌개바람: 보스는 넉백 무효', () => {
    const { b, boss } = bossFight('yeongdeungWind', 1, 100);
    const x = boss.x;
    b.castSkill('fanWind');
    expect(boss.x).toBe(x);
  });

  it('순풍: 10초간 반경 250 아군(영웅 포함) 이동·공격 속도 +40%', () => {
    const b = possess('yeongdeungWind');
    const near = allyAt(b, 'clubGoblin', HX + 250);
    const far = allyAt(b, 'clubGoblin', HX + 251);
    b.castSkill('blessing');
    b.step(0.05);
    for (const body of [b.hero, near]) {
      expect(body.status!.attackSpeedBonus).toBeCloseTo(0.4);
      expect(body.status!.moveMultiplier).toBeCloseTo(1.4);
    }
    expect(far.status!.attackSpeedBonus).toBe(0);
    b.step(9.8);
    expect(near.status!.attackSpeedBonus).toBeCloseTo(0.4);
    b.step(0.3);
    expect(near.status!.attackSpeedBonus).toBe(0);
  });

  it('영등 폭풍: 반경 350 마법 390 + 넉백 200 + 감속 50% 4초 (뒤쪽 포함, 범위 밖 제외)', () => {
    const b = possess('yeongdeungWind');
    const a = foe(b, 'geuseundae', 100);
    const back = foe(b, 'geuseundae', -100);
    const edge = foe(b, 'geuseundae', 364); // 350
    const out = foe(b, 'geuseundae', 370);
    b.castSkill('bladeDance');
    expect([lost(a), lost(back), lost(edge), lost(out)]).toEqual([390, 390, 390, 0]);
    expect([a.x, back.x, out.x]).toEqual([HX + 300, HX + 100, HX + 370]);
    expect(a.status!.slowRatio).toBeCloseTo(0.5);
    expect(out.status!.slowed).toBe(false);
    a.status!.stun(10000, false);
    b.step(3.9);
    expect(a.status!.slowed).toBe(true);
    b.step(0.2);
    expect(a.status!.slowed).toBe(false);
  });
});

describe('순풍 투사체 빗나감 (Y4)', () => {
  /** 순풍을 건 영웅 옆에 얼린 방망이병을 두고 (x = HX + 100) 체력을 크게 한다 */
  function windSetup(rng: Rng, levels: Record<string, number> = {}) {
    const b = possess('yeongdeungWind', levels, rng);
    const club = allyAt(b, 'clubGoblin', HX + 100);
    club.hp = club.maxHp = BIG_HP;
    return { b, club };
  }

  it('50%: 0.4를 굴리면 빗나가고 0.5(경계)·0.6은 맞는다', () => {
    for (const [roll, hits] of [[0.4, false], [0.5, true], [0.6, true]] as const) {
      const { b, club } = windSetup(constRng(roll));
      b.castSkill('blessing');
      expect(shotHits(b, club), `roll ${roll}`).toBe(hits);
    }
  });

  it('순풍이 없으면 맞는다 (RNG 0.1이어도)', () => {
    const { b, club } = windSetup(constRng(0.1));
    expect(shotHits(b, club)).toBe(true);
  });

  it('반경 250 밖 아군은 빗나감 없음, 영웅이 노려져도 반경 안이면 빗나간다', () => {
    const { b } = windSetup(constRng(0.1));
    const far = allyAt(b, 'clubGoblin', HX + 400);
    far.hp = far.maxHp = BIG_HP;
    b.castSkill('blessing');
    expect(shotHits(b, far)).toBe(true);
    b.hero.hp = b.hero.maxHp;
    expect(shotHits(b, b.hero as never)).toBe(false);
  });

  it('영등 바람 유닛(기본 25%)과 겹쳐도 합산하지 않고 가장 높은 확률 하나: 0.4는 빗나가고 0.6은 맞는다', () => {
    for (const [roll, hits] of [[0.4, false], [0.6, true]] as const) {
      const { b, club } = windSetup(constRng(roll));
      const wind = allyAt(b, 'yeongdeungWind', HX + 80);
      expect(wind.ability.missAura?.chance).toBe(0.25);
      b.castSkill('blessing');
      expect(shotHits(b, club), `roll ${roll}`).toBe(hits);
    }
  });

  it('영등 ③(50%, 되돌림)과 겹치면 최고 확률 50% 하나만: 0.6은 맞는다 (합산 75%가 아님)', () => {
    const { b, club } = windSetup(constRng(0.6), { yeongdeungWindBasic: 1, yeongdeungWindCore: 1, yeongdeungWindAwaken: 1 });
    allyAt(b, 'yeongdeungWind', HX + 80);
    b.castSkill('blessing');
    expect(shotHits(b, club)).toBe(true);
  });

  it('영웅이 버프 해제 중이면 오라와 빗나감이 모두 꺼지고, 풀리면 남은 시간 동안 다시 켜진다', () => {
    const { b, club } = windSetup(constRng(0.1));
    b.castSkill('blessing');
    b.dispelBuffs(b.hero, 3);
    expect(shotHits(b, club)).toBe(true);
    expect(club.status!.attackSpeedBonus).toBe(0);
    b.step(3);
    expect(shotHits(b, club)).toBe(false);
    expect(club.status!.attackSpeedBonus).toBeCloseTo(0.4);
  });

  it('차사왕 생존 중에는 빗나감이 없고, 풀리면 다시 켜진다', () => {
    const { b, club } = windSetup(constRng(0.1));
    b.castSkill('blessing');
    b.setAllyBonusesSuppressed(true);
    expect(shotHits(b, club)).toBe(true);
    b.setAllyBonusesSuppressed(false);
    expect(shotHits(b, club)).toBe(false);
  });

  it('영웅이 죽어 있으면 빗나감이 없고, 지속 시간은 계속 흐른다', () => {
    const { b, club } = windSetup(constRng(0.1));
    b.castSkill('blessing');
    b.hero.hp = 0;
    expect(shotHits(b, club)).toBe(true);
  });

  it('오라 10초가 끝나면 빗나감도 끝난다', () => {
    const { b, club } = windSetup(constRng(0.1));
    b.castSkill('blessing');
    b.step(9.8);
    expect(shotHits(b, club)).toBe(false);
    b.step(0.3);
    expect(shotHits(b, club)).toBe(true);
  });
});

describe('11-2 공통: 유닛 6~10 시전', () => {
  it('유닛 10종 모두 빙의 스킬이 있고 시전 기록에 유닛 정보가 담긴다', () => {
    expect(Object.keys(POSSESSION_SKILLS)).toHaveLength(10);
    for (const unitId of ['bulgasari', 'haetae', 'samjokgo', 'magpieFlock', 'yeongdeungWind']) {
      const b = possess(unitId);
      for (const id of ['fanWind', 'blessing', 'bladeDance'] as const) expect(b.castSkill(id)).toBe('ok');
      const events = b.drainCastEvents();
      expect(events).toHaveLength(3);
      for (const ev of events) expect(ev.possessed?.unitId).toBe(unitId);
    }
  });

  it('시전 모양: 쇠 씹기 120 부채, 쇠 갑옷 150 원, 수호 진형 200 원, 일식 600 원, 돌개바람 250 부채', () => {
    const shapes = (unitId: string) => {
      const b = possess(unitId);
      for (const id of ['fanWind', 'blessing', 'bladeDance'] as const) b.castSkill(id);
      return b.drainCastEvents().map((e) => [e.range, e.shape]);
    };
    expect(shapes('bulgasari')).toEqual([[120, 'fan'], [150, 'circle'], [250, 'circle']]);
    expect(shapes('haetae')).toEqual([[150, 'fan'], [200, 'circle'], [300, 'circle']]);
    expect(shapes('samjokgo')).toEqual([[400, 'circle'], [250, 'circle'], [600, 'circle']]);
    expect(shapes('magpieFlock')).toEqual([[400, 'fan'], [250, 'circle'], [600, 'circle']]);
    expect(shapes('yeongdeungWind')).toEqual([[250, 'fan'], [250, 'circle'], [350, 'circle']]);
  });
});
