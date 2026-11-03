import { describe, expect, it } from 'vitest';
import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { RESOURCES } from '../data/resources';
import { Battle } from './battle';
import { createEnemy } from './enemyFactory';
import { Body, Projectile } from './entities';
import { Hero } from './hero';
import { SeededRng } from './rng';
import { Resources } from './resources';
import { availableEnemyIds, waveBudget, WaveDirector } from './wave';
import { getEnemyDef } from '../data/enemies';

const newBattle = (stage = 0) => new Battle({ stage, rng: new SeededRng(1) });
const idx = (id: string) => ALLIES.findIndex((a) => a.id === id);
const resetCooldowns = (b: Battle) => (b as unknown as { cooldowns: number[] }).cooldowns.fill(0);

describe('자원', () => {
  it('부적과 신력이 초당 충전되고 최대치를 넘지 않는다', () => {
    const r = new Resources();
    r.step(1);
    expect(r.talisman).toBeCloseTo(RESOURCES.talisman.start + RESOURCES.talisman.chargePerSec);
    expect(r.spirit).toBeCloseTo(RESOURCES.spirit.start + RESOURCES.spirit.chargePerSec);
    r.step(1000);
    expect(r.talisman).toBe(RESOURCES.talisman.max);
    expect(r.spirit).toBe(RESOURCES.spirit.max);
  });

  it('영웅 기본 공격 적중 시 신력 +2', () => {
    const b = newBattle();
    const e = b.spawnEnemy('eggGhost', false, 140);
    const before = b.resources.spirit;
    b.step(0.05);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(b.resources.spirit).toBeCloseTo(before + RESOURCES.spirit.perHeroHit + RESOURCES.spirit.chargePerSec * 0.05);
  });

  it('기운 모으기는 비용을 쓰고 충전·최대치를 올린다', () => {
    const r = new Resources();
    r.talisman = 200;
    expect(r.gather()).toBe(true);
    expect(r.talisman).toBe(140);
    expect(r.gatherLevel).toBe(1);
    expect(r.maxTalisman).toBe(260);
    expect(r.talismanPerSec).toBe(11);
  });

  it('기운 모으기 5단계 비용과 최종 효과, 부적 부족 시 실패', () => {
    const r = new Resources();
    expect(r.gather()).toBe(false); // 50 < 60
    const costs: number[] = [];
    for (let i = 0; i < 5; i++) {
      costs.push(r.nextGatherCost!);
      r.talisman = r.maxTalisman;
      r.talisman = Math.max(r.talisman, r.nextGatherCost!);
      expect(r.gather()).toBe(true);
    }
    expect(costs).toEqual([60, 110, 160, 210, 260]);
    expect(r.maxTalisman).toBe(500);
    expect(r.talismanPerSec).toBe(23);
    expect(r.nextGatherCost).toBeNull();
    r.talisman = 500;
    expect(r.gather()).toBe(false);
  });
});

describe('소환', () => {
  it('비용을 쓰고 쿨타임 동안 재소환할 수 없다', () => {
    const b = newBattle();
    const i = idx('clubGoblin');
    const def = ALLIES[i];
    expect(b.summon(i)).toBe('ok');
    expect(b.resources.talisman).toBe(RESOURCES.talisman.start - def.cost);
    expect(b.allies).toHaveLength(1);
    expect(b.summon(i)).toBe('cooldown');
    b.step(def.cooldown + 0.01);
    expect(b.summon(i)).toBe('ok');
  });

  it('부적이 부족하면 소환할 수 없다', () => {
    const b = newBattle();
    expect(b.summon(idx('samjokgo'))).toBe('noTalisman');
    expect(b.allies).toHaveLength(0);
  });

  it('아군은 최대 30마리', () => {
    const b = newBattle();
    for (let n = 0; n < COMBAT.maxAllies; n++) {
      resetCooldowns(b);
      b.resources.addTalisman(1000);
      expect(b.summon(idx('magpieFlock'))).toBe('ok');
    }
    resetCooldowns(b);
    b.resources.addTalisman(1000);
    expect(b.summon(idx('magpieFlock'))).toBe('full');
    expect(b.allies).toHaveLength(COMBAT.maxAllies);
  });
});

