import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { RESOURCES } from '../data/resources';
import { ALL_SYNERGY_IDS } from '../data/synergy';
import { computeBuildEffects } from '../game/buildEffects';
import type { BuildLevels } from '../game/build';
import { Battle, type BattleOptions } from './battle';
import { Projectile, type Fighter } from './entities';
import { Hero } from './hero';
import { SeededRng, type Rng } from './rng';

// 빌드 효과가 전투에서 실제로 나는지 확인한다. 기대값은 손으로 계산한 수치다.

const HX = 1000;
const BIG_HP = 100000;
const constRng = (value: number): Rng => ({ next: () => value });

/** 웨이브를 끄고 빌드 효과를 적용한 전투. 영웅은 멀리 둔다 */
function newBattle(levels: BuildLevels = {}, options: Partial<BattleOptions> = {}): Battle {
  const b = new Battle({ stage: 0, rng: new SeededRng(1), modifiers: computeBuildEffects(levels), ...options });
  (b as unknown as { director: { update: () => [] } }).director = { update: () => [] };
  b.hero.x = 1500;
  b.resources.spirit = b.resources.maxSpirit;
  return b;
}

const idx = (id: string) => ALLIES.findIndex((a) => a.id === id);

function ally(b: Battle, id: string, x: number): Fighter {
  b.resources.talisman = 500;
  (b as unknown as { cooldowns: number[] }).cooldowns.fill(0);
  b.summon(idx(id));
  const a = b.allies[b.allies.length - 1];
  a.x = x;
  return a;
}

/** 맞아도 죽지 않는 적. frozen이면 움직이지도 공격하지도 않는다 */
function foe(b: Battle, id: string, x: number, frozen = true, hp = BIG_HP): Fighter {
  const e = b.spawnEnemy(id, false, x);
  e.maxHp = e.hp = hp;
  if (frozen) e.status!.stun(10000, false);
  return e;
}

const lost = (e: Fighter) => BIG_HP - e.hp;

/** 영웅을 가운데에 두고 영웅 스킬 시험용으로 얼리지 않은 전투를 만든다 */
function heroBattle(levels: BuildLevels = {}): Battle {
  const b = newBattle(levels);
  b.hero.x = HX;
  return b;
}

describe('무당: 영웅 강화', () => {
  it('방울 단련 3레벨: 기본 공격력 +30% (25 -> 32.5)', () => {
    const b = heroBattle({ bellTraining: 3 });
    const e = foe(b, 'grimReaper', HX + 30);
    b.step(0.05);
    expect(lost(e)).toBeCloseTo(32.5);
  });

  it('단단한 몸 3레벨: 최대 체력 +45% (300 -> 435)', () => {
    const b = newBattle({ sturdyBody: 3 });
    expect(b.hero.maxHp).toBeCloseTo(435);
    expect(b.hero.hp).toBeCloseTo(435);
  });

  it('빠른 부활 2레벨: 부활 시간 -2초, 최소 1초', () => {
    const b = newBattle({ quickRevive: 2 });
    b.hero.beginRespawn(1); // 4 + 1 = 5초 -> 3초
    expect(b.hero.respawnTimer).toBe(3);
    const floor = new Hero(300, 10);
    floor.beginRespawn(1);
    expect(floor.respawnTimer).toBe(1);
    const plain = newBattle();
    plain.hero.beginRespawn(1);
    expect(plain.hero.respawnTimer).toBe(5);
  });

  it('신력 샘 2레벨: 시간 충전 +40% (5 -> 7/초), 적중 +2는 그대로', () => {
    const b = newBattle({ spiritSpring: 2 });
    b.resources.spirit = 0;
    b.step(1);
    expect(b.resources.spirit).toBeCloseTo(7);
    const h = heroBattle({ spiritSpring: 2 });
    h.resources.spirit = 0;
    foe(h, 'grimReaper', HX + 30);
    h.step(0.05);
    expect(h.resources.spirit).toBeCloseTo(2 + 7 * 0.05);
  });

  it('깊은 신기: 신력 최대 +50', () => {
    const b = newBattle({ deepSpirit: 1 });
    expect(b.resources.maxSpirit).toBe(150);
    b.resources.spirit = 100;
    b.step(1);
    expect(b.resources.spirit).toBeCloseTo(105);
  });

  it('무당 각성: 기본 공격 3번째마다 반경 80 충격파 (공격력 x1.5)', () => {
    const b = heroBattle({ mudangAwakening: 1 });
    const near = foe(b, 'grimReaper', HX + 30); // 기본 공격 대상
    const far = foe(b, 'grimReaper', HX + 70); // 공격 사거리 밖, 충격파 안
    const out = foe(b, 'grimReaper', HX + 110); // 충격파 밖
    b.step(1.5); // 기본 공격 3번 (0.05, 약 0.65, 약 1.25)
    expect(lost(near)).toBeCloseTo(25 * 3 + 37.5);
    expect(lost(far)).toBeCloseTo(37.5);
    expect(lost(out)).toBe(0);
  });

  it('무당 각성이 없으면 충격파도 없다', () => {
    const b = heroBattle();
    const far = foe(b, 'grimReaper', HX + 70);
    foe(b, 'grimReaper', HX + 30);
    b.step(1.5);
    expect(lost(far)).toBe(0);
  });
});

