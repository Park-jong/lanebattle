/** 전체화면으로 만들 요소 (표준 + webkit 접두사) */
export interface FullscreenTarget {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/** 전체화면 기능에 필요한 document 부분. 테스트에서 가짜 객체를 주입한다 */
export interface FullscreenDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: unknown;
  webkitFullscreenElement?: unknown;
  documentElement: FullscreenTarget;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** 화면 방향 잠금에 필요한 screen 부분 */
export interface FullscreenScreen {
  orientation?: { lock?: (orientation: 'landscape') => Promise<void> | void };
}

const CHANGE_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'] as const;

/** Fullscreen API 래퍼. 거부·미지원은 모두 조용히 무시한다 */
export class FullscreenController {
  constructor(
    private readonly doc: FullscreenDocument,
    private readonly screen: FullscreenScreen = {},
  ) {}

  /** 이 브라우저에서 전체화면을 쓸 수 있는지 (아이폰 사파리는 false) */
  get isSupported(): boolean {
    const enabled = this.doc.fullscreenEnabled || this.doc.webkitFullscreenEnabled;
    const target = this.doc.documentElement;
    return !!enabled && !!(target.requestFullscreen || target.webkitRequestFullscreen);
  }

  get isActive(): boolean {
    return !!(this.doc.fullscreenElement || this.doc.webkitFullscreenElement);
  }

  /** 사용자 입력(손을 뗀 순간) 안에서 호출해야 한다. 실패해도 예외를 던지지 않는다 */
  async enter(): Promise<void> {
    if (!this.isSupported || this.isActive) return;
    const target = this.doc.documentElement;
    try {
      if (target.requestFullscreen) await target.requestFullscreen();
      else await target.webkitRequestFullscreen?.();
    } catch {
      return;
    }
    try {
      await this.screen.orientation?.lock?.('landscape');
    } catch {
      // 잠금 미지원·거부는 무시한다
    }
  }

  async exit(): Promise<void> {
    if (!this.isActive) return;
    try {
      if (this.doc.exitFullscreen) await this.doc.exitFullscreen();
      else await this.doc.webkitExitFullscreen?.();
    } catch {
      // 이미 풀렸거나 거부됨
    }
  }

  toggle(): Promise<void> {
    return this.isActive ? this.exit() : this.enter();
  }

  /** 전체화면 상태가 바뀔 때 부를 함수를 등록하고, 해제 함수를 돌려준다 */
  subscribe(fn: (active: boolean) => void): () => void {
    const handler = () => fn(this.isActive);
    for (const type of CHANGE_EVENTS) this.doc.addEventListener(type, handler);
    return () => {
      for (const type of CHANGE_EVENTS) this.doc.removeEventListener(type, handler);
    };
  }
}

/** 손가락 입력일 때만 "모험 시작"에서 전체화면을 자동으로 시도한다 (마우스·펜·알 수 없음은 제외) */
export function shouldAutoEnter(pointerType: string | undefined): boolean {
  return pointerType === 'touch';
}

/**
 * 누른 포인터와 뗀 포인터가 같은지 확인한다.
 * 다른 버튼에서 누른 손가락이 이 버튼 위에서 떨어져도 토글되지 않게 한다.
 */
export class PressTracker {
  private pressed: number | undefined;

  down(id: number): void {
    this.pressed = id;
  }

  /** 뗀 포인터가 눌렀던 포인터와 같으면 true. 결과와 관계없이 기억을 비운다 */
  consumeUp(id: number): boolean {
    const matched = this.pressed !== undefined && this.pressed === id;
    this.pressed = undefined;
    return matched;
  }

  cancel(): void {
    this.pressed = undefined;
  }
}

/** Phaser 레지스트리에서 FullscreenController를 찾는 키 */
export const FULLSCREEN_KEY = 'fullscreen';
