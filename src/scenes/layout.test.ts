import { describe, expect, it } from 'vitest';
import {
  battleButtons, battleDisplays, BATTLE_LAYOUT, centeredRow, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, MAP_LAYOUT,
  MIN_TOUCH, minimapX, frontlineTrack, PAUSE_BUTTON, RESULT_LAYOUT, type Rect,
  FULLSCREEN_LAYOUT, PAUSE_FULLSCREEN, PAUSE_PANEL, SETTINGS_PANEL, TITLE_SETTINGS,
} from './layout';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, outer: Rect) =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
const screen: Rect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };

/** 서로 겹치는 이름 쌍 */
function overlapPairs(items: { name: string; rect: Rect }[]): string[] {
  const out: string[] = [];
  items.forEach((a, i) => {
    for (const b of items.slice(i + 1)) if (overlaps(a.rect, b.rect)) out.push(`${a.name}/${b.name}`);
  });
  return out;
}

describe('전투 HUD 배치', () => {
  const buttons = battleButtons();

  it('버튼은 소환 10 + 스킬 3 + 이동 2 + 기운 모으기 + 일시정지 + 설명', () => {
    expect(buttons).toHaveLength(18);
    expect(BATTLE_LAYOUT.summon).toHaveLength(10);
    expect(BATTLE_LAYOUT.skills).toHaveLength(3);
  });

  it('모든 버튼이 66x66 이상', () => {
    for (const { name, rect } of buttons) {
      expect(rect.w, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(rect.h, name).toBeGreaterThanOrEqual(MIN_TOUCH);
    }
  });

  it('모든 버튼과 표시가 화면 안에 있다', () => {
    for (const { name, rect } of [...buttons, ...battleDisplays()]) expect(inside(rect, screen), name).toBe(true);
  });

  it('버튼끼리 겹치지 않는다', () => {
    expect(overlapPairs(buttons)).toEqual([]);
  });

  it('표시끼리, 버튼과 표시도 겹치지 않는다', () => {
    const displays = battleDisplays();
    expect(overlapPairs(displays)).toEqual([]);
    for (const b of buttons) for (const d of displays) expect(overlaps(b.rect, d.rect), `${b.name}/${d.name}`).toBe(false);
  });

  it('소환 버튼은 2줄 x 5칸, 아래 패널 안에 있다', () => {
    const rows = new Set(BATTLE_LAYOUT.summon.map((r) => r.y));
    expect(rows.size).toBe(2);
    expect(BATTLE_LAYOUT.summon.filter((r) => r.y === [...rows][0])).toHaveLength(5);
    for (const { name, rect } of buttons.filter((b) => b.name !== 'pause')) expect(inside(rect, BATTLE_LAYOUT.panel), name).toBe(true);
  });

  it('상단에는 중앙 통합 띠와 작은 관문 표시·일시정지만 둔다', () => {
    const strip = BATTLE_LAYOUT.topStrip;
    for (const r of [BATTLE_LAYOUT.frontline, BATTLE_LAYOUT.infoText, BATTLE_LAYOUT.pause]) {
      expect(inside(r, strip)).toBe(true);
    }
    expect(overlaps(strip, BATTLE_LAYOUT.panel)).toBe(false);
    expect(GROUND_Y).toBeLessThanOrEqual(BATTLE_LAYOUT.panel.y);
  });

  it('부적·신력은 각각 소환패·스킬의 돌출부 안에서 버튼 바로 위에 정렬된다', () => {
    const L = BATTLE_LAYOUT;
    for (const [meter, flange] of [[L.talismanBar, L.summonFlange], [L.spiritBar, L.skillFlange]]) {
      expect(inside(meter, flange)).toBe(true);
      expect(inside(flange, screen)).toBe(true);
      expect(flange.y).toBeLessThan(L.panel.y);
      expect(flange.y + flange.h).toBeGreaterThanOrEqual(L.panel.y);
      for (const { rect } of buttons) expect(overlaps(meter, rect)).toBe(false);
    }
    expect(L.talismanBar.x).toBe(L.summon[0].x);
    expect(L.talismanBar.x + L.talismanBar.w).toBe(L.summon[4].x + L.summon[4].w);
    expect(L.spiritBar.x).toBe(L.skills[0].x);
    expect(L.spiritBar.x + L.spiritBar.w).toBe(L.skills[2].x + L.skills[2].w);
    expect(inside(frontlineTrack(), L.frontline)).toBe(true);
    expect(L.frontline.x + L.frontline.w / 2).toBe(GAME_WIDTH / 2);
  });
});

describe('일시정지·결과 화면 버튼', () => {
  it('일시정지: 66x66 이상, 화면 안, 겹치지 않음', () => {
    const row = centeredRow(2, PAUSE_BUTTON.w, PAUSE_BUTTON.gap, PAUSE_BUTTON.y);
    row.forEach((r) => {
      expect(r.w).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(r, screen)).toBe(true);
    });
    expect(overlaps(row[0], row[1])).toBe(false);
  });

  it('결과: 버튼 2~3개가 패널 안에 들어가고 66x66 이상, 겹치지 않음', () => {
    const { w, gap, y } = RESULT_LAYOUT.button;
    for (const count of [2, 3]) {
      const row = centeredRow(count, w, gap, y);
      row.forEach((r, i) => {
        expect(r.w).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(r.h).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(inside(r, RESULT_LAYOUT.panel)).toBe(true);
        if (i > 0) expect(overlaps(row[i - 1], r)).toBe(false);
      });
    }
  });
});