describe('무당: 스킬 갈래', () => {
  it('부채 바람 회오리: 범위 200 -> 300', () => {
    const b = heroBattle({ fanWindTornado: 1 });
    const inside = foe(b, 'grimReaper', HX + 290);
    const outside = foe(b, 'grimReaper', HX + 320);
    b.castSkill('fanWind');
    expect(lost(inside)).toBeCloseTo(30);
    expect(lost(outside)).toBe(0);
    const plain = heroBattle();
    const mid = foe(plain, 'grimReaper', HX + 250);
    plain.castSkill('fanWind');
    expect(lost(mid)).toBe(0);
  });

  it('부채 바람 돌풍: 피해 x2 (30 -> 60), 넉백 x1.5 (80 -> 120), 범위는 그대로', () => {
    const b = heroBattle({ fanWindGust: 1 });
    const e = foe(b, 'grimReaper', HX + 100);
    const far = foe(b, 'grimReaper', HX + 250);
    b.castSkill('fanWind');
    expect(lost(e)).toBeCloseTo(60);
    expect(e.x).toBeCloseTo(HX + 220);
    expect(lost(far)).toBe(0);
  });

  it('축원 큰 굿: 범위 200 -> 300, 회복 25% -> 40%', () => {
    const b = heroBattle({ blessingGrandRite: 1 });
    const inside = ally(b, 'clubGoblin', HX + 290);
    const outside = ally(b, 'clubGoblin', HX + 330);
    inside.hp = outside.hp = 10;
    b.castSkill('blessing');
    expect(inside.hp).toBeCloseTo(10 + 120 * 0.4);
    expect(outside.hp).toBe(10);
    expect(inside.status!.attackBonus).toBeCloseTo(0.25); // 공격력 버프는 그대로
    const plain = heroBattle();
    const a = ally(plain, 'clubGoblin', HX + 100);
    a.hp = 10;
    plain.castSkill('blessing');
    expect(a.hp).toBeCloseTo(10 + 120 * 0.25);
  });

  it('축원 신명 풀이: 공격력 버프 +50%p (25% -> 75%), 회복은 그대로', () => {
    const b = heroBattle({ blessingSpiritRelease: 1 });
    const a = ally(b, 'clubGoblin', HX + 100);
    a.hp = 10;
    b.castSkill('blessing');
    expect(a.status!.attackBonus).toBeCloseTo(0.75);
    expect(a.hp).toBeCloseTo(10 + 120 * 0.25);
  });

  it('축원 신명 풀이: 버프 중 공격력 x1.75 (방망이병 14 -> 24.5)', () => {
    const b = heroBattle({ blessingSpiritRelease: 1 });
    const a = ally(b, 'clubGoblin', HX + 100);
    b.castSkill('blessing');
    const e = foe(b, 'grimReaper', HX + 130);
    b.step(0.05);
    for (let t = 0; t < 2 && lost(e) === 0; t += 0.05) b.step(0.05);
    expect(a.status!.attackBonus).toBeCloseTo(0.75);
    expect(lost(e)).toBeCloseTo(14 * 1.75);
  });

  it('작두 타기 칼날 춤: 3초간 초당 40, 총 추가 피해 120', () => {
    const b = heroBattle({ bladeDanceBlades: 1 });
    const e = foe(b, 'grimReaper', HX + 100);
    b.castSkill('bladeDance');
    expect(lost(e)).toBeCloseTo(200); // 즉시 피해
    b.hero.status!.stun(10000, false); // 영웅이 때리지 못하게 한다
    b.step(1);
    expect(lost(e)).toBeCloseTo(240);
    b.step(5);
    expect(lost(e)).toBeCloseTo(320);
    const plain = heroBattle();
    const p = foe(plain, 'grimReaper', HX + 100);
    plain.castSkill('bladeDance');
    plain.hero.status!.stun(10000, false);
    plain.step(5);
    expect(lost(p)).toBeCloseTo(200);
  });

  it('작두 타기 신내림: 쿨타임 40 -> 24초', () => {
    const b = heroBattle({ bladeDancePossession: 1 });
    expect(b.castSkill('bladeDance')).toBe('ok');
    expect(b.skillCooldown('bladeDance')).toBeCloseTo(24);
    expect(b.skillCooldownMax('bladeDance')).toBeCloseTo(24);
    expect(b.skillCooldownMax('fanWind')).toBe(6);
  });
});

