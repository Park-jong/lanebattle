import { BUILD_SLOTS, SINMYEONG_PURCHASE, STAR_RULES } from '../data/rewards';
import { VOLUME } from '../data/settings';
import { STAGES } from '../data/stages';
import { BuildBook, emptyBuildBookData, type BuildBookData } from './build';
import { MemoryProgress, type ProgressStore } from './progress';
import { clampVolume, type SettingsStore } from './settings';
import { SummonOrder, defaultSummonOrder, sanitizeSummonOrder } from './summonOrder';
import { Wallet, type PurseStore } from './wallet';

export const SAVE_KEY = 'kkoma-mudang-save';
export const SAVE_VERSION = 1;

/** localStorage와 같은 모양의 작은 인터페이스 (테스트에서 가짜로 교체) */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 저장되는 전체 데이터 */
export interface SaveData {
  version: number;
  /** 스테이지 번호 순서의 최고 별 */
  stars: number[];
  yeopjeon: number;
  purchases: number;
  builds: BuildBookData;
  /** 소환 버튼 순서: 아군 id 10개 (저장 칸과 무관한 전역) */
  summonOrder: string[];
  musicVolume: number;
  sfxVolume: number;
}

export function defaultSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    stars: new Array<number>(STAGES.length).fill(0),
    yeopjeon: 0,
    purchases: 0,
    builds: emptyBuildBookData(),
    summonOrder: defaultSummonOrder(),
    musicVolume: VOLUME.default,
    sfxVolume: VOLUME.default,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function intInRange(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback;
}

function sanitizeBuilds(raw: unknown): BuildBookData {
  const out = emptyBuildBookData();
  if (!isRecord(raw)) return out;
  out.activeSlot = intInRange(raw.activeSlot, 0, BUILD_SLOTS.count - 1, 0);
  if (Array.isArray(raw.slots)) {
    for (let i = 0; i < BUILD_SLOTS.count; i++) {
      const slot: unknown = raw.slots[i];
      if (!isRecord(slot)) continue;
      if (typeof slot.name === 'string') out.slots[i].name = slot.name.slice(0, BUILD_SLOTS.maxNameLength);
      if (isRecord(slot.levels)) {
        for (const [id, lv] of Object.entries(slot.levels)) {
          if (typeof lv === 'number' && Number.isInteger(lv) && lv > 0) out.slots[i].levels[id] = lv;
        }
      }
    }
  }
  return out;
}

/**
 * 저장된 값을 필드 단위로 보정한다. 알 수 없는 값은 기본값, 가능한 필드는 살린다.
 * 버전이 다르면 구조를 알 수 없으므로 전부 기본값
 */
export function sanitizeSave(raw: unknown): SaveData {
  const data = defaultSaveData();
  if (!isRecord(raw) || raw.version !== SAVE_VERSION) return data;
  if (Array.isArray(raw.stars)) {
    for (let i = 0; i < data.stars.length; i++) data.stars[i] = intInRange(raw.stars[i], 0, STAR_RULES.maxStars, 0);
  }
  data.yeopjeon = intInRange(raw.yeopjeon, 0, Number.MAX_SAFE_INTEGER, 0);
  data.purchases = intInRange(raw.purchases, 0, SINMYEONG_PURCHASE.maxPurchases, 0);
  data.builds = sanitizeBuilds(raw.builds);
  data.summonOrder = sanitizeSummonOrder(raw.summonOrder);
  data.musicVolume = clampVolume(typeof raw.musicVolume === 'number' ? raw.musicVolume : NaN);
  data.sfxVolume = clampVolume(typeof raw.sfxVolume === 'number' ? raw.sfxVolume : NaN);
  return data;
}

/** 문자열(JSON)을 읽어 보정한다. 깨졌으면 기본값 */
export function parseSave(text: string | null): SaveData {
  if (text === null) return defaultSaveData();
  try {
    return sanitizeSave(JSON.parse(text));
  } catch {
    return defaultSaveData();
  }
}

/** 저장 데이터를 보는 진행 기록 (바뀌면 저장 알림) */
class SavedProgress implements ProgressStore {
  private readonly memory = new MemoryProgress();

  constructor(
    private readonly data: SaveData,
    private readonly persist: () => void,
  ) {
    this.data.stars.forEach((s, i) => {
      if (s > 0) this.memory.recordResult(i, s);
    });
  }

  getBestStars(stage: number): number {
    return this.memory.getBestStars(stage);
  }

  recordResult(stage: number, stars: number): void {
    const before = this.memory.getBestStars(stage);
    this.memory.recordResult(stage, stars);
    const after = this.memory.getBestStars(stage);
    if (after !== before) {
      this.data.stars[stage] = after;
      this.persist();
    }
  }

  reset(): void {
    this.memory.reset();
    this.data.stars.fill(0);
    this.persist();
  }
}

class SavedPurse implements PurseStore {
  constructor(
    private readonly data: SaveData,
    private readonly persist: () => void,
  ) {}

  getYeopjeon(): number {
    return this.data.yeopjeon;
  }

  setYeopjeon(value: number): void {
    this.data.yeopjeon = value;
    this.persist();
  }

