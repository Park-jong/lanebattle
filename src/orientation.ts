/** 세로 화면인지 (높이가 너비보다 크면 세로) */
export function isPortrait(width: number, height: number): boolean {
  return height > width;
}

/** 화면 방향이 바뀌는지 지켜보는 객체. 창 크기를 읽는 함수를 주입받는다 */
export class OrientationWatcher {
  private portrait: boolean;
  private readonly listeners = new Set<(portrait: boolean) => void>();

  constructor(private readonly readSize: () => { width: number; height: number }) {
    const { width, height } = readSize();
    this.portrait = isPortrait(width, height);
  }

  get isPortrait(): boolean {
    return this.portrait;
  }

  /** 크기가 바뀌었을 때 호출한다. 방향이 달라졌을 때만 알린다 */
  refresh(): void {
    const { width, height } = this.readSize();
    const next = isPortrait(width, height);
    if (next === this.portrait) return;
    this.portrait = next;
    for (const fn of [...this.listeners]) fn(next);
  }

  /** 방향이 바뀔 때 부를 함수를 등록하고, 해제 함수를 돌려준다 */
  subscribe(fn: (portrait: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** Phaser 레지스트리에서 OrientationWatcher를 찾는 키 */
export const ORIENTATION_KEY = 'orientation';