describe('요괴 ① 기본: 체력·공격력 +25% (10종)', () => {
  it.each(ALLIES.map((a) => [a.id, a.maxHp, a.attack] as const))('%s', (id, hp, attack) => {
    const b = newBattle({ [`${id}Basic`]: 1 });
    const a = ally(b, id, 500);
    expect(a.maxHp).toBeCloseTo(hp * 1.25);
    expect(a.hp).toBeCloseTo(hp * 1.25);
    expect(a.attackPower).toBeCloseTo(attack * 1.25);
    // 다른 유닛은 그대로
    const other = ALLIES.find((x) => x.id !== id)!;
    expect(ally(b, other.id, 500).maxHp).toBe(other.maxHp);
  });
});

describe('요괴 방망이병', () => {
  it('② 핵심: 비용 30 -> 24, 쿨타임 1.5 -> 1.05', () => {
    const b = newBattle({ clubGoblinCore: 1 });
    expect(b.allyDef(0).cost).toBe(24);
    b.resources.talisman = 100;
    expect(b.summon(0)).toBe('ok');
    expect(b.resources.talisman).toBe(76);
    expect(b.summonCooldown(0)).toBeCloseTo(1.05);
  });

  it('③ 뚝딱: 처치 시 10% 확률로 1마리 추가 소환 (주입 RNG)', () => {
    const win = newBattle({ clubGoblinAwaken: 1 }, { rng: constRng(0.05) });
    ally(win, 'clubGoblin', 500);
    foe(win, 'eggGhost', 510, true, 1);
    win.step(0.05);
    expect(win.allies.map((a) => a.defId)).toEqual(['clubGoblin', 'clubGoblin']);

    const lose = newBattle({ clubGoblinAwaken: 1 }, { rng: constRng(0.1) }); // 경계값은 실패
    ally(lose, 'clubGoblin', 500);
    foe(lose, 'eggGhost', 510, true, 1);
    lose.step(0.05);
    expect(lose.allies).toHaveLength(1);

    const none = newBattle({}, { rng: constRng(0.0) });
    ally(none, 'clubGoblin', 500);
    foe(none, 'eggGhost', 510, true, 1);
    none.step(0.05);
    expect(none.allies).toHaveLength(1);
  });

  it('③ 뚝딱: 아군 30마리 상한을 넘지 않는다', () => {
    const b = newBattle({ clubGoblinAwaken: 1 }, { rng: constRng(0) });
    const first = ally(b, 'clubGoblin', 500);
    for (let i = 1; i < COMBAT.maxAllies; i++) ally(b, 'haetae', 200 + i);
    expect(b.allies).toHaveLength(COMBAT.maxAllies);
    foe(b, 'eggGhost', first.x + 10, true, 1);
    b.step(0.05);
    expect(b.allies).toHaveLength(COMBAT.maxAllies);
  });
});

describe('요괴 외다리 도깨비', () => {
  it('② 핵심: 돌격 x3 -> x4 (18 -> 72)', () => {
    const b = newBattle({ oneLegGoblinCore: 1 });
    ally(b, 'oneLegGoblin', 500);
    const e = foe(b, 'eggGhost', 510);
    b.step(0.05);
    expect(lost(e)).toBeCloseTo(72);
  });

  it('③ 관통: 돌격 경로(자신~대상 너머 60)의 땅 위 적 모두에게 돌격 피해', () => {
    const b = newBattle({ oneLegGoblinCore: 1, oneLegGoblinAwaken: 1 });
    ally(b, 'oneLegGoblin', 500);
    const target = foe(b, 'eggGhost', 510);
    const onPath = foe(b, 'eggGhost', 560); // 대상 너머 60 이내
    const tooFar = foe(b, 'eggGhost', 600);
    const behind = foe(b, 'eggGhost', 480); // 뒤쪽
    const flyer = foe(b, 'eodduksini', 530); // 비행은 근접이 못 친다
    b.step(0.05);
    expect(lost(target)).toBeCloseTo(72);
    expect(lost(onPath)).toBeCloseTo(72);
    expect(lost(tooFar)).toBe(0);
    expect(lost(behind)).toBe(0);
    expect(lost(flyer)).toBe(0);
  });

  it('③ 관통은 첫 공격에만 나간다', () => {
    const b = newBattle({ oneLegGoblinAwaken: 1 });
    ally(b, 'oneLegGoblin', 500);
    foe(b, 'eggGhost', 510);
    const onPath = foe(b, 'eggGhost', 560);
    b.step(0.05);
    expect(lost(onPath)).toBeCloseTo(54); // 돌격 x3
    b.step(1.2); // 두 번째 공격
    expect(lost(onPath)).toBeCloseTo(54);
  });
});