  getPurchases(): number {
    return this.data.purchases;
  }

  setPurchases(value: number): void {
    this.data.purchases = value;
    this.persist();
  }
}

class SavedSettings implements SettingsStore {
  constructor(
    private readonly data: SaveData,
    private readonly persist: () => void,
  ) {}

  get musicVolume(): number {
    return this.data.musicVolume;
  }

  get sfxVolume(): number {
    return this.data.sfxVolume;
  }

  setMusicVolume(value: number): void {
    const v = clampVolume(value);
    if (v === this.data.musicVolume) return;
    this.data.musicVolume = v;
    this.persist();
  }

  setSfxVolume(value: number): void {
    const v = clampVolume(value);
    if (v === this.data.sfxVolume) return;
    this.data.sfxVolume = v;
    this.persist();
  }

  reset(): void {
    this.data.musicVolume = VOLUME.default;
    this.data.sfxVolume = VOLUME.default;
    this.persist();
  }
}

export interface GameSaveOptions {
  /** 저장소. null이면 메모리로만 동작 */
  storage: StorageLike | null;
  key?: string;
  /** true면 시작할 때 저장을 지운다 (?resetSave=1) */
  reset?: boolean;
  /** 저장이 없을 때 시작하는 엽전 (기본 0) */
  startYeopjeon?: number;
  /** 신명 총량에 더하는 보너스 (기본 0, 저장하지 않음) */
  bonusSinmyeong?: number;
}

/**
 * 게임 저장의 중심: 진행 기록·설정·지갑·빌드를 한 JSON으로 묶어 저장한다.
 * 저장소가 없거나 예외가 나면 메모리로 계속 동작한다
 */
export class GameSave {
  readonly progress: ProgressStore;
  readonly settings: SettingsStore;
  readonly wallet: Wallet;
  readonly builds: BuildBook;
  readonly summonOrder: SummonOrder;

  private readonly data: SaveData;
  private readonly storage: StorageLike | null;
  private readonly key: string;
  /** 저장된 값이 없어 기본값으로 시작했는가 */
  private isFresh = false;

  constructor(options: GameSaveOptions) {
    this.storage = options.storage;
    this.key = options.key ?? SAVE_KEY;
    if (options.reset) this.safely(() => this.storage?.removeItem(this.key));
    this.data = this.load();
    if (this.isFresh) this.data.yeopjeon = options.startYeopjeon ?? 0;

    const persist = () => this.persist();
    this.progress = new SavedProgress(this.data, persist);
    this.settings = new SavedSettings(this.data, persist);
    this.wallet = new Wallet(this.progress, new SavedPurse(this.data, persist), options.bonusSinmyeong ?? 0);
    this.builds = new BuildBook(this.wallet, this.data.builds, persist);
    this.summonOrder = new SummonOrder(this.data.summonOrder, persist);
    // 저장 데이터와 맞지 않는 칸은 초기화하고 바로 저장한다
    if (this.builds.repair()) this.persist();
  }

  /** 지금 상태를 저장 형태로 돌려준다 */
  snapshot(): SaveData {
    return { ...this.data, stars: [...this.data.stars], builds: this.builds.toData(), summonOrder: this.summonOrder.toData() };
  }

  /** 이 저장 키의 데이터를 지운다 (메모리 상태는 그대로이므로 호출 뒤 새로 시작해야 한다) */
  clearStorage(): void {
    this.safely(() => this.storage?.removeItem(this.key));
  }

  private load(): SaveData {
    let text: string | null = null;
    this.safely(() => {
      text = this.storage?.getItem(this.key) ?? null;
    });
    this.isFresh = text === null;
    return parseSave(text);
  }

  private persist(): void {
    this.data.builds = this.builds.toData();
    this.data.summonOrder = this.summonOrder.toData();
    const json = JSON.stringify(this.data);
    this.safely(() => this.storage?.setItem(this.key, json));
  }

  private safely(action: () => void): void {
    try {
      action();
    } catch {
      // 저장소를 쓸 수 없으면(비공개 모드, 용량 초과 등) 메모리로만 계속한다
    }
  }
}

/**
 * 허용된 키 하나만 접근하는 저장소 래퍼.
 * 다른 키는 읽으면 null, 쓰기·삭제는 무시한다 (테스트 모드가 실제 저장을 건드리지 못하게 한다)
 */
export class KeyScopedStorage implements StorageLike {
  constructor(
    private readonly inner: StorageLike,
    private readonly allowedKey: string,
  ) {}

  getItem(key: string): string | null {
    return key === this.allowedKey ? this.inner.getItem(key) : null;
  }

  setItem(key: string, value: string): void {
    if (key === this.allowedKey) this.inner.setItem(key, value);
  }

  removeItem(key: string): void {
    if (key === this.allowedKey) this.inner.removeItem(key);
  }
}

/** 브라우저 localStorage. 접근 자체가 막혀 있으면 null */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** URL 쿼리에 ?resetSave=1이 있는가 */
export function resetSaveRequested(search: string): boolean {
  return new URLSearchParams(search).get('resetSave') === '1';
}
