import { MAX_TIER, nodesOfTree, YOGOE_UNIT_IDS, yogoeNodeIds, type TreeId } from '../data/upgrades';

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

// ----- 빌드 화면 -----

const BUILD_TOP = 176;
const BUILD_ROW_STEP = MIN_TOUCH + 4;
const BUILD_SLOT_TAB_X = 490;
const BUILD_TREE_TAB_STEP = 134;

export const BUILD_LAYOUT = {
  /** 위쪽 띠 배경 */
  strip: { x: 0, y: 0, w: GAME_WIDTH, h: 72 } as Rect,
  back: { x: 8, y: 4, w: 96, h: MIN_TOUCH } as Rect,
  /** 신명·엽전 글자 */
  wallet: { x: 112, y: 6, w: 216, h: 60 } as Rect,
  buy: { x: 332, y: 4, w: 150, h: MIN_TOUCH } as Rect,
  slotTabs: Array.from({ length: 3 }, (_, i) => ({ x: BUILD_SLOT_TAB_X + i * 84, y: 4, w: 80, h: MIN_TOUCH })) as Rect[],
  copy: { x: 742, y: 4, w: 100, h: MIN_TOUCH } as Rect,
  reset: { x: 848, y: 4, w: 104, h: MIN_TOUCH } as Rect,
  /** 지도에서 고른 보스 스테이지의 보스 이름·약점·저항 */
  boss: { x: 8, y: 74, w: 944, h: 28 } as Rect,
  /** 트리 탭 4개 + 소환 순서 */
  treeTabs: Array.from({ length: 5 }, (_, i) => ({ x: 8 + i * BUILD_TREE_TAB_STEP, y: 104, w: 130, h: MIN_TOUCH })) as Rect[],
  nodeArea: { x: 8, y: BUILD_TOP, w: 684, h: 360 } as Rect,
  /** 노드 상세 패널과 안의 요소 */
  detail: { x: 700, y: 104, w: 252, h: 432 } as Rect,
  detailText: { x: 708, y: 110, w: 236, h: 284 } as Rect,
  allocate: { x: 704, y: 400, w: 120, h: MIN_TOUCH } as Rect,
  deallocate: { x: 828, y: 400, w: 120, h: MIN_TOUCH } as Rect,
  message: { x: 708, y: 472, w: 236, h: 60 } as Rect,
  /** 소환 순서 탭: 10칸(2줄 x 5칸), 기본 순서 버튼, 안내 글 */
  orderCells: Array.from({ length: 10 }, (_, i) => ({
    x: 8 + (i % 5) * 134, y: BUILD_TOP + Math.floor(i / 5) * BUILD_ROW_STEP, w: 128, h: MIN_TOUCH,
  })) as Rect[],
  orderReset: { x: 8, y: 330, w: 170, h: MIN_TOUCH } as Rect,
  orderHint: { x: 186, y: 340, w: 500, h: 46 } as Rect,
  /** 확인창(초기화·복사 대상 고르기): 패널과 버튼 줄 y */
  dialogPanel: { x: 230, y: 150, w: 500, h: 240 } as Rect,
  dialogButtonY: 300,
} as const;

/** 확인창 버튼 줄 (버튼 수 2~3) */
export function dialogButtons(count: number): Rect[] {
  return centeredRow(count, 140, 12, BUILD_LAYOUT.dialogButtonY);
}

const NODE_GAP_PAIR = 2;
const NODE_GAP_GROUP = 10;

/** 단 번호(1~4) 줄의 y */
export function tierRowY(tier: number): number {
  return BUILD_TOP + (tier - 1) * BUILD_ROW_STEP;
}

/** 단 이름표(표시만). 해금 조건 문구가 들어간다 */
export function tierLabelRect(tier: number): Rect {
  return { x: 8, y: tierRowY(tier), w: 68, h: MIN_TOUCH };
}

/**
 * 트리의 노드 칸 배치.
 * 무당·연계·살림은 단별 줄, 배타 갈래 쌍은 붙여서 놓는다. 요괴는 유닛 10종 x ①②③ (2열 x 5줄)
 */
export function nodeCells(tree: TreeId): { nodeId: string; rect: Rect }[] {
  if (tree === 'yogoe') {
    return YOGOE_UNIT_IDS.flatMap((unitId, i) => {
      const ids = yogoeNodeIds(unitId);
      const col = Math.floor(i / 5);
      const row = i % 5;
      return [ids.basic, ids.core, ids.awaken].map((nodeId, k) => ({
        nodeId,
        rect: { x: 8 + col * 342 + k * 112, y: BUILD_TOP + row * BUILD_ROW_STEP, w: 108, h: MIN_TOUCH },
      }));
    });
  }
  const out: { nodeId: string; rect: Rect }[] = [];
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const nodes = nodesOfTree(tree).filter((n) => n.tier === tier);
    let x = 84;
    nodes.forEach((n, i) => {
      if (i > 0) x += n.exclusiveGroup && n.exclusiveGroup === nodes[i - 1].exclusiveGroup ? NODE_GAP_PAIR : NODE_GAP_GROUP;
      out.push({ nodeId: n.id, rect: { x, y: tierRowY(tier), w: 92, h: MIN_TOUCH } });
      x += 92;
    });
  }
  return out;
}

// ----- 툴팁 (마우스를 올렸을 때 뜨는 설명 상자) -----
export const TOOLTIP_LAYOUT = {
  width: 280,
  padding: 8,
  /** 버튼과 상자 사이 간격 */
  gap: 6,
  /** 화면 가장자리 여백 */
  margin: 4,
  titleSize: 15,
  bodySize: 12,
  /** HUD(90~100)·일시정지·결과 덮개(180~195)·팝업 버튼(210) 위 */
  depth: 220,
} as const;