describe('요괴 씨름 도깨비', () => {
  it('② 핵심: 2번째 공격마다 메치기 (넉백 60)', () => {
    const b = newBattle({ sumoGoblinCore: 1 });
    ally(b, 'sumoGoblin', 500);
    const e = foe(b, 'eggGhost', 510);
    b.step(1.4); // 공격 2번
    expect(lost(e)).toBeCloseTo(32);
    expect(e.x).toBeCloseTo(570);
  });

  it('③ 충돌: 메친 적이 뒤의 적과 부딪혀 둘 다 피해 40', () => {
    const b = newBattle({ sumoGoblinCore: 1, sumoGoblinAwaken: 1 });
    ally(b, 'sumoGoblin', 500);
    const thrown = foe(b, 'eggGhost', 510);
    const behind = foe(b, 'eggGhost', 540);
    const far = foe(b, 'eggGhost', 700);
    b.step(1.4);
    expect(lost(thrown)).toBeCloseTo(32 + 40);
    expect(lost(behind)).toBeCloseTo(40);
    expect(lost(far)).toBe(0);
  });

  it('③ 뒤에 적이 없거나 밀려나지 않는 보스면 충돌 없음', () => {
    const b = newBattle({ sumoGoblinCore: 1, sumoGoblinAwaken: 1 });
    ally(b, 'sumoGoblin', 500);
    const alone = foe(b, 'eggGhost', 510);
    b.step(1.4);
    expect(lost(alone)).toBeCloseTo(32);
  });
});

describe('요괴 여우불 사수', () => {
  it('② 핵심: 화상 초당 4 -> 7', () => {
    const b = newBattle({ foxfireArcherCore: 1 });
    ally(b, 'foxfireArcher', 500);
    const e = foe(b, 'eggGhost', 600);
    b.step(0.5);
    expect(e.status!.burnDps).toBe(7);
    const plain = newBattle();
    ally(plain, 'foxfireArcher', 500);
    const p = foe(plain, 'eggGhost', 600);
    plain.step(0.5);
    expect(p.status!.burnDps).toBe(4);
  });

  it('③ 쌍갈래: 대상 2명에게 한 발씩', () => {
    const b = newBattle({ foxfireArcherAwaken: 1 });
    ally(b, 'foxfireArcher', 500);
    const e1 = foe(b, 'eggGhost', 600);
    const e2 = foe(b, 'eggGhost', 650);
    const e3 = foe(b, 'eggGhost', 670);
    b.step(0.6);
    expect(e1.status!.burning).toBe(true);
    expect(e2.status!.burning).toBe(true);
    expect(e3.status!.burning).toBe(false);
  });

  it('③ 대상이 하나뿐이면 한 발만 나간다', () => {
    const b = newBattle({ foxfireArcherAwaken: 1 });
    ally(b, 'foxfireArcher', 500);
    foe(b, 'eggGhost', 600);
    b.step(0.05);
    expect(b.projectiles).toHaveLength(1);
  });
});

describe('요괴 구미호', () => {
  it('② 핵심: 범위 반경 60 -> 84', () => {
    const near = (levels: BuildLevels) => {
      const b = newBattle(levels);
      ally(b, 'gumiho', 500);
      foe(b, 'grimReaper', 600);
      const splash = foe(b, 'grimReaper', 690); // 대상에서 90 (몸 반지름 12 -> 78)
      b.step(0.5);
      return splash.hp < BIG_HP;
    };
    expect(near({ gumihoCore: 1 })).toBe(true);
    expect(near({})).toBe(false);
  });

  it('③ 불꽃 3연발: 공격마다 0.15초 간격으로 3발', () => {
    const hits = (levels: BuildLevels) => {
      const b = newBattle(levels);
      ally(b, 'gumiho', 500);
      foe(b, 'grimReaper', 600);
      b.step(1.0);
      return b.drainDamageEvents().filter((e) => e.kind !== 'burn' && !e.friendly).map((e) => e.amount);
    };
    expect(hits({ gumihoAwaken: 1 })).toEqual([22, 22, 22]);
    expect(hits({})).toEqual([22]);
  });

  it('③ 연발 중 대상이 죽으면 남은 발은 나가지 않는다', () => {
    const b = newBattle({ gumihoAwaken: 1 });
    ally(b, 'gumiho', 500);
    foe(b, 'grimReaper', 600, true, 10);
    b.step(1.0);
    const hits = b.drainDamageEvents().filter((e) => e.kind !== 'burn' && !e.friendly);
    expect(hits).toHaveLength(1);
  });
});

describe('요괴 불가사리', () => {
  it('② 핵심: 방어 파괴 최대 5 -> 8중첩', () => {
    const stacks = (levels: BuildLevels) => {
      const b = newBattle(levels);
      ally(b, 'bulgasari', 500);
      const e = foe(b, 'eggGhost', 510);
      b.step(12);
      return e.status!.defenseBreakStacks;
    };
    expect(stacks({ bulgasariCore: 1 })).toBe(8);
    expect(stacks({})).toBe(5);
  });

  it('③ 갑옷 적 처치: 체력 30% 회복, 이후 공격력 +5% 중첩', () => {
    const b = newBattle({ bulgasariAwaken: 1 });
    const bul = ally(b, 'bulgasari', 500);
    bul.hp = 100;
    foe(b, 'jangseungSpirit', 510, true, 1);
    const next = foe(b, 'eggGhost', 515);
    b.step(0.05);
    expect(bul.hp).toBeCloseTo(100 + 300 * 0.3);
    b.step(1.4); // 두 번째 공격: 20 x 1.05
    expect(lost(next)).toBeCloseTo(21);
  });

  it('③ 갑옷이 아닌 적을 잡으면 효과 없음', () => {
    const b = newBattle({ bulgasariAwaken: 1 });
    const bul = ally(b, 'bulgasari', 500);
    bul.hp = 100;
    foe(b, 'eggGhost', 510, true, 1);
    const next = foe(b, 'eggGhost', 515);
    b.step(1.5);
    expect(bul.hp).toBe(100);
    expect(lost(next)).toBeCloseTo(20);
  });
});

