import { browserStorage, GameSave, resetSaveRequested } from './save';

// 앱 전체가 쓰는 저장 인스턴스. 브라우저 localStorage를 쓰고, 없으면 메모리로 동작한다
const search = typeof window === 'undefined' ? '' : window.location.search;

export const gameSave = new GameSave({ storage: browserStorage(), reset: resetSaveRequested(search) });
export const progress = gameSave.progress;
export const settings = gameSave.settings;
export const wallet = gameSave.wallet;
export const builds = gameSave.builds;
export const summonOrder = gameSave.summonOrder;
