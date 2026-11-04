import { describe, expect, it } from 'vitest';
import { Build, BuildBook } from './build';
import { MemoryProgress } from './progress';
import { MemoryPurse, Wallet } from './wallet';

/** 총량을 임의로 정하는 가짜 공급자 */
function makeBook(total: number, onChange: () => void = () => {}) {
  const src = { total, totalSinmyeong: () => src.total };
  return { src, book: new BuildBook(src, undefined, onChange) };
}

function allocateAll(b: BuildBook, ids: string[]) {
  for (const id of ids) expect(b.allocate(id)).toEqual({ ok: true });
}

describe('Build 찍기', () => {
  it('신명 부족', () => {
    const { book: b } = makeBook(0);
    expect(b.allocate('bellTraining')).toEqual({ ok: false, reason: 'notEnoughSinmyeong' });
  });

  it('최대 레벨', () => {
    const { book: b } = makeBook(10);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining']);
    expect(b.allocate('bellTraining')).toEqual({ ok: false, reason: 'maxLevel' });
  });

  it('알 수 없는 노드', () => {
    const { book: b } = makeBook(10);
    expect(b.allocate('nope')).toEqual({ ok: false, reason: 'unknownNode' });
  });

  it('4점에서는 2단 불가, 5점에서는 가능', () => {
    const { book: b } = makeBook(20);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining', 'sturdyBody']); // 4점
    expect(b.current.isTierUnlocked('mudang', 2)).toBe(false);
    expect(b.allocate('quickRevive')).toEqual({ ok: false, reason: 'tierLocked' });
    allocateAll(b, ['sturdyBody']); // 5점
    expect(b.current.unlockedTier('mudang')).toBe(2);
    expect(b.allocate('quickRevive')).toEqual({ ok: true });
  });

  it('단 해금은 트리별로 센다', () => {
    const { book: b } = makeBook(20);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining', 'sturdyBody', 'sturdyBody']);
    expect(b.current.unlockedTier('salim')).toBe(1);
    expect(b.allocate('thriftyLiving')).toEqual({ ok: false, reason: 'tierLocked' });
  });

  it('② 핵심은 ① 없이 못 찍는다', () => {
    const { book: b } = makeBook(40);
    allocateAll(b, ['clubGoblinBasic', 'oneLegGoblinBasic', 'sumoGoblinBasic']); // 6점
    expect(b.allocate('foxfireArcherCore')).toEqual({ ok: false, reason: 'prerequisite' });
    allocateAll(b, ['clubGoblinCore']);
    expect(b.current.getLevel('clubGoblinCore')).toBe(1);
  });

  it('배타 갈래: 다른 쪽이 선택돼 있으면 거부', () => {
    const { book: b } = makeBook(40);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining', 'sturdyBody', 'sturdyBody', 'sturdyBody']);
    allocateAll(b, ['quickRevive', 'quickRevive', 'spiritSpring']); // 6 + 6 = 12
    expect(b.allocate('fanWindTornado')).toEqual({ ok: true });
    expect(b.allocate('fanWindGust')).toEqual({ ok: false, reason: 'exclusive' });
    expect(b.allocate('blessingGrandRite')).toEqual({ ok: true });
  });
});

describe('Build 빼기와 초기화', () => {
  it('선택하지 않은 노드는 뺄 수 없다', () => {
    const { book: b } = makeBook(5);
    expect(b.deallocate('bellTraining')).toEqual({ ok: false, reason: 'notAllocated' });
  });

  it('① 빼기는 ②가 있으면 거부 (연쇄 제거 없음)', () => {
    const { book: b } = makeBook(40);
    allocateAll(b, ['clubGoblinBasic', 'oneLegGoblinBasic', 'sumoGoblinBasic', 'clubGoblinCore']);
    expect(b.deallocate('clubGoblinBasic')).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: 'clubGoblinCore' });
    expect(b.current.getLevel('clubGoblinBasic')).toBe(1);
  });

  it('단 해금 기반이 되는 낮은 단 점수를 빼면 거부', () => {
    const { book: b } = makeBook(40);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining', 'sturdyBody', 'sturdyBody', 'quickRevive']);
    expect(b.deallocate('bellTraining')).toEqual({ ok: false, reason: 'tierDependency', dependentId: 'quickRevive' });
    // 2단 노드부터 빼면 가능
    expect(b.deallocate('quickRevive')).toEqual({ ok: true });
    expect(b.deallocate('bellTraining')).toEqual({ ok: true });
  });

  it('조건이 깨지지 않으면 뺄 수 있고 신명이 돌아온다', () => {
    const { book: b } = makeBook(5);
    b.allocate('bellTraining');
    expect(b.availableSinmyeong()).toBe(4);
    expect(b.deallocate('bellTraining')).toEqual({ ok: true });
    expect(b.availableSinmyeong()).toBe(5);
  });

  it('초기화는 쓴 신명을 전부 돌려준다', () => {
    const { book: b } = makeBook(10);
    allocateAll(b, ['bellTraining', 'sturdyBody', 'qiCycle']);
    expect(b.availableSinmyeong()).toBe(7);
    expect(b.reset()).toBe(3);
    expect(b.availableSinmyeong()).toBe(10);
    expect(b.current.spent()).toBe(0);
  });
});