describe('요괴 해태', () => {
  it('② 핵심: 붙잡기 2 -> 3.5초', () => {
    const b = newBattle({ haetaeCore: 1 });
    ally(b, 'haetae', 500);
    const e = foe(b, 'eggGhost', 510, false);
    b.step(3.4);
    expect(e.status!.stunned).toBe(true);
    b.step(0.3);
    expect(e.status!.stunned).toBe(false);
    const plain = newBattle();
    ally(plain, 'haetae', 500);
    const p = foe(plain, 'eggGhost', 510, false);
    plain.step(2.3);
    expect(p.status!.stunned).toBe(false);
  });

  it('③ 정의의 수호: 반경 120 아군 받는 피해 -20%, 차사왕 오라 무효에는 꺼진다', () => {
    const b = newBattle({ haetaeAwaken: 1 });
    ally(b, 'haetae', 500);
    const near = ally(b, 'clubGoblin', 600);
    const far = ally(b, 'clubGoblin', 700);
    b.step(0.05);
    expect(near.status!.damageReduction).toBeCloseTo(0.2);
    expect(far.status!.damageReduction).toBe(0);
    b.setAllyBonusesSuppressed(true);
    b.step(0.05);
    expect(near.status!.damageReduction).toBe(0);
  });
});

describe('요괴 삼족오', () => {
  it('② 핵심: 오라 +20% -> +35%', () => {
    const b = newBattle({ samjokgoCore: 1 });
    ally(b, 'samjokgo', 500);
    const near = ally(b, 'clubGoblin', 600);
    b.step(0.05);
    expect(near.status!.attackBonus).toBeCloseTo(0.35);
    const plain = newBattle();
    ally(plain, 'samjokgo', 500);
    const p = ally(plain, 'clubGoblin', 600);
    plain.step(0.05);
    expect(p.status!.attackBonus).toBeCloseTo(0.2);
  });

  it('③ 태양 불꽃: 10초마다 반경 480 안 적 전체에 화상', () => {
    const b = newBattle({ samjokgoAwaken: 1 });
    const sam = ally(b, 'samjokgo', 500);
    const e1 = foe(b, 'eggGhost', 700);
    const e2 = foe(b, 'eggGhost', 900);
    const out = foe(b, 'eggGhost', 1100);
    const fireproof = foe(b, 'gangcheol', 800);
    // 삼족오가 앞으로 걸어가지 않게 제자리에 붙들어 둔다
    const hold = (seconds: number) => {
      for (let t = 0; t < seconds - 1e-9; t += 0.05) {
        b.step(0.05);
        sam.x = 500;
      }
    };
    hold(9.5);
    expect(e1.status!.burning).toBe(false);
    hold(0.7);
    expect(e1.status!.burning).toBe(true);
    expect(e2.status!.burning).toBe(true);
    expect(out.status!.burning).toBe(false);
    expect(fireproof.status!.burning).toBe(false);
    expect(e1.status!.burnDps).toBe(4);
  });
});

describe('오라 소유자 버프 해제', () => {
  /** 삼족오(500)와 방망이병(600)을 제자리에 두고 n초 진행 */
  const hold = (b: Battle, list: Fighter[], seconds: number) => {
    const xs = list.map((a) => a.x);
    for (let t = 0; t < seconds - 1e-9; t += 0.05) {
      b.step(0.05);
      list.forEach((a, i) => (a.x = xs[i]));
    }
  };

  it('저승사자 해제를 받은 삼족오 주변 아군의 공격력 오라가 사라지고 3초 뒤 복구된다', () => {
    const b = newBattle();
    const sam = ally(b, 'samjokgo', 500);
    const near = ally(b, 'clubGoblin', 600);
    hold(b, [sam, near], 0.05);
    expect(near.status!.attackBonus).toBeCloseTo(0.2);
    b.dispelBuffs(sam, 3);
    hold(b, [sam, near], 1);
    expect(near.status!.attackBonus).toBe(0);
    hold(b, [sam, near], 2.2);
    expect(near.status!.attackBonus).toBeCloseTo(0.2);
  });

  it('소유자가 아닌 대상만 해제되면 그 대상만 오라를 못 받는다', () => {
    const b = newBattle();
    const sam = ally(b, 'samjokgo', 500);
    const hit = ally(b, 'clubGoblin', 600);
    const other = ally(b, 'clubGoblin', 650);
    b.dispelBuffs(hit, 3);
    hold(b, [sam, hit, other], 0.1);
    expect(hit.status!.attackBonus).toBe(0);
    expect(other.status!.attackBonus).toBeCloseTo(0.2);
  });
});

