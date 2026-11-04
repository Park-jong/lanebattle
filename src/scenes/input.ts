// 키 매핑은 모두 KeyboardEvent.code 기준으로 이 파일에 모은다
export const KEY_MAP = {
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  /** 소환 슬롯 0~9 */
  summon: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
  /** 전투 중 기운 모으기, 결과 화면에서는 재시작 */
  gatherOrRestart: 'KeyR',
  pause: ['Escape', 'KeyP'],
} as const satisfies Record<string, string | readonly string[]>;

/** 소환 키 → 슬롯 번호 (해당 없으면 -1) */
export function summonIndexOf(code: string): number {
  return KEY_MAP.summon.indexOf(code as (typeof KEY_MAP.summon)[number]);
}

const PREVENT_DEFAULT = new Set<string>([...KEY_MAP.moveLeft, ...KEY_MAP.moveRight]);

/** keydown/keyup으로 눌림 상태를 추적하고, 창이 blur되면 모두 해제한다 */
export class KeyInput {
  private readonly down = new Set<string>();

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.down.add(e.code);
    if (!e.repeat) this.onPress(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };
  private readonly onBlur = (): void => this.releaseAll();

  constructor(
    private readonly target: Window,
    private readonly onPress: (code: string) => void,
  ) {}

  attach(): void {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.releaseAll();
  }

  releaseAll(): void {
    this.down.clear();
  }

  /** -1 왼쪽, 0 정지, 1 오른쪽 */
  moveDir(): number {
    const left = KEY_MAP.moveLeft.some((c) => this.down.has(c));
    const right = KEY_MAP.moveRight.some((c) => this.down.has(c));
    return (right ? 1 : 0) - (left ? 1 : 0);
  }
}