describe('BuildBook 저장 칸', () => {
  it('칸 3개가 독립적이다', () => {
    const { book: b } = makeBook(10);
    b.allocate('bellTraining');
    b.selectSlot(1);
    expect(b.current.getLevel('bellTraining')).toBe(0);
    expect(b.availableSinmyeong()).toBe(10);
    b.allocate('sturdyBody');
    b.selectSlot(0);
    expect(b.current.getLevel('bellTraining')).toBe(1);
    expect(b.current.getLevel('sturdyBody')).toBe(0);
    expect(b.slotCount).toBe(3);
  });

  it('복사는 깊은 복사다', () => {
    const { book: b } = makeBook(10);
    b.allocate('bellTraining');
    b.setName(0, '주력');
    b.copySlot(0, 2);
    b.selectSlot(2);
    expect(b.getName(2)).toBe('주력');
    b.allocate('bellTraining');
    expect(b.getSlot(0).getLevel('bellTraining')).toBe(1);
    expect(b.getSlot(2).getLevel('bellTraining')).toBe(2);
  });

  it('범위 밖 칸은 RangeError', () => {
    const { book: b } = makeBook(10);
    expect(() => b.selectSlot(3)).toThrow(RangeError);
    expect(() => b.copySlot(0, -1)).toThrow(RangeError);
  });

  it('이름은 잘린다', () => {
    const { book: b } = makeBook(10);
    b.setName(0, '  가나다라마바사아자차카타파하  ');
    expect(b.getName(0).length).toBe(12);
  });

  it('쓴 신명이 총량보다 많은 칸은 repair로 초기화된다', () => {
    const { src, book: b } = makeBook(10);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining']);
    const data = b.toData();
    src.total = 2;
    const restored = new BuildBook(src, data);
    expect(restored.repair()).toBe(true);
    expect(restored.current.spent()).toBe(0);
    expect(restored.repair()).toBe(false);
  });

  it('규칙을 어긴 저장 칸(선행 없는 ②)도 초기화된다', () => {
    const { src } = makeBook(100);
    const restored = new BuildBook(src, {
      slots: [{ name: '', levels: { clubGoblinCore: 1 } }, { name: '', levels: {} }, { name: '', levels: {} }],
      activeSlot: 0,
    });
    expect(restored.repair()).toBe(true);
    expect(restored.current.spent()).toBe(0);
  });

  it('변경 때만 알림', () => {
    let n = 0;
    const { book: b } = makeBook(10, () => n++);
    b.allocate('nope');
    b.reset();
    expect(n).toBe(0);
    b.allocate('bellTraining');
    b.selectSlot(1);
    expect(n).toBe(2);
  });

  it('실제 Wallet과 연결: 별이 늘면 쓸 수 있는 신명이 는다', () => {
    const progress = new MemoryProgress();
    const wallet = new Wallet(progress, new MemoryPurse());
    const b = new BuildBook(wallet);
    expect(b.availableSinmyeong()).toBe(0);
    progress.recordResult(0, 3);
    expect(b.availableSinmyeong()).toBe(3);
  });
});

describe('Build 단독', () => {
  it('알 수 없는 id와 레벨은 걸러낸다', () => {
    const b = new Build({ bellTraining: 99, nope: 1, sturdyBody: 0 });
    expect(b.toData()).toEqual({ bellTraining: 3 });
  });
});

