import { describe, expect, it } from 'vitest';
import { isPortrait, OrientationWatcher } from './orientation';

describe('화면 방향', () => {
  it('높이가 너비보다 크면 세로', () => {
    expect(isPortrait(360, 640)).toBe(true);
    expect(isPortrait(640, 360)).toBe(false);
    expect(isPortrait(500, 500)).toBe(false);
  });

  it('방향이 바뀔 때만 알리고, 해제하면 더 알리지 않는다', () => {
    const size = { width: 640, height: 360 };
    const watcher = new OrientationWatcher(() => size);
    const seen: boolean[] = [];
    const off = watcher.subscribe((p) => seen.push(p));
    expect(watcher.isPortrait).toBe(false);

    watcher.refresh(); // 그대로
    size.width = 360;
    size.height = 640;
    watcher.refresh();
    watcher.refresh(); // 같은 방향 반복
    expect(seen).toEqual([true]);
    expect(watcher.isPortrait).toBe(true);

    size.width = 640;
    size.height = 360;
    watcher.refresh();
    expect(seen).toEqual([true, false]);

    off();
    size.width = 360;
    size.height = 640;
    watcher.refresh();
    expect(seen).toEqual([true, false]);
  });
});
