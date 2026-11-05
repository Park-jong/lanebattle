import { describe, expect, it } from 'vitest';
import { CATCH_UP, CatchUp, VisibilityPolicy } from './catchUp';

/** 따라잡기가 끝날 때까지 프레임을 돌려 프레임별 처리량을 모은다 */
function drain(c: CatchUp, limit = 100000): number[] {
  const out: number[] = [];
  while (c.active && out.length < limit) out.push(c.frame(0.016, false));
  return out;
}

describe('CatchUp', () => {
  it('숨김 10초 후 복귀하면 총 10초가 진행된다', () => {
    const c = new CatchUp();
    c.hide(1000, false);
    c.show(11000, false);
    const sum = drain(c).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(10, 6);
    expect(c.active).toBe(false);
  });

  it('일시정지 중 숨겼다 돌아오면 진행하지 않는다', () => {
    const c = new CatchUp();
    c.hide(0, true);
    c.show(600000, true);
    expect(c.active).toBe(false);
    expect(c.frame(0.016, true)).toBe(0);
  });

  it('숨겨진 동안 일시정지되면 시간을 쌓지 않는다', () => {
    const c = new CatchUp();
    c.hide(0, false);
    c.show(10000, true);
    expect(c.active).toBe(false);
  });

  it('긴 시간은 여러 프레임에 나뉘고 프레임당 상한을 지킨다', () => {
    const c = new CatchUp({ ...CATCH_UP, maxSeconds: 7200, frameSeconds: 60 });
    c.hide(0, false);
    c.show(1000 * 600, false);
    const frames = drain(c);
    expect(frames.length).toBe(10);
    expect(Math.max(...frames)).toBeLessThanOrEqual(60);
  });

  it('최대 시간을 넘기면 상한까지만 따라잡는다', () => {
    const c = new CatchUp();
    c.hide(0, false);
    c.show(1000 * 3600 * 5, false);
    const sum = drain(c).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(CATCH_UP.maxSeconds, 6);
  });

  it('따라잡는 도중 취소하면 남은 시간을 버린다', () => {
    const c = new CatchUp({ ...CATCH_UP, maxSeconds: 7200, frameSeconds: 60 });
    c.hide(0, false);
    c.show(1000 * 600, false);
    c.frame(0.016, false);
    c.cancel();
    expect(c.active).toBe(false);
    expect(c.remaining).toBe(0);
  });

  it('복귀 직후 Phaser delta와 이중으로 진행하지 않는다', () => {
    const c = new CatchUp();
    c.hide(0, false);
    c.show(10000, false);
    // 첫 프레임은 Phaser delta(5초)가 아니라 따라잡기 몫만 돌려준다
    expect(c.frame(5, false)).toBe(10);
    expect(c.frame(0.016, false)).toBeCloseTo(0.016, 9);
  });

  it('아주 짧게 숨겼어도 복귀 첫 프레임의 delta는 버린다', () => {
    const c = new CatchUp();
    c.hide(0, false);
    c.show(0, false);
    expect(c.frame(3, false)).toBe(0);
    expect(c.frame(0.02, false)).toBeCloseTo(0.02, 9);
  });

  it('숨김 없이는 delta를 그대로 돌려준다', () => {
    const c = new CatchUp();
    expect(c.frame(0.016, false)).toBeCloseTo(0.016, 9);
    expect(c.frame(0.016, true)).toBe(0);
  });

  it('따라잡는 중 일시정지되면 몫을 유지한 채 멈춘다', () => {
    const c = new CatchUp();
    c.hide(0, false);
    c.show(10000, false);
    expect(c.frame(0, true)).toBe(0);
    expect(c.remaining).toBe(10);
  });
});

describe("CatchUp 안내 표시", () => {
  it("짧은 따라잡기도 최소 표시 시간 동안 안내가 남지만 입력 무시는 바로 끝난다", () => {
    const c = new CatchUp();
    c.hide(0, false);
    c.show(5000, false);
    c.frame(0.016, false);
    expect(c.active).toBe(false);
    expect(c.bannerVisible).toBe(true);
    c.frame(0.3, false);
    expect(c.bannerVisible).toBe(true);
    c.frame(0.3, false);
    expect(c.bannerVisible).toBe(false);
  });

  it("따라잡는 중 다시 숨기면 남은 몫에 새 경과 시간이 더해진다", () => {
    const c = new CatchUp({ ...CATCH_UP, frameSeconds: 60 });
    c.hide(0, false);
    c.show(150000, false);
    let sum = c.frame(0.016, false); // 60
    c.hide(1000, false);
    c.show(31000, false); // 30초 더
    sum += drain(c).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(180, 6);
  });
});