describe('M1: 요괴 트리 해금 규칙 (단 기준 없음)', () => {
  it('유닛 하나만 10점(2+3+5)으로 ③ 각성까지 찍는다', () => {
    const { book: b } = makeBook(10);
    allocateAll(b, ['clubGoblinBasic', 'clubGoblinCore', 'clubGoblinAwaken']);
    expect(b.current.spent()).toBe(10);
    expect(b.availableSinmyeong()).toBe(0);
  });

  it('요괴 트리는 모든 단이 열려 있다', () => {
    const { book: b } = makeBook(10);
    for (let t = 1; t <= 4; t++) expect(b.current.isTierUnlocked('yogoe', t)).toBe(true);
  });

  it('선행은 그대로 지킨다: ① 없이 ②, ② 없이 ③은 거부', () => {
    const { book: b } = makeBook(10);
    expect(b.allocate('clubGoblinCore')).toEqual({ ok: false, reason: 'prerequisite' });
    b.allocate('clubGoblinBasic');
    expect(b.allocate('clubGoblinAwaken')).toEqual({ ok: false, reason: 'prerequisite' });
  });

  it('빼기도 같은 규칙: 위 단계가 있으면 아래를 못 빼고, 위부터 빼면 된다', () => {
    const { book: b } = makeBook(10);
    allocateAll(b, ['clubGoblinBasic', 'clubGoblinCore', 'clubGoblinAwaken']);
    expect(b.deallocate('clubGoblinCore')).toEqual({ ok: false, reason: 'prerequisiteDependency', dependentId: 'clubGoblinAwaken' });
    expect(b.deallocate('clubGoblinAwaken')).toEqual({ ok: true });
    expect(b.deallocate('clubGoblinCore')).toEqual({ ok: true });
    expect(b.deallocate('clubGoblinBasic')).toEqual({ ok: true });
  });

  it('무당·연계·살림은 기존 규칙(낮은 단들에 쓴 신명)을 그대로 쓴다', () => {
    const { book: b } = makeBook(40);
    expect(b.allocate('deepSpirit')).toEqual({ ok: false, reason: 'tierLocked' });
    expect(b.allocate('emberII')).toEqual({ ok: false, reason: 'tierLocked' });
    expect(b.allocate('bigEconomy')).toEqual({ ok: false, reason: 'tierLocked' });
    // 요괴에 쓴 신명은 다른 트리의 단 해금에 기여하지 않는다
    allocateAll(b, ['clubGoblinBasic', 'clubGoblinCore', 'clubGoblinAwaken']);
    expect(b.allocate('quickRevive')).toEqual({ ok: false, reason: 'tierLocked' });
  });

  it('요괴 규칙을 어긴 저장(선행 없는 ③)은 repair가 초기화한다', () => {
    const { src } = makeBook(100);
    const restored = new BuildBook(src, {
      slots: [{ name: '', levels: { clubGoblinBasic: 1, clubGoblinAwaken: 1 } }, { name: '', levels: {} }, { name: '', levels: {} }],
      activeSlot: 0,
    });
    expect(restored.repair()).toBe(true);
    expect(restored.current.spent()).toBe(0);
  });
});

describe('L5 빼기 거부 사유 세분화', () => {
  it('단 해금이 깨지면 tierDependency와 필요로 하는 노드 id', () => {
    const { book: b } = makeBook(40);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining', 'sturdyBody', 'sturdyBody', 'spiritSpring']);
    const r = b.deallocate('sturdyBody');
    expect(r).toEqual({ ok: false, reason: 'tierDependency', dependentId: 'spiritSpring' });
  });

  it('선행이 깨지면 prerequisiteDependency (단 해금과 구분)', () => {
    const { book: b } = makeBook(40);
    allocateAll(b, ['clubGoblinBasic', 'clubGoblinCore']);
    const r = b.canDeallocate('clubGoblinBasic');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('prerequisiteDependency');
  });

  it('레벨이 2 이상이면 한 단계 빼도 선행은 유지된다', () => {
    const { book: b } = makeBook(40);
    allocateAll(b, ['bellTraining', 'bellTraining', 'bellTraining', 'sturdyBody']);
    expect(b.canDeallocate('bellTraining')).toEqual({ ok: true });
  });
});
