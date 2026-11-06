import { describe, expect, it, vi } from 'vitest';
import { FullscreenController, PressTracker, shouldAutoEnter, type FullscreenDocument } from './fullscreen';

/** 가짜 document: 요청하면 상태가 켜지고, 이벤트를 모아 둔다 */
function fakeDoc(over: Partial<FullscreenDocument> = {}) {
  const listeners = new Map<string, Set<() => void>>();
  const doc: FullscreenDocument & { fire(type: string): void } = {
    fullscreenEnabled: true,
    documentElement: { requestFullscreen: vi.fn(async () => { doc.fullscreenElement = doc.documentElement; }) },
    exitFullscreen: vi.fn(async () => { doc.fullscreenElement = null; }),
    addEventListener: (t, fn) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(fn);
    },
    removeEventListener: (t, fn) => { listeners.get(t)?.delete(fn); },
    fire: (t) => listeners.get(t)?.forEach((fn) => fn()),
    ...over,
  };
  return doc;
}

describe('FullscreenController 지원 판정', () => {
  it('표준 API', () => expect(new FullscreenController(fakeDoc()).isSupported).toBe(true));

  it('webkit 접두사만 있어도 지원', () => {
    const doc = fakeDoc({
      fullscreenEnabled: undefined, webkitFullscreenEnabled: true,
      documentElement: { webkitRequestFullscreen: vi.fn() },
    });
    expect(new FullscreenController(doc).isSupported).toBe(true);
  });

  it('미지원: 플래그가 없거나 false', () => {
    expect(new FullscreenController(fakeDoc({ fullscreenEnabled: false })).isSupported).toBe(false);
    expect(new FullscreenController(fakeDoc({ fullscreenEnabled: undefined })).isSupported).toBe(false);
  });

  it('미지원: 요청 함수가 없음', () => {
    expect(new FullscreenController(fakeDoc({ documentElement: {} })).isSupported).toBe(false);
  });
});

describe('FullscreenController 동작', () => {
  it('상태: 표준·webkit 요소 모두 인식', () => {
    expect(new FullscreenController(fakeDoc()).isActive).toBe(false);
    expect(new FullscreenController(fakeDoc({ fullscreenElement: {} })).isActive).toBe(true);
    expect(new FullscreenController(fakeDoc({ webkitFullscreenElement: {} })).isActive).toBe(true);
  });

  it('enter -> toggle(해제) -> toggle(진입)', async () => {
    const doc = fakeDoc();
    const fs = new FullscreenController(doc);
    await fs.enter();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(fs.isActive).toBe(true);
    await fs.toggle();
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(fs.isActive).toBe(false);
    await fs.toggle();
    expect(fs.isActive).toBe(true);
  });

  it('이미 전체화면이면 enter는 다시 요청하지 않고, 아니면 exit는 아무것도 안 한다', async () => {
    const doc = fakeDoc();
    const fs = new FullscreenController(doc);
    await fs.exit();
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
    await fs.enter();
    await fs.enter();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('webkit 접두사 요청·해제를 쓴다', async () => {
    const doc = fakeDoc({
      fullscreenEnabled: undefined, webkitFullscreenEnabled: true,
      documentElement: { webkitRequestFullscreen: vi.fn(() => { doc.webkitFullscreenElement = {}; }) },
      exitFullscreen: undefined,
      webkitExitFullscreen: vi.fn(() => { doc.webkitFullscreenElement = null; }),
    });
    const fs = new FullscreenController(doc);
    await fs.enter();
    expect(fs.isActive).toBe(true);
    await fs.exit();
    expect(doc.webkitExitFullscreen).toHaveBeenCalledTimes(1);
    expect(fs.isActive).toBe(false);
  });

  it('미지원이면 enter가 아무것도 하지 않는다', async () => {
    const request = vi.fn();
    const lock = vi.fn();
    const doc = fakeDoc({ fullscreenEnabled: false, documentElement: { requestFullscreen: request } });
    await new FullscreenController(doc, { orientation: { lock } }).enter();
    expect(request).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });

  it('요청이 거부(reject)되거나 던져도 예외가 새지 않고 잠금도 시도하지 않는다', async () => {
    const lock = vi.fn();
    const rejecting = vi.fn(async () => { throw new Error('denied'); });
    const throwing = vi.fn(() => { throw new Error('sync'); });
    for (const request of [rejecting, throwing]) {
      const fs = new FullscreenController(fakeDoc({ documentElement: { requestFullscreen: request } }), { orientation: { lock } });
      await expect(fs.enter()).resolves.toBeUndefined();
    }
    expect(lock).not.toHaveBeenCalled();
  });

  it('exit가 거부되어도 예외가 새지 않는다', async () => {
    const doc = fakeDoc({ fullscreenElement: {}, exitFullscreen: vi.fn(async () => { throw new Error('x'); }) });
    await expect(new FullscreenController(doc).exit()).resolves.toBeUndefined();
  });

  it('진입에 성공하면 가로 잠금을 시도한다', async () => {
    const lock = vi.fn(async () => {});
    await new FullscreenController(fakeDoc(), { orientation: { lock } }).enter();
    expect(lock).toHaveBeenCalledWith('landscape');
  });

  it('가로 잠금이 실패하거나 없어도 무시한다', async () => {
    const failing = new FullscreenController(fakeDoc(), { orientation: { lock: async () => { throw new Error('nope'); } } });
    await expect(failing.enter()).resolves.toBeUndefined();
    await expect(new FullscreenController(fakeDoc(), {}).enter()).resolves.toBeUndefined();
    await expect(new FullscreenController(fakeDoc(), { orientation: {} }).enter()).resolves.toBeUndefined();
  });
});

describe('FullscreenController 변경 구독', () => {
  it('표준·webkit 이벤트로 알리고 해제하면 멈춘다', async () => {
    const doc = fakeDoc();
    const fs = new FullscreenController(doc);
    const seen: boolean[] = [];
    const off = fs.subscribe((a) => seen.push(a));
    await fs.enter();
    doc.fire('fullscreenchange');
    await fs.exit();
    doc.fire('webkitfullscreenchange');
    expect(seen).toEqual([true, false]);
    off();
    doc.fire('fullscreenchange');
    doc.fire('webkitfullscreenchange');
    expect(seen).toHaveLength(2);
  });
});

describe('shouldAutoEnter', () => {
  it('touch일 때만 true', () => {
    expect(shouldAutoEnter('touch')).toBe(true);
    expect(shouldAutoEnter('mouse')).toBe(false);
    expect(shouldAutoEnter('pen')).toBe(false);
    expect(shouldAutoEnter(undefined)).toBe(false);
  });
});

describe('PressTracker', () => {
  it('down 없이 up이 오면 false', () => {
    expect(new PressTracker().consumeUp(1)).toBe(false);
  });

  it('down(1) 뒤 up(1)은 true이고 한 번만 소비된다', () => {
    const t = new PressTracker();
    t.down(1);
    expect(t.consumeUp(1)).toBe(true);
    expect(t.consumeUp(1)).toBe(false);
  });

  it('down(1) 뒤 up(2)는 false이고 기억도 비운다', () => {
    const t = new PressTracker();
    t.down(1);
    expect(t.consumeUp(2)).toBe(false);
    expect(t.consumeUp(1)).toBe(false);
  });

  it('cancel() 뒤 up은 false', () => {
    const t = new PressTracker();
    t.down(1);
    t.cancel();
    expect(t.consumeUp(1)).toBe(false);
  });
});