describe("VisibilityPolicy 이벤트 순서", () => {
  type Ev = "blur" | "focus" | "hidden" | "visible";
  /** 이벤트를 (시각 ms) 순서대로 흘리고 총 진행 시간과 일시정지 플래그를 돌려준다 */
  function run(events: [Ev, number][], paused = false) {
    const c = new CatchUp();
    const p = new VisibilityPolicy(c);
    const flag = { paused };
    for (const [ev, t] of events) {
      if (ev === "blur") p.onBlur();
      else if (ev === "focus") p.onFocus();
      else if (ev === "hidden") p.onHidden(t, flag.paused);
      else p.onVisible(t, flag.paused);
    }
    const sum = c.frame(0.016, flag.paused) + drain(c).reduce((a, b) => a + b, 0);
    return { sum, paused: flag.paused };
  }
  const T = 10000;

  for (const delay of [0, 80, 500]) {
    it(`blur 후 ${delay}ms 뒤 hidden: 일시정지 없이 10초 따라잡는다`, () => {
      const r = run([["blur", 0], ["hidden", delay], ["visible", delay + T], ["focus", delay + T]]);
      expect(r.paused).toBe(false);
      expect(r.sum).toBeCloseTo(T / 1000, 6);
    });
  }

  it("hidden만", () => {
    const r = run([["hidden", 0], ["visible", T]]);
    expect(r).toEqual({ sum: expect.closeTo(10, 6), paused: false });
  });

  it("hidden 후 blur", () => {
    const r = run([["hidden", 0], ["blur", 5], ["visible", T], ["focus", T]]);
    expect(r.paused).toBe(false);
    expect(r.sum).toBeCloseTo(10, 6);
  });

  it("blur만, blur 후 focus는 시간을 쌓지 않는다", () => {
    expect(run([["blur", 0]]).sum).toBeCloseTo(0.016, 9);
    expect(run([["blur", 0], ["focus", 9000]]).sum).toBeCloseTo(0.016, 9);
  });

  it("사용자 일시정지 중 blur·hidden·복귀는 시간이 0", () => {
    const r = run([["blur", 0], ["hidden", 80], ["visible", 600000], ["focus", 600000]], true);
    expect(r.sum).toBe(0);
    expect(r.paused).toBe(true);
  });
});

describe('숨김 중 이중 진행 방어', () => {
  /** 숨김 구간 동안 매 프레임 가짜 delta가 계속 들어오는 환경을 흉내낸다 */
  it('숨김 중 프레임이 들어와도 진행 0, 복귀하면 숨긴 실제 시간만큼만 진행한다', () => {
    const c = new CatchUp();
    let sum = 0;
    c.hide(0, false);
    expect(c.isHidden).toBe(true);
    for (let i = 0; i < 125; i++) sum += c.frame(0.016, false); // 2초
    expect(sum).toBe(0);
    c.show(2000, false);
    expect(c.isHidden).toBe(false);
    for (let i = 0; i < 100 && c.active; i++) sum += c.frame(0.016, false);
    for (let i = 0; i < 62; i++) sum += c.frame(0.016, false); // 보이는 1초
    expect(sum).toBeCloseTo(2.992, 3);
  });

  it('일시정지 중 숨겨도 숨김 상태이며 진행 0이다', () => {
    const c = new CatchUp();
    c.hide(0, true);
    expect(c.isHidden).toBe(true);
    expect(c.frame(0.016, false)).toBe(0);
    c.show(5000, true);
    expect(c.isHidden).toBe(false);
    expect(c.active).toBe(false);
  });

  it('rAF가 멈춘 정상 경우: 숨김 중 프레임 없이 복귀하면 기존과 같다', () => {
    const c = new CatchUp();
    c.hide(0, false);
    c.show(10000, false);
    expect(c.frame(0.016, false)).toBe(10); // 첫 delta를 버리고 몫을 진행
    expect(c.frame(0.016, false)).toBe(0.016);
  });
});
