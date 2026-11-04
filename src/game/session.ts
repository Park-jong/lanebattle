import { TEST_MODE } from '../data/testMode';
import { detectGameMode, type GameMode } from './mode';
import { browserStorage, GameSave, KeyScopedStorage, resetSaveRequested, SAVE_KEY, type StorageLike } from './save';

/**
 * 모드에 맞는 저장을 만든다.
 * 테스트 모드는 테스트 키 하나만 접근하는 저장소를 쓰고, 신명 보너스와 넉넉한 엽전으로 시작한다
 */
export function createGameSave(mode: GameMode, search: string, storage: StorageLike | null): GameSave {
  const reset = resetSaveRequested(search);
  if (mode === 'test') {
    return new GameSave({
      storage: storage && new KeyScopedStorage(storage, TEST_MODE.saveKey),
      key: TEST_MODE.saveKey,
      reset,
      startYeopjeon: TEST_MODE.startYeopjeon,
      bonusSinmyeong: TEST_MODE.bonusSinmyeong,
    });
  }
  return new GameSave({ storage, key: SAVE_KEY, reset });
}

// 앱 전체가 쓰는 저장 인스턴스. 브라우저 localStorage를 쓰고, 없으면 메모리로 동작한다
const search = typeof window === 'undefined' ? '' : window.location.search;

export const gameMode: GameMode = detectGameMode();
export const isTestMode = gameMode === 'test';
export const gameSave = createGameSave(gameMode, search, browserStorage());
export const progress = gameSave.progress;
export const settings = gameSave.settings;
export const wallet = gameSave.wallet;
export const builds = gameSave.builds;
export const summonOrder = gameSave.summonOrder;
