import { DEFAULT_UI } from '../ui/default/tokens';

// 화면 배치 상수 (도형 그래픽 단계용)
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const HUD_FONT = DEFAULT_UI.font;

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
const SUMMON_W = 80;
const SUMMON_GAP = 6;
const SUMMON_X = 174;

/** 전장 바닥의 위·아래 경계. 캐릭터는 이 사이에 서고 앞쪽 지면도 보인다. */
export const BATTLEFIELD = {
  backY: 188,
  frontY: PANEL_Y - 16,
  centerY: PANEL_Y - 90,
  groundScaleY: 0.28,
  unitScale: 1.3,
  heroScale: 1.65,
  bossScale: 1.1,
  rows: [-38, -8, 30, -22, 14] as readonly number[],
} as const;

/** 레인 중앙의 발 위치. 지형의 경계와 분리한다. */
export const GROUND_Y = BATTLEFIELD.centerY;

/** 소환 버튼 10개: 2줄 x 5칸 (1~5 / 6~0) */
const summonRects: Rect[] = Array.from({ length: 10 }, (_, i) => ({
  x: SUMMON_X + (i % 5) * (SUMMON_W + SUMMON_GAP),
  y: i < 5 ? ROW1_Y : ROW2_Y,
  w: SUMMON_W,
  h: ROW_H,
}));

/** 스킬 Q/W/E: 아래 패널 오른쪽 위아래 가운데 */
const skillRects: Rect[] = Array.from({ length: 3 }, (_, i) => ({
  x: 724 + i * 76,
  y: ROW1_Y,
  w: 72,
  h: ROW_H * 2 + ROW_GAP,
}));

export const BATTLE_LAYOUT = {
  /** 아래 패널 (전장과 구분되는 배경) */
  panel: { x: 0, y: PANEL_Y, w: GAME_WIDTH, h: GAME_HEIGHT - PANEL_Y } as Rect,
  /** 상단 표시의 배치 영역. 전체 폭 배경은 그리지 않는다. */
  topStrip: { x: 0, y: 0, w: GAME_WIDTH, h: 72 } as Rect,
  /** 소환패·스킬 패널과 이어지는 자원 돌출부 */
  summonFlange: { x: 169, y: 350, w: 434, h: 42 } as Rect,
  skillFlange: { x: 719, y: 350, w: 234, h: 42 } as Rect,
  // 눌러서 쓰는 버튼
  moveLeft: { x: 12, y: ROW1_Y, w: 70, h: MIN_TOUCH } as Rect,
  moveRight: { x: 88, y: ROW1_Y, w: 70, h: MIN_TOUCH } as Rect,
  inspect: { x: 12, y: ROW2_Y, w: 146, h: MIN_TOUCH } as Rect,
  summon: summonRects,
  gather: { x: 610, y: ROW1_Y, w: 100, h: ROW_H * 2 + ROW_GAP } as Rect,
  skills: skillRects,
  pause: { x: 8, y: 4, w: MIN_TOUCH, h: MIN_TOUCH } as Rect,
  // 보이기만 하는 표시
  talismanBar: { x: 174, y: 354, w: 424, h: 36 } as Rect,
  spiritBar: { x: 724, y: 354, w: 224, h: 36 } as Rect,
  /** 양쪽 기지 체력과 전선 거리·현재 시야를 하나의 띠에 겹쳐 표시한다. */
  frontline: { x: 232, y: 8, w: 496, h: 48 } as Rect,
  /** 오른쪽 위 작은 관문 표지 */
  infoText: { x: 746, y: 10, w: 204, h: 30 } as Rect,
} as const;

/** 전투 중 눌러서 쓰는 버튼 이름과 사각형 */
export function battleButtons(): { name: string; rect: Rect }[] {
  const L = BATTLE_LAYOUT;
  return [
    { name: 'moveLeft', rect: L.moveLeft },
    { name: 'moveRight', rect: L.moveRight },
    { name: 'inspect', rect: L.inspect },
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
    { name: 'frontline', rect: L.frontline },
    { name: 'infoText', rect: L.infoText },
  ];
}

/** 체력·거리가 공유하는 띠. 수치와 양 끝 문장의 여백을 남긴다. */
export function frontlineTrack(frame: Rect = BATTLE_LAYOUT.frontline): Rect {
  return { x: frame.x + 40, y: frame.y + 20, w: frame.w - 80, h: 18 };
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
  chapters: Array.from({ length: 5 }, (_, i) => ({ x: 24 + i * 184, y: 76, w: 174, h: MIN_TOUCH })) as Rect[],
  route: { x: 24, y: 158, w: 568, h: 304 } as Rect,
  nodes: Array.from({ length: 5 }, (_, i) => ({ x: 48 + i * 104, y: 250 + (i % 2 === 0 ? 20 : 0), w: 88, h: 112 })) as Rect[],
  preview: { x: 612, y: 158, w: 324, h: 366 } as Rect,
} as const;

// ----- 빌드 화면 -----

export { BUILD_LAYOUT, dialogButtons, nodeCells, tierLabelRect, tierRowY } from '../ui/build/layout';

// ----- 툴팁 (마우스를 올렸을 때 뜨는 설명 상자) -----
export const TOOLTIP_LAYOUT = {
  width: 340,
  padding: 14,
  /** 버튼과 상자 사이 간격 */
  gap: 6,
  /** 화면 가장자리 여백 */
  margin: 8,
  titleSize: 18,
  bodySize: 14,
  /** HUD(90~100)·일시정지·결과 덮개(180~195)·팝업 버튼(210) 위 */
  depth: 220,
} as const;
