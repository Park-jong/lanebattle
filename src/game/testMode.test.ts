import { describe, expect, it } from 'vitest';
import { TEST_MODE } from '../data/testMode';
import { TREE_IDS, UPGRADE_NODES, treeTotalCost } from '../data/upgrades';
import { KeyScopedStorage, SAVE_KEY, type StorageLike } from './save';
import { createGameSave } from './session';

/** 접근한 키를 기록하는 가짜 저장소 */
class SpyStorage implements StorageLike {
  readonly map = new Map<string, string>();
  readonly touched: string[] = [];
  getItem(key: string): string | null {
    this.touched.push(key);
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.touched.push(key);
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.touched.push(key);
    this.map.delete(key);
  }
}

const REAL_VALUE = '{"version":1,"real":true}';

function seeded(): SpyStorage {
  const s = new SpyStorage();
  s.map.set(SAVE_KEY, REAL_VALUE);
  return s;
}

describe('KeyScopedStorage', () => {
  it('허용한 키만 읽고 쓰고 지운다', () => {
    const inner = seeded();
    const scoped = new KeyScopedStorage(inner, 'a');
    scoped.setItem('a', '1');
    scoped.setItem(SAVE_KEY, 'x');
    expect(scoped.getItem('a')).toBe('1');
    expect(scoped.getItem(SAVE_KEY)).toBeNull();
    scoped.removeItem(SAVE_KEY);
    expect(inner.map.get(SAVE_KEY)).toBe(REAL_VALUE);
  });
});

describe('테스트 모드 세션', () => {
  it('빌드·구매·결과·설정을 해도 실제 키는 읽지도 쓰지도 않는다', () => {
    const storage = seeded();
    const save = createGameSave('test', '', storage);
    save.builds.allocate('bellTraining');
    save.wallet.buySinmyeong();
    save.progress.recordResult(0, 3);
    save.wallet.addYeopjeon(500);
    save.settings.setMusicVolume(10);
    save.summonOrder.reset();
    save.clearStorage();
    expect(storage.map.get(SAVE_KEY)).toBe(REAL_VALUE);
    expect(storage.touched).not.toContain(SAVE_KEY);
    expect(storage.touched.length).toBeGreaterThan(0);
  });

  it('?resetSave=1은 테스트 키만 지운다', () => {
    const storage = seeded();
    storage.map.set(TEST_MODE.saveKey, '{"version":1,"yeopjeon":5}');
    createGameSave('test', '?resetSave=1', storage);
    expect(storage.map.get(SAVE_KEY)).toBe(REAL_VALUE);
    expect(storage.map.get(TEST_MODE.saveKey)).toBeUndefined();
  });

  it('테스트 데이터 초기화는 테스트 키만 비우고 다시 시작하면 처음 재화다', () => {
    const storage = seeded();
    const first = createGameSave('test', '', storage);
    first.wallet.buySinmyeong();
    first.progress.recordResult(0, 3);
    expect(storage.map.has(TEST_MODE.saveKey)).toBe(true);
    first.clearStorage();
    expect(storage.map.has(TEST_MODE.saveKey)).toBe(false);
    expect(storage.map.get(SAVE_KEY)).toBe(REAL_VALUE);
    const second = createGameSave('test', '', storage);
    expect(second.wallet.yeopjeon).toBe(TEST_MODE.startYeopjeon);
    expect(second.wallet.purchases).toBe(0);
    expect(second.progress.getBestStars(0)).toBe(0);
  });

  it('신명 총량이 전체 업그레이드 비용 이상이고 별은 0부터 시작한다', () => {
    const save = createGameSave('test', '', seeded());
    const allCost = UPGRADE_NODES.reduce((s, n) => s + n.maxLevel * n.costPerLevel, 0);
    expect(TEST_MODE.bonusSinmyeong).toBeGreaterThanOrEqual(198);
    expect(save.wallet.starSinmyeong()).toBe(0);
    expect(save.wallet.totalSinmyeong()).toBeGreaterThanOrEqual(allCost);
    expect(save.wallet.yeopjeon).toBe(TEST_MODE.startYeopjeon);
  });

  it('배타 갈래는 한쪽씩 두고 전체 트리를 다 찍을 수 있다', () => {
    const save = createGameSave('test', '', null);
    const maxCost = TREE_IDS.reduce((s, t) => s + treeTotalCost(t), 0);
    expect(save.wallet.totalSinmyeong()).toBeGreaterThanOrEqual(maxCost);
    const picked = new Set<string>();
    for (let guard = 0; guard < 1000; guard++) {
      let progressed = false;
      for (const n of UPGRADE_NODES) {
        while ((save.builds.current.getLevel(n.id) ?? 0) < n.maxLevel && save.builds.allocate(n.id).ok) {
          progressed = true;
          picked.add(n.id);
        }
      }
      if (!progressed) break;
    }
    const groups = new Set(UPGRADE_NODES.map((n) => n.exclusiveGroup).filter(Boolean));
    expect(groups.size).toBeGreaterThan(0);
    for (const g of groups) {
      const chosen = UPGRADE_NODES.filter((n) => n.exclusiveGroup === g && save.builds.current.getLevel(n.id) > 0);
      expect(chosen).toHaveLength(1);
    }
    const free = UPGRADE_NODES.filter((n) => !n.exclusiveGroup);
    for (const n of free) expect(save.builds.current.getLevel(n.id)).toBe(n.maxLevel);
    expect(save.builds.availableSinmyeong()).toBeGreaterThanOrEqual(0);
  });
});

describe('일반 모드 세션', () => {
  it('기존 키만 쓰고 테스트 키는 건드리지 않으며 보너스가 없다', () => {
    const storage = new SpyStorage();
    storage.map.set(TEST_MODE.saveKey, 'keep');
    const save = createGameSave('normal', '', storage);
    save.wallet.addYeopjeon(10);
    expect(storage.map.has(SAVE_KEY)).toBe(true);
    expect(storage.touched).not.toContain(TEST_MODE.saveKey);
    expect(storage.map.get(TEST_MODE.saveKey)).toBe('keep');
    expect(save.wallet.totalSinmyeong()).toBe(0);
    expect(save.wallet.yeopjeon).toBe(10);
  });
});