describe('요괴 까치 떼', () => {
  it('② 핵심: 소환 시 2무리, 비용은 한 번만, 아군 상한 준수', () => {
    const b = newBattle({ magpieFlockCore: 1 });
    b.resources.talisman = 100;
    expect(b.summon(idx('magpieFlock'))).toBe('ok');
    expect(b.allies.map((a) => a.defId)).toEqual(['magpieFlock', 'magpieFlock']);
    expect(b.resources.talisman).toBe(75);

    const full = newBattle({ magpieFlockCore: 1 });
    for (let i = 0; i < COMBAT.maxAllies - 1; i++) ally(full, 'haetae', 200 + i);
    full.summon(idx('magpieFlock'));
    expect(full.allies).toHaveLength(COMBAT.maxAllies);
  });

  it('③ 비행 적 x3 (7 x 3 x 바람 1.5 = 31.5), 맞은 비행 적 0.3초 경직', () => {
    const b = newBattle({ magpieFlockAwaken: 1 });
    ally(b, 'magpieFlock', 500);
    const e = foe(b, 'eodduksini', 600, false);
    for (let t = 0; t < 1 && e.hp === BIG_HP; t += 0.05) b.step(0.05);
    expect(lost(e)).toBeCloseTo(31.5);
    expect(e.status!.stunned).toBe(true);
    b.step(0.35);
    expect(e.status!.stunned).toBe(false);
  });

  it('기본 까치는 x2 (21)이고 경직이 없다', () => {
    const b = newBattle();
    ally(b, 'magpieFlock', 500);
    const e = foe(b, 'eodduksini', 600, false);
    for (let t = 0; t < 1 && e.hp === BIG_HP; t += 0.05) b.step(0.05);
    expect(lost(e)).toBeCloseTo(21);
    expect(e.status!.stunned).toBe(false);
  });

  it('③ 땅 위 적에게는 x3가 적용되지 않는다', () => {
    const b = newBattle({ magpieFlockAwaken: 1 });
    ally(b, 'magpieFlock', 500);
    const e = foe(b, 'eggGhost', 600);
    for (let t = 0; t < 1 && e.hp === BIG_HP; t += 0.05) b.step(0.05);
    expect(lost(e)).toBeCloseTo(7);
  });
});

describe('요괴 영등 바람', () => {
  /** 영등 바람 오라 안의 방망이병을 물귀신이 쏜다. 영등·방망이병은 얼려 공격하지 못하게 한다 */
  function volley(levels: BuildLevels, roll: number) {
    const b = newBattle(levels, { rng: constRng(roll) });
    const wind = ally(b, 'yeongdeungWind', 500);
    const club = ally(b, 'clubGoblin', 520);
    wind.status!.stun(10000, false);
    club.status!.stun(10000, false);
    const shooter = foe(b, 'waterGhostThrower', 600, false);
    b.step(0.7);
    return { club, shooter, wind };
  }

  it('② 핵심: 오라 +15% -> +25% (이동·공격 속도)', () => {
    const b = newBattle({ yeongdeungWindCore: 1 });
    ally(b, 'yeongdeungWind', 500);
    const near = ally(b, 'clubGoblin', 600);
    b.step(0.05);
    expect(near.status!.attackSpeedBonus).toBeCloseTo(0.25);
    expect(near.status!.moveMultiplier).toBeCloseTo(1.25);
  });

  it('기본: 25% 빗나감이라 0.3을 굴리면 맞는다', () => {
    const { club, shooter } = volley({}, 0.3);
    expect(club.hp).toBe(120 - 9);
    expect(lost(shooter)).toBe(0);
  });

  it('핵심만: 25% 안에 들면 그냥 빗나간다', () => {
    const { club, shooter } = volley({ yeongdeungWindCore: 1 }, 0.2);
    expect(club.hp).toBe(120);
    expect(lost(shooter)).toBe(0);
  });

  it('③ 빗나감 50%: 0.3을 굴리면 빗나가고, 투사체가 쏜 적에게 같은 피해로 되돌아간다', () => {
    const { club, shooter } = volley({ yeongdeungWindAwaken: 1 }, 0.3);
    expect(club.hp).toBe(120);
    expect(lost(shooter)).toBeCloseTo(9);
  });

  it('③ 되돌아간 투사체는 다시 빗나가지 않는다', () => {
    const { shooter } = volley({ yeongdeungWindAwaken: 1 }, 0);
    expect(lost(shooter)).toBeCloseTo(9);
  });
});

