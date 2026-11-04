import { describe, expect, it } from 'vitest';
import { BUILD_SLOTS } from '../data/rewards';
import { STAGES } from '../data/stages';
import { browserStorage, GameSave, parseSave, resetSaveRequested, SAVE_KEY, SAVE_VERSION, type StorageLike } from './save';

class FakeStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** 모든 접근에서 예외를 던지는 저장소 (사파리 비공개 모드 등) */
class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('denied');
  }
  setItem(): void {
    throw new Error('quota');
  }
  removeItem(): void {
    throw new Error('denied');
  }
}

function fill(save: GameSave) {
  save.progress.recordResult(0, 3);
  save.progress.recordResult(5, 2);
  save.wallet.addYeopjeon(500);
  save.wallet.buySinmyeong();
  save.settings.setMusicVolume(30);
  save.settings.setSfxVolume(55);
  save.builds.allocate('bellTraining');
  save.builds.setName(0, '주력');
  save.builds.selectSlot(1);
  save.builds.allocate('qiCycle');
}

describe('GameSave 왕복', () => {
  it('저장 후 새로 불러와도 같다', () => {
    const storage = new FakeStorage();
    const a = new GameSave({ storage });
    fill(a);
    const b = new GameSave({ storage });
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(b.progress.getBestStars(0)).toBe(3);
    expect(b.progress.getBestStars(5)).toBe(2);
    expect(b.wallet.yeopjeon).toBe(400);
    expect(b.wallet.purchases).toBe(1);
    expect(b.settings.musicVolume).toBe(30);
    expect(b.builds.activeIndex).toBe(1);
    expect(b.builds.getName(0)).toBe('주력');
    expect(b.builds.getSlot(0).getLevel('bellTraining')).toBe(1);
    expect(b.builds.getSlot(1).getLevel('qiCycle')).toBe(1);
  });

  it('JSON에 버전이 들어간다', () => {
    const storage = new FakeStorage();
    fill(new GameSave({ storage }));
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).version).toBe(SAVE_VERSION);
  });

  it('값이 바뀔 때만 저장한다', () => {
    const storage = new FakeStorage();
    let writes = 0;
    const origin = storage.setItem.bind(storage);
    storage.setItem = (k, v) => {
      writes++;
      origin(k, v);
    };
    const s = new GameSave({ storage });
    expect(writes).toBe(0);
    s.progress.recordResult(0, 2);
    s.progress.recordResult(0, 1); // 변화 없음
    s.settings.setMusicVolume(70); // 기본값과 같음
    expect(writes).toBe(1);
  });
});

describe('GameSave 안전성', () => {
  it('깨진 JSON이면 기본값', () => {
    const storage = new FakeStorage();
    storage.setItem(SAVE_KEY, '{not json');
    const s = new GameSave({ storage });
    expect(s.wallet.yeopjeon).toBe(0);
    expect(s.progress.getBestStars(0)).toBe(0);
    expect(s.settings.musicVolume).toBe(70);
  });

  it('일부 필드가 손상돼도 나머지는 산다', () => {
    const storage = new FakeStorage();
    fill(new GameSave({ storage }));
    const raw = JSON.parse(storage.map.get(SAVE_KEY)!);
    raw.yeopjeon = 'abc';
    raw.stars = 'oops';
    raw.musicVolume = 999;
    raw.purchases = -4;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    const s = new GameSave({ storage });
    expect(s.wallet.yeopjeon).toBe(0);
    expect(s.progress.getBestStars(0)).toBe(0);
    expect(s.settings.musicVolume).toBe(100);
    expect(s.settings.sfxVolume).toBe(55);
    expect(s.builds.getName(0)).toBe('주력');
  });

  it('별 배열의 개별 값만 깨져도 나머지 별은 산다', () => {
    const raw = { version: SAVE_VERSION, stars: [3, 'x', 9, -1, 2] };
    const d = parseSave(JSON.stringify(raw));
    expect(d.stars.slice(0, 5)).toEqual([3, 0, 3, 0, 2]);
    expect(d.stars).toHaveLength(STAGES.length);
  });

  it('버전이 다르면 기본값', () => {
    const d = parseSave(JSON.stringify({ version: 99, yeopjeon: 1000 }));
    expect(d.yeopjeon).toBe(0);
    expect(parseSave(JSON.stringify([1, 2])).yeopjeon).toBe(0);
    expect(parseSave('null').version).toBe(SAVE_VERSION);
  });

  it('빌드 데이터의 범위 밖 칸 번호와 잘못된 칸을 보정한다', () => {
    const raw = {
      version: SAVE_VERSION,
      builds: { activeSlot: 7, slots: [{ name: 5, levels: { bellTraining: 2, qiCycle: -1 } }, 'x'] },
    };
    const d = parseSave(JSON.stringify(raw));
    expect(d.builds.activeSlot).toBe(BUILD_SLOTS.count - 1);
    expect(d.builds.slots[0].name).toBe('');
    expect(d.builds.slots[0].levels).toEqual({ bellTraining: 2 });
    expect(d.builds.slots).toHaveLength(BUILD_SLOTS.count);
  });

  it('쓴 신명이 총량보다 많은 칸은 불러올 때 초기화하고 저장한다', () => {
    const storage = new FakeStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        builds: {
          activeSlot: 0,
          slots: [{ name: 'a', levels: { bellTraining: 3 } }, { name: '', levels: {} }, { name: '', levels: {} }],
        },
      }),
    );
    const s = new GameSave({ storage });
    expect(s.builds.current.spent()).toBe(0);
    expect(s.builds.getName(0)).toBe('a');
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).builds.slots[0].levels).toEqual({});
  });

  it('storage가 예외를 던져도 메모리로 동작한다', () => {
    const s = new GameSave({ storage: new ThrowingStorage() });
    fill(s);
    expect(s.progress.getBestStars(0)).toBe(3);
    expect(s.wallet.yeopjeon).toBe(400);
    expect(s.builds.getSlot(1).getLevel('qiCycle')).toBe(1);
  });

  it('storage가 없어도 동작한다', () => {
    const s = new GameSave({ storage: null });
    s.wallet.addYeopjeon(10);
    expect(s.wallet.yeopjeon).toBe(10);
  });

  it('reset 옵션이면 시작할 때 저장을 지운다', () => {
    const storage = new FakeStorage();
    fill(new GameSave({ storage }));
    const s = new GameSave({ storage, reset: true });
    expect(s.wallet.yeopjeon).toBe(0);
    expect(s.progress.getBestStars(0)).toBe(0);
    expect(storage.map.has(SAVE_KEY)).toBe(false);
  });

  it('?resetSave=1 판별', () => {
    expect(resetSaveRequested('?resetSave=1')).toBe(true);
    expect(resetSaveRequested('?stage=1&resetSave=1')).toBe(true);
    expect(resetSaveRequested('?resetSave=0')).toBe(false);
    expect(resetSaveRequested('')).toBe(false);
  });

  it('브라우저 저장소가 없는 환경에서는 null', () => {
    expect(browserStorage()).toBeNull();
  });
});
