// 주입 가능한 난수 생성기
export interface Rng {
  /** 0 이상 1 미만 */
  next(): number;
}

/** 시드 고정 RNG (mulberry32) */
export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export class MathRng implements Rng {
  next(): number {
    return Math.random();
  }
}
