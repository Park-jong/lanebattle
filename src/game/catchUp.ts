/** 탭이 숨겨진 동안 못 흐른 전투 시간을 복귀 후 여러 프레임에 나눠 따라잡는다 (Phaser 비의존) */

export const CATCH_UP = {
  /** 따라잡을 최대 경과 시간(초). 이보다 오래 비워도 이만큼만 진행 (2시간) */
  maxSeconds: 7200,
  /** 한 프레임에 처리할 전투 시간(초). 0.05초 틱 기준 1200틱 */
  frameSeconds: 60,
  /** "따라잡는 중…" 최소 표시 시간(초). 짧은 따라잡기도 깜빡이지 않게 */
  minBannerSeconds: 0.5,
} as const;

export interface CatchUpOptions {
  maxSeconds: number;
  frameSeconds: number;
  minBannerSeconds: number;
}

export class CatchUp {
  private hiddenAt: number | null = null;
  /** 탭이 숨겨진 상태. 일시정지로 시각을 안 쌓아도 true (루프가 도는 환경 방어) */
  private hidden = false;
  private pending = 0;
  /** 복귀 직후 첫 프레임: Phaser가 넘기는 delta는 버린다 */
  private dropNextDelta = false;
  /** 안내 표시가 더 남은 시간(초) */
  private bannerLeft = 0;

  constructor(private readonly options: CatchUpOptions = CATCH_UP) {}

  /** 탭이 숨겨진 중인가. 이 동안 전투는 진행하지 않고 복귀 시 따라잡기로만 반영한다 */
  get isHidden(): boolean {
    return this.hidden;
  }

  /** 아직 따라잡을 시간이 남았는가 (이 동안 입력 무시) */
  get active(): boolean {
    return this.pending > 0;
  }

  /** "따라잡는 중…" 표시 여부. 입력 무시와 달리 최소 표시 시간만큼 더 남는다 */
  get bannerVisible(): boolean {
    return this.pending > 0 || this.bannerLeft > 0;
  }

  /** 남은 따라잡기 시간(초) */
  get remaining(): number {
    return this.pending;
  }

  /** 탭이 숨겨졌다. 이미 일시정지 중이면 시간을 기록하지 않는다 */
  hide(nowMs: number, paused: boolean): void {
    if (this.hidden) return;
    this.hidden = true;
    this.hiddenAt = paused ? null : nowMs;
    this.dropNextDelta = false;
  }

  /** 탭이 다시 보인다. 숨겨진 동안의 실제 경과 시간을 따라잡을 몫으로 쌓는다 */
  show(nowMs: number, paused: boolean): void {
    const from = this.hiddenAt;
    this.hiddenAt = null;
    this.hidden = false;
    if (from === null) return;
    this.dropNextDelta = true;
    if (paused) return;
    const seconds = Math.max(0, (nowMs - from) / 1000);
    this.pending = Math.min(this.options.maxSeconds, this.pending + seconds);
  }

  /** 남은 따라잡기를 버린다 (승패가 났을 때) */
  cancel(): void {
    this.pending = 0;
    this.bannerLeft = 0;
  }

  /**
   * 이번 프레임에 전투를 진행할 시간(초).
   * 따라잡는 중이면 상한만큼 나눠서, 아니면 Phaser delta 그대로(복귀 첫 프레임은 0).
   * 일시정지 중에는 0이고 남은 몫은 유지한다.
   */
  frame(deltaSeconds: number, paused: boolean): number {
    const realDelta = deltaSeconds;
    if (this.pending <= 0) this.bannerLeft = Math.max(0, this.bannerLeft - realDelta);
    if (this.dropNextDelta) {
      this.dropNextDelta = false;
      deltaSeconds = 0;
    }
    if (paused || this.hidden) return 0;
    if (this.pending > 0) {
      this.bannerLeft = this.options.minBannerSeconds;
      const chunk = Math.min(this.pending, this.options.frameSeconds);
      this.pending -= chunk;
      if (this.pending < 1e-9) this.pending = 0;
      return chunk;
    }
    return deltaSeconds;
  }
}

/**
 * 창 포커스·탭 숨김 이벤트 처리. 일시정지 플래그는 건드리지 않고 (읽기만),
 * 포커스를 잃어도 진행하며 탭 숨김은 복귀 시 따라잡는다. 이벤트 순서와 무관하다.
 */
export class VisibilityPolicy {
  constructor(private readonly catchUp: CatchUp) {}

  /** 포커스 상실: 눌린 입력만 풀면 된다 (true = 입력 해제) */
  onBlur(): boolean {
    return true;
  }

  /** 포커스 복귀: 할 일 없음 */
  onFocus(): void {}

  /** 탭 숨김: 입력을 풀고 시각을 기록한다 (true = 입력 해제) */
  onHidden(nowMs: number, paused: boolean): boolean {
    this.catchUp.hide(nowMs, paused);
    return true;
  }

  /** 탭 복귀: 숨겨졌던 시간을 따라잡는다 */
  onVisible(nowMs: number, paused: boolean): void {
    this.catchUp.show(nowMs, paused);
  }
}
