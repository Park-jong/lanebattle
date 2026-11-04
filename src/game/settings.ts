import { VOLUME } from '../data/settings';

/** 소리 크기를 0~100 정수로 맞춘다. 숫자가 아니면 기본값 */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return VOLUME.default;
  return Math.max(VOLUME.min, Math.min(VOLUME.max, Math.round(value)));
}

/** 슬라이더 위치 비율(0~1) → 소리 크기 */
export function volumeFromRatio(ratio: number): number {
  return clampVolume(ratio * VOLUME.max);
}

/** 설정값 저장소 인터페이스 (나중에 localStorage 구현으로 교체) */
export interface SettingsStore {
  readonly musicVolume: number;
  readonly sfxVolume: number;
  setMusicVolume(value: number): void;
  setSfxVolume(value: number): void;
  reset(): void;
}

/** 메모리에만 보관하는 설정 */
export class MemorySettings implements SettingsStore {
  private music: number = VOLUME.default;
  private sfx: number = VOLUME.default;

  get musicVolume(): number {
    return this.music;
  }

  get sfxVolume(): number {
    return this.sfx;
  }

  setMusicVolume(value: number): void {
    this.music = clampVolume(value);
  }

  setSfxVolume(value: number): void {
    this.sfx = clampVolume(value);
  }

  reset(): void {
    this.music = VOLUME.default;
    this.sfx = VOLUME.default;
  }
}

export const settings: SettingsStore = new MemorySettings();