describe('연계 노드', () => {
  it.each(ALL_SYNERGY_IDS)('%s 노드가 해당 연계를 켠다', (id) => {
    const b = newBattle({ [id]: 1 });
    expect(b.synergy.isEnabled(id)).toBe(true);
    for (const other of ALL_SYNERGY_IDS) if (other !== id) expect(b.synergy.isEnabled(other)).toBe(false);
  });

  it('찍은 연계는 실제 효과를 낸다 (도깨비 모임 Ⅰ: 공격 속도 +15%)', () => {
    const b = newBattle({ dokkaebiGatheringI: 1 });
    for (let i = 0; i < 3; i++) ally(b, 'clubGoblin', 500 + i);
    b.step(0.05);
    expect(b.allies[0].status!.attackSpeedBonus).toBeCloseTo(0.15);
  });

  it('옵션 synergies와 빌드 연계는 합집합이다', () => {
    const b = newBattle({ emberI: 1 }, { synergies: ['tailwindI'] });
    expect(b.synergy.isEnabled('emberI')).toBe(true);
    expect(b.synergy.isEnabled('tailwindI')).toBe(true);
    expect(b.synergy.isEnabled('emberII')).toBe(false);
  });
});

describe('살림', () => {
  it('넉넉한 시작 2레벨: 시작 부적 50 -> 100', () => {
    expect(newBattle({ generousStart: 2 }).resources.talisman).toBe(100);
    expect(new Battle().resources.talisman).toBe(RESOURCES.talisman.start);
  });

  it('부적 주머니 3레벨: 최대 200 -> 320', () => {
    const b = newBattle({ charmPouch: 3 });
    expect(b.resources.maxTalisman).toBe(320);
    b.resources.talisman = 319;
    b.step(1);
    expect(b.resources.talisman).toBe(320);
  });

  it('기운 순환 3레벨: 초당 8 -> 12.5, 가뭄은 합계에 곱해진다', () => {
    const b = newBattle({ qiCycle: 3 });
    expect(b.resources.talismanPerSec).toBeCloseTo(12.5);
    b.setTalismanChargeFactor(0.6);
    expect(b.resources.talismanPerSec).toBeCloseTo(7.5);
  });

  it('알뜰 살림 2레벨: 기운 모으기 비용 -40% (60 -> 36)', () => {
    const b = newBattle({ thriftyLiving: 2 });
    expect(b.resources.nextGatherCost).toBe(36);
    b.resources.talisman = 36;
    expect(b.gather()).toBe(true);
    expect(b.resources.talisman).toBe(0);
    expect(b.resources.nextGatherCost).toBe(66);
    expect(newBattle({ thriftyLiving: 1 }).resources.nextGatherCost).toBe(48);
  });

  it('전리품: 처치 부적 +50% (3 -> 4.5)', () => {
    const b = newBattle({ spoils: 1 });
    ally(b, 'clubGoblin', 500);
    foe(b, 'eggGhost', 510, true, 1);
    b.resources.talisman = 100;
    b.step(0.05);
    expect(b.resources.talisman).toBeCloseTo(100 + 8 * 0.05 + 4.5);
  });

  it('큰 살림: 기운 모으기 7단계, 6·7단계 비용 310·360, 단계당 충전 +3·최대 +60', () => {
    const b = newBattle({ bigEconomy: 1 });
    const costs: number[] = [];
    for (let i = 0; i < 7; i++) {
      costs.push(b.resources.nextGatherCost!);
      b.resources.talisman = 1000;
      expect(b.gather()).toBe(true);
    }
    expect(costs).toEqual([60, 110, 160, 210, 260, 310, 360]);
    expect(b.resources.gatherLevel).toBe(7);
    expect(b.resources.maxGatherLevel).toBe(7);
    expect(b.resources.nextGatherCost).toBeNull();
    expect(b.resources.maxTalisman).toBe(200 + 7 * 60);
    expect(b.resources.talismanPerSec).toBe(8 + 7 * 3);
    expect(b.gather()).toBe(false);
  });

  it('큰 살림이 없으면 5단계가 끝이다', () => {
    const b = newBattle();
    for (let i = 0; i < 5; i++) {
      b.resources.talisman = 1000;
      b.gather();
    }
    expect(b.resources.nextGatherCost).toBeNull();
  });

  it('신력 부적: 부적 100을 쓸 때마다 신력 +10 (소환·기운 모으기 누적)', () => {
    const b = newBattle({ spiritCharm: 1 });
    b.resources.spirit = 0;
    ally(b, 'haetae', 500); // 140 지출 -> +10, 누적 40
    expect(b.resources.spirit).toBe(10);
    ally(b, 'sumoGoblin', 500); // 60 지출 -> 누적 100 -> +10
    expect(b.resources.spirit).toBe(20);
    b.resources.talisman = 500;
    b.gather(); // 60
    expect(b.resources.spirit).toBe(20);
    ally(b, 'clubGoblin', 500); // 30 + (누적 60) -> 90
    expect(b.resources.spirit).toBe(20);
    ally(b, 'magpieFlock', 500); // 25 -> 115 -> +10
    expect(b.resources.spirit).toBe(30);

    const plain = newBattle();
    plain.resources.spirit = 0;
    ally(plain, 'haetae', 500);
    expect(plain.resources.spirit).toBe(0);
  });
});