describe('장과 관문 선택', () => {
  it('장 탭과 다섯 관문의 터치 영역은 화면 안에 있고 서로 겹치지 않는다', () => {
    const M = MAP_LAYOUT;
    expect(M.chapters).toHaveLength(5);
    expect(M.nodes).toHaveLength(5);
    const buttons = [...M.chapters, ...M.nodes].map((rect, i) => ({ name: String(i), rect }));
    for (const { rect } of buttons) {
      expect(rect.w).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(rect.h).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(rect, screen)).toBe(true);
      expect(overlaps(rect, M.preview)).toBe(false);
    }
    expect(overlapPairs(buttons)).toEqual([]);
    for (const rect of M.nodes) expect(inside(rect, M.route)).toBe(true);
    expect(inside(M.route, screen)).toBe(true);
    expect(inside(M.preview, screen)).toBe(true);
    expect(overlaps(M.route, M.preview)).toBe(false);
  });
});

describe('미니맵 좌표', () => {
  const map = frontlineTrack();
  it('전장 양 끝이 미니맵 양 끝이고 범위 밖은 잘린다', () => {
    expect(minimapX(0, 2400, map)).toBe(map.x);
    expect(minimapX(2400, 2400, map)).toBe(map.x + map.w);
    expect(minimapX(1200, 2400, map)).toBe(map.x + map.w / 2);
    expect(minimapX(-50, 2400, map)).toBe(map.x);
    expect(minimapX(9999, 2400, map)).toBe(map.x + map.w);
  });
});

describe('전체화면 버튼 배치', () => {
  const F = FULLSCREEN_LAYOUT;
  const settingsPanel: Rect = {
    x: (GAME_WIDTH - SETTINGS_PANEL.w) / 2, y: (GAME_HEIGHT - SETTINGS_PANEL.h) / 2, w: SETTINGS_PANEL.w, h: SETTINGS_PANEL.h,
  };

  it('모든 버튼이 66x66 이상이고 화면 안에 있다', () => {
    for (const [name, r] of Object.entries(F)) {
      expect(r.w, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(r.h, name).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(inside(r, screen), name).toBe(true);
    }
  });

  it('타이틀: 설정 버튼과 겹치지 않는다', () => {
    expect(overlaps(F.title, TITLE_SETTINGS)).toBe(false);
  });

  it('지도: 별 합계 글자·챕터 버튼·위쪽 띠와 겹치지 않는다', () => {
    expect(overlaps(F.map, MAP_LAYOUT.starText)).toBe(false);
    for (const c of MAP_LAYOUT.chapters) expect(overlaps(F.map, c)).toBe(false);
    expect(F.map.y + F.map.h).toBeLessThanOrEqual(70);
  });

  it('설정: 패널 밖 구석에 있고 뒤쪽 타이틀 설정 버튼·아이콘과 겹치지 않는다', () => {
    expect(overlaps(F.settings, settingsPanel)).toBe(false);
    expect(overlaps(F.settings, TITLE_SETTINGS)).toBe(false);
    expect(overlaps(F.settings, F.title)).toBe(false);
  });

  it('일시정지: 패널 안에서 계속·지도 버튼과 겹치지 않는다', () => {
    const row = centeredRow(2, PAUSE_BUTTON.w, PAUSE_BUTTON.gap, PAUSE_BUTTON.y);
    expect(inside(PAUSE_FULLSCREEN, PAUSE_PANEL)).toBe(true);
    for (const r of row) {
      expect(inside(r, PAUSE_PANEL)).toBe(true);
      expect(overlaps(PAUSE_FULLSCREEN, r)).toBe(false);
    }
    expect(F.pause).toBe(PAUSE_FULLSCREEN);
  });
});
