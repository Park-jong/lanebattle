// 화면 배치 상수 (도형 그래픽 단계용)
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const HUD_FONT = '"Malgun Gothic", system-ui, sans-serif';

/** 사각형 (왼쪽 위 기준) */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 터치 버튼 최소 크기(게임 좌표). 휴대폰 가로 화면(약 640x360)에서 약 44px이 된다 */
export const MIN_TOUCH = 66;

// ----- 전투 화면 (docs/design.md 7번 배치도) -----

const PANEL_Y = 390;
const ROW_H = MIN_TOUCH;
const ROW_GAP = 6;
const ROW1_Y = PANEL_Y + 6;
const ROW2_Y = ROW1_Y + ROW_H + ROW_GAP;
const SUMMON_W = 70;
const SUMMON_GAP = 4;
const SUMMON_X = 200;

/** 땅 윗면 y. 아래 패널 바로 위에 놓는다 */
export const GROUND_Y = PANEL_Y - 10;

/** 소환 버튼 10개: 2줄 x 5칸 (1~5 / 6~0) */
const summonRects: Rect[] = Array.from({ length: 10 }, (_, i) => ({
  x: SUMMON_X + (i % 5) * (SUMMON_W + SUMMON_GAP),
  y: i < 5 ? ROW1_Y : ROW2_Y,
  w: SUMMON_W,
  h: ROW_H,
}));

/** 스킬 Q/W/E: 아래 패널 오른쪽 위아래 가운데 */
const skillRects: Rect[] = Array.from({ length: 3 }, (_, i) => ({
  x: 738 + i * 74,
  y: 432,
  w: MIN_TOUCH,
  h: MIN_TOUCH,
}));

export const BATTLE_LAYOUT = {
  /** 아래 패널 (전장과 구분되는 배경) */
  panel: { x: 0, y: PANEL_Y, w: GAME_WIDTH, h: GAME_HEIGHT - PANEL_Y } as Rect,
  /** 위쪽 띠 배경 */
  topStrip: { x: 0, y: 0, w: GAME_WIDTH, h: 72 } as Rect,
  // 눌러서 쓰는 버튼
  moveLeft: { x: 12, y: 432, w: 84, h: MIN_TOUCH } as Rect,
  moveRight: { x: 104, y: 432, w: 84, h: MIN_TOUCH } as Rect,
  summon: summonRects,
  gather: { x: 580, y: ROW1_Y, w: 150, h: ROW_H * 2 + ROW_GAP } as Rect,
  skills: skillRects,
  pause: { x: GAME_WIDTH - 8 - MIN_TOUCH, y: 4, w: MIN_TOUCH, h: MIN_TOUCH } as Rect,
  // 보이기만 하는 표시
  talismanBar: { x: 8, y: 6, w: 230, h: 16 } as Rect,
  spiritBar: { x: 8, y: 28, w: 230, h: 16 } as Rect,
  minimap: { x: 300, y: 4, w: 360, h: 26 } as Rect,
  shrineBar: { x: 300, y: 34, w: 176, h: 16 } as Rect,
  castleBar: { x: 484, y: 34, w: 176, h: 16 } as Rect,
  /** 오른쪽 작은 글자 3줄: 스테이지, 웨이브·시간·위협, 적·아군 수 */
  infoText: { x: 676, y: 4, w: 200, h: 48 } as Rect,
  /** 왼쪽 아래 작은 글자 한 줄: 영웅 부활, 연계 목록 */
  noteText: { x: 8, y: 54, w: 640, h: 16 } as Rect,
  /** 보스 이름·체력바·칩 (위쪽 띠 바로 아래) */
  bossName: { x: 280, y: 74, w: 400, h: 20 } as Rect,
  bossBar: { x: 280, y: 96, w: 400, h: 14 } as Rect,
  bossChips: { x: 180, y: 114, w: 600, h: 24 } as Rect,
} as const;

/** 전투 중 눌러서 쓰는 버튼 이름과 사각형 */
export function battleButtons(): { name: string; rect: Rect }[] {
  const L = BATTLE_LAYOUT;
  return [
    { name: 'moveLeft', rect: L.moveLeft },
    { name: 'moveRight', rect: L.moveRight },
    ...L.summon.map((rect, i) => ({ name: `summon${i}`, rect })),
    { name: 'gather', rect: L.gather },
    ...L.skills.map((rect, i) => ({ name: `skill${i}`, rect })),
    { name: 'pause', rect: L.pause },
  ];
}

/** 버튼이 아닌 표시 영역 (버튼과 겹치면 안 된다) */
export function battleDisplays(): { name: string; rect: Rect }[] {
  const L = BATTLE_LAYOUT;
  return [
    { name: 'talismanBar', rect: L.talismanBar },
    { name: 'spiritBar', rect: L.spiritBar },
    { name: 'minimap', rect: L.minimap },
    { name: 'shrineBar', rect: L.shrineBar },
    { name: 'castleBar', rect: L.castleBar },
    { name: 'infoText', rect: L.infoText },
    { name: 'noteText', rect: L.noteText },
    { name: 'bossName', rect: L.bossName },
    { name: 'bossBar', rect: L.bossBar },
    { name: 'bossChips', rect: L.bossChips },
  ];
}

/** 일시정지·결과 화면의 버튼 줄 (가운데 정렬) */
export function centeredRow(count: number, w: number, gap: number, y: number): Rect[] {
  const total = count * w + (count - 1) * gap;
  const x0 = (GAME_WIDTH - total) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * (w + gap), y, w, h: MIN_TOUCH }));
}

/** 일시정지 화면 */
export const PAUSE_BUTTON = { w: 170, gap: 16, y: 300 } as const;
/** 결과 화면: 패널과 버튼 줄 */
export const RESULT_LAYOUT = {
  panel: { x: 230, y: 40, w: 500, h: 400 } as Rect,
  button: { w: 150, gap: 12, y: 340 },
} as const;

/** 미니맵에서 전장 x 좌표(0~전장 길이)를 미니맵 안 x 픽셀로 바꾼다 */
export function minimapX(worldX: number, worldLength: number, map: Rect): number {
  const ratio = Math.max(0, Math.min(1, worldX / worldLength));
  return map.x + ratio * map.w;
}

/** 데미지 숫자: 동시에 보일 수 있는 최대 개수와 움직임 */
export const FLOATER = { max: 60, seconds: 0.8, rise: 36 } as const;

// ----- 지도 화면 -----

export const MAP_LAYOUT = {
  gridX: 104,
  gridY: 84,
  cellW: 88,
  cellH: MIN_TOUCH,
  gap: 8,
  infoX: 616,
  infoY: 74,
  infoW: 320,
  infoH: 396,
} as const;