describe('빌드가 없으면 기존과 같다', () => {
  it('기본 Battle과 빈 빌드 Battle의 첫 상태가 같다', () => {
    const a = new Battle({ stage: 3, rng: new SeededRng(5) });
    const b = new Battle({ stage: 3, rng: new SeededRng(5), modifiers: computeBuildEffects({}) });
    for (let i = 0; i < 400; i++) {
      a.step(0.05);
      b.step(0.05);
    }
    expect(b.elapsed).toBe(a.elapsed);
    expect(b.enemies.map((e) => [e.defId, e.x, e.hp])).toEqual(a.enemies.map((e) => [e.defId, e.x, e.hp]));
    expect(b.resources.talisman).toBe(a.resources.talisman);
    expect(b.castle.hp).toBe(a.castle.hp);
  });
});

describe('W1: 시전 이벤트에 실제 범위', () => {
  it('기본 범위와 업그레이드 범위가 이벤트에 담긴다', () => {
    const plain = heroBattle();
    plain.castSkill('fanWind');
    plain.castSkill('blessing');
    plain.resources.spirit = plain.resources.maxSpirit;
    plain.castSkill('bladeDance');
    expect(plain.drainCastEvents().map((e) => e.range)).toEqual([200, 200, 300]);

    const up = heroBattle({ fanWindTornado: 1, blessingGrandRite: 1 });
    up.castSkill('fanWind');
    up.castSkill('blessing');
    expect(up.drainCastEvents().map((e) => e.range)).toEqual([300, 300]);
  });
});

describe('버프 해제와 오라 소유자', () => {
  /** 적 투사체 하나를 대상에게 쏘고 한 틱 진행한 뒤 피해를 받았는지 */
  function shotHits(b: Battle, target: Fighter): boolean {
    const before = target.hp;
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
    return target.hp < before;
  }

  it('영등 오라 소유자가 해제 중이면 빗나감이 없고, 해제가 풀리면 다시 빗나간다 (주입 RNG 0.2)', () => {
    const b = newBattle({}, { rng: constRng(0.2) });
    const wind = ally(b, 'yeongdeungWind', 500);
    const club = ally(b, 'clubGoblin', 520);
    for (const a of [wind, club]) a.status!.stun(10000, false);
    club.hp = club.maxHp = BIG_HP;
    expect(shotHits(b, club)).toBe(false); // 기본 25% 안이라 빗나감
    b.dispelBuffs(wind, 3);
    expect(shotHits(b, club)).toBe(true);
    b.step(3.1);
    expect(shotHits(b, club)).toBe(false);
  });

  it('해태 ③ 오라와 연계 3종은 해태 해제 중에 꺼지고, 해제 후 복구된다', () => {
    const b = newBattle({ haetaeAwaken: 1, guardFormation: 1, divineBlessing: 1, guardianVowII: 1 });
    const haetae = ally(b, 'haetae', 500);
    const club = ally(b, 'clubGoblin', 560);
    const archer = ally(b, 'foxfireArcher', 450);
    for (const a of [haetae, club, archer]) a.status!.stun(10000, false);
    b.step(0.05);
    const clubReduction = club.status!.damageReduction;
    const archerReduction = archer.status!.damageReduction;
    expect(clubReduction).toBeCloseTo(0.2); // 정의의 수호 오라
    expect(archerReduction).toBeCloseTo(0.5); // 오라 0.2 + 수호 진형 0.3
    expect(club.maxHp).toBeCloseTo(156); // 신수의 축복

    b.dispelBuffs(haetae, 5);
    club.hp = 60;
    b.step(1);
    expect(club.status!.damageReduction).toBe(0);
    expect(archer.status!.damageReduction).toBe(0);
    expect(club.maxHp).toBe(120);
    expect(club.hp).toBe(60); // 수호의 맹세 Ⅱ 회복도 없음

    b.step(4.2);
    expect(club.status!.damageReduction).toBeCloseTo(clubReduction);
    expect(archer.status!.damageReduction).toBeCloseTo(archerReduction);
    expect(club.maxHp).toBeCloseTo(156);
    expect(club.hp).toBeGreaterThan(60);
  });

  it('차사왕 생존 중 오라 무효: 해태 오라와 연계가 모두 꺼진다', () => {
    const b = newBattle({ haetaeAwaken: 1, guardFormation: 1 });
    ally(b, 'haetae', 500);
    const archer = ally(b, 'foxfireArcher', 450);
    b.setAllyBonusesSuppressed(true);
    b.step(0.05);
    expect(archer.status!.damageReduction).toBe(0);
  });
});