describe('유닛 전투', () => {
  it('상대가 없으면 전진한다', () => {
    const b = newBattle();
    b.summon(idx('clubGoblin'));
    const ally = b.allies[0];
    const x0 = ally.x;
    b.step(1);
    expect(ally.x).toBeCloseTo(x0 + ALLIES[idx('clubGoblin')].speed);
  });

  it('사거리 안에 상대가 있으면 멈추고 공격한다', () => {
    const b = newBattle();
    b.summon(idx('clubGoblin'));
    const ally = b.allies[0];
    const enemy = b.spawnEnemy('eggGhost', false, ally.x + 30);
    const x0 = ally.x;
    b.step(0.05);
    expect(ally.x).toBe(x0);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
  });

  it('적은 왼쪽으로 전진하고 서낭당을 공격한다', () => {
    const b = newBattle();
    const enemy = b.spawnEnemy('eggGhost', false, 1000);
    b.step(1);
    expect(enemy.x).toBeCloseTo(1000 - getEnemyDef('eggGhost').speed);
    const near = b.spawnEnemy('eggGhost', false, COMBAT.shrine.x + 20);
    b.step(0.05);
    expect(near.x).toBe(COMBAT.shrine.x + 20);
    expect(b.shrine.hp).toBeLessThan(COMBAT.shrine.maxHp);
  });

  it('원거리 유닛은 투사체를 쏘고 투사체가 명중한다', () => {
    const b = newBattle();
    b.summon(idx('foxfireArcher'));
    const enemy = b.spawnEnemy('jangseungSpirit', false, b.allies[0].x + 150);
    b.step(0.05);
    expect(b.projectiles.length).toBeGreaterThan(0);
    expect(enemy.hp).toBe(enemy.maxHp); // 아직 도달 전
    b.step(1);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
  });

  it('투사체는 속도로 날아가 대상에 닿으면 명중한다', () => {
    const target = new Hero();
    const p = new Projectile('enemy', target.x + 200, target, 5, 100, 'ranged');
    expect(p.update(1)).toBe(false);
    expect(p.x).toBeCloseTo(target.x + 100);
    expect(p.update(1)).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('투사체는 대상이 죽으면 사라진다', () => {
    const target = new Hero();
    const p = new Projectile('enemy', target.x + 200, target, 5, 100, 'ranged');
    target.hp = 0;
    expect(p.update(0.1)).toBe(false);
    expect(p.alive).toBe(false);
  });

  it('적을 처치하면 처치 부적을 받는다', () => {
    const b = newBattle();
    const enemy = b.spawnEnemy('waterGhostThrower', false, 140);
    enemy.hp = 1;
    const before = b.resources.talisman;
    b.step(0.05);
    expect(b.enemies).toHaveLength(0);
    const expected = before + getEnemyDef('waterGhostThrower').killTalisman + RESOURCES.talisman.chargePerSec * 0.05;
    expect(b.resources.talisman).toBeCloseTo(expected);
  });
});

describe('영웅', () => {
  it('양쪽 기지 사이로만 이동한다', () => {
    const b = newBattle();
    b.step(5, { moveDir: -1 });
    expect(b.hero.x).toBe(COMBAT.shrine.x);
    b.hero.x = COMBAT.castle.x - 10;
    b.step(1, { moveDir: 1 });
    expect(b.hero.x).toBe(COMBAT.castle.x);
  });

  it('사망 후 4 + 위협 단계초 뒤 서낭당 앞에서 부활한다', () => {
    const b = newBattle();
    b.hero.hp = 1;
    b.spawnEnemy('dueoksini', false, 140);
    b.step(0.05);
    expect(b.hero.alive).toBe(false);
    expect(b.hero.respawnTimer).toBeCloseTo(HERO.respawn.base + 1);
    b.enemies = [];
    b.step(4.8);
    expect(b.hero.alive).toBe(false);
    b.step(0.4);
    expect(b.hero.alive).toBe(true);
    expect(b.hero.hp).toBe(HERO.maxHp);
    expect(b.hero.x).toBe(HERO.respawnX);
  });

  it('위협 단계는 30초마다 오르고 부활 시간은 최대 10초', () => {
    const b = newBattle();
    expect(b.threatLevel).toBe(1);
    b.elapsed = 30;
    expect(b.threatLevel).toBe(2);
    const h = new Hero();
    h.beginRespawn(20);
    expect(h.respawnTimer).toBe(HERO.respawn.max);
  });

  it('체력이 초당 3 회복된다', () => {
    const b = newBattle();
    b.hero.hp = 100;
    b.step(1);
    expect(b.hero.hp).toBeCloseTo(103);
  });
});

describe('웨이브', () => {
  it('예산 공식', () => {
    expect(waveBudget(0, 0)).toBe(6);
    expect(waveBudget(0, 8)).toBe(22);
    expect(waveBudget(7, 0)).toBe(6 + 3 + 2); // 2장 3번째
    expect(waveBudget(24, 8)).toBe(6 + 16 + 12 + 4);
  });

  it('장·스테이지별 등장 적 제한', () => {
    expect(availableEnemyIds(0).sort()).toEqual(['eggGhost', 'waterGhostThrower']);
    expect(availableEnemyIds(2)).toContain('maidenGhost');
    expect(availableEnemyIds(2)).not.toContain('geuseundae');
    expect(availableEnemyIds(3)).toContain('geuseundae');
    expect(availableEnemyIds(5)).toContain('jangseungSpirit');
    expect(availableEnemyIds(5)).not.toContain('eodduksini');
    expect(availableEnemyIds(7)).toContain('eodduksini');
    expect(availableEnemyIds(15)).not.toContain('dueoksini'); // 4-1
    expect(availableEnemyIds(15)).toContain('grimReaper');
    expect(availableEnemyIds(16)).toContain('dueoksini');
    expect(availableEnemyIds(24)).toHaveLength(10);
  });

  it('웨이브 구성은 예산과 등장 목록을 지킨다', () => {
    for (const stage of [0, 3, 8, 24]) {
      const d = new WaveDirector(stage, new SeededRng(stage + 5));
      const ids = availableEnemyIds(stage);
      for (let w = 0; w < 12; w++) {
        const wave = d.composeWave(w).filter((s) => !s.elite);
        const cost = wave.reduce((sum, s) => sum + getEnemyDef(s.enemyId).waveScore, 0);
        expect(cost).toBeLessThanOrEqual(waveBudget(stage, Math.min(w, 8)));
        expect(wave.length).toBeGreaterThan(0);
        for (const s of wave) expect(ids).toContain(s.enemyId);
      }
    }
  });

  it('정예는 일반 스테이지 9번째 웨이브에만 1마리', () => {
    const d = new WaveDirector(0, new SeededRng(3));
    expect(d.composeWave(7).some((s) => s.elite)).toBe(false);
    expect(d.composeWave(8).filter((s) => s.elite)).toHaveLength(1);
    expect(d.composeWave(9).some((s) => s.elite)).toBe(false);
    const boss = new WaveDirector(4, new SeededRng(3));
    expect(boss.composeWave(8).some((s) => s.elite)).toBe(false);
  });

  it('첫 웨이브는 5초, 이후 20초 간격, 0.8초 간격으로 내보낸다', () => {
    const b = newBattle();
    b.step(4.9);
    expect(b.enemies).toHaveLength(0);
    expect(b.waveCount).toBe(0);
    b.step(0.2);
    expect(b.waveCount).toBe(1);
    expect(b.enemies).toHaveLength(1); // 한 번에 한 마리씩
    b.step(0.85);
    expect(b.enemies.length).toBe(2);
    b.step(25 - 5.95 + 0.1);
    expect(b.waveCount).toBe(2);
  });
});

describe('적 수치 성장', () => {
  it('스테이지 번호만큼 체력 12%, 공격력 6% 성장', () => {
    const base = getEnemyDef('gangcheol');
    const e = createEnemy('gangcheol', 10, false, 0);
    expect(e.maxHp).toBeCloseTo(base.maxHp * 2.2);
    expect(e.stats.attack).toBeCloseTo(base.attack * 1.6);
    const e0 = createEnemy('gangcheol', 0, false, 0);
    expect(e0.maxHp).toBe(base.maxHp);
  });

  it('정예는 체력 x4, 공격력 x1.5, 크기 x1.5', () => {
    const base = getEnemyDef('eggGhost');
    const e = createEnemy('eggGhost', 0, true, 0);
    expect(e.maxHp).toBe(base.maxHp * 4);
    expect(e.stats.attack).toBe(base.attack * 1.5);
    expect(e.stats.scale).toBe(1.5);
    expect(e.radius).toBe((base.width * 1.5) / 2);
  });

  it('원귀의 성 체력은 1200 + 150 x 스테이지', () => {
    expect(newBattle(0).castle.maxHp).toBe(1200);
    expect(newBattle(24).castle.maxHp).toBe(4800);
  });
});

describe('승패', () => {
  it('원귀의 성이 부서지면 승리하고 이후 진행이 멈춘다', () => {
    const b = newBattle();
    b.hero.x = COMBAT.castle.x - 40;
    b.castle.hp = 10;
    b.step(0.05);
    expect(b.result).toBe('victory');
    const t = b.elapsed;
    b.step(1);
    expect(b.elapsed).toBe(t);
    expect(b.summon(0)).toBe('ended');
  });

  it('서낭당이 부서지면 패배한다', () => {
    const b = newBattle();
    b.shrine.hp = 1;
    b.spawnEnemy('eggGhost', false, COMBAT.shrine.x + 20);
    b.step(0.05);
    expect(b.result).toBe('defeat');
  });

  it('Body.takeDamage는 최소 1 피해', () => {
    class Dummy extends Body {
      constructor() {
        super('unit', 'enemy', 0, 10, 5);
      }
    }
    const d = new Dummy();
    d.takeDamage(0);
    expect(d.hp).toBe(9);
  });
});
