import Phaser from 'phaser';
import { STAGES } from '../data/stages';
import { getBossById } from '../data/bosses';
import { STAR_RULES } from '../data/rewards';
import { MAP_ROWS, gridPosition, moveSelection, stageAt } from '../game/mapGrid';
import { progress } from '../game/progress';
import { drawNightSky } from './background';
import { bossChipSpecs } from './bossChips';
import { HUD_FONT, MAP_LAYOUT } from './layout';
import { KEY_MAP, KeyInput, mapDirectionOf } from './input';
import { MenuButton } from './MenuButton';
import { chapterColor, INK, PAPER } from './palette';
import { isBlockedByOverlay, openSettings } from './openSettings';

const L = MAP_LAYOUT;
const BOSS_RED = 0xd9473b;
const PAPER_DISABLED = 0xcdbf9a;

interface CellView {
  rect: Phaser.GameObjects.Rectangle;
}

/** 지도: 5장 × 5스테이지 선택, 정보 패널, 출전 */
export class MapScene extends Phaser.Scene {
  private selected = 0;
  private cells: CellView[] = [];
  private infoObjects: Phaser.GameObjects.GameObject[] = [];
  private keyInput!: KeyInput;

  constructor() {
    super('Map');
  }

  /** 전투에서 돌아오면 방금 한 스테이지를 선택해 둔다 */
  init(data: { stage?: number }): void {
    this.selected = Math.max(0, Math.min(STAGES.length - 1, Math.floor(data.stage ?? 0) || 0));
    this.cells = [];
    this.infoObjects = [];
  }

  create(): void {
    drawNightSky(this);
    this.add.text(24, 20, '지도', { fontFamily: HUD_FONT, fontSize: '28px', fontStyle: 'bold', color: '#f3ead4' });
    this.add.text(100, 30, '어느 밤을 지킬까', { fontFamily: HUD_FONT, fontSize: '16px', color: '#e0b52e' });
    this.createGrid();
    this.createInfoPanel();
    this.createBottomButtons();
    this.refreshSelection();

    this.keyInput = new KeyInput(window, (code) => this.onKeyDown(code));
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  // ----- 칸 -----

  private cellCenter(stage: number): { x: number; y: number } {
    const { row, col } = gridPosition(stage);
    return {
      x: L.gridX + col * (L.cellW + L.gap) + L.cellW / 2,
      y: L.gridY + row * (L.cellH + L.gap) + L.cellH / 2,
    };
  }

  private createGrid(): void {
    for (let row = 0; row < MAP_ROWS; row++) {
      const chapter = row + 1;
      const first = this.cellCenter(stageAt(row, 0));
      this.add.rectangle(24, first.y, 6, L.cellH, chapterColor(chapter)).setOrigin(0, 0.5);
      this.add
        .text(38, first.y, `${chapter}장`, { fontFamily: HUD_FONT, fontSize: '20px', fontStyle: 'bold', color: '#f3ead4' })
        .setOrigin(0, 0.5);
    }
    for (const def of STAGES) {
      const { x, y } = this.cellCenter(def.number);
      const rect = this.add.rectangle(x, y, L.cellW, L.cellH, PAPER);
      rect.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = def.number;
        this.refreshSelection();
      });
      // 코드·별은 왼쪽 정렬, 보스 배지는 오른쪽 위라 서로 겹치지 않는다
      const left = x - L.cellW / 2 + 8;
      this.add
        .text(left, y - 8, def.code, { fontFamily: HUD_FONT, fontSize: '20px', fontStyle: 'bold', color: '#2b2622' })
        .setOrigin(0, 0.5);
      this.add
        .text(left, y + 18, starText(progress.getBestStars(def.number)), {
          fontFamily: HUD_FONT, fontSize: '16px', color: '#b8860b',
        })
        .setOrigin(0, 0.5);
      if (def.isBossStage) {
        this.add
          .text(x + L.cellW / 2 - 3, y - L.cellH / 2 + 3, '보스', {
            fontFamily: HUD_FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffffff',
            backgroundColor: '#d9473b', padding: { x: 3, y: 1 },
          })
          .setOrigin(1, 0);
      }
      this.cells.push({ rect });
    }
  }

  /** 선택 칸 강조와 정보 패널 갱신 */
  private refreshSelection(): void {
    STAGES.forEach((def, i) => {
      const rect = this.cells[i].rect;
      const isSelected = i === this.selected;
      rect.setFillStyle(isSelected ? 0xfff6dc : PAPER);
      if (isSelected) rect.setStrokeStyle(4, 0xe0b52e);
      else if (def.isBossStage) rect.setStrokeStyle(3, BOSS_RED);
      else rect.setStrokeStyle(2, INK);
    });
    this.refreshInfo();
  }

  // ----- 정보 패널 -----

  private createInfoPanel(): void {
    this.add.rectangle(L.infoX, L.infoY, L.infoW, L.infoH, PAPER).setOrigin(0).setStrokeStyle(3, INK);
    const cx = L.infoX + L.infoW / 2;
    const bottom = L.infoY + L.infoH;
    new MenuButton(this, cx, bottom - 118, L.infoW - 32, 66, '빌드 바꾸기 (8단계 예정)', () => {}, {
      fontSize: 15, fill: PAPER_DISABLED,
    }).setEnabled(false);
    new MenuButton(this, cx, bottom - 40, L.infoW - 32, 66, '출전', () => this.launch(), {
      fontSize: 22, fill: 0xe0b52e,
    });
  }

  /** 정보 패널의 바뀌는 글자와 칩을 다시 만든다 */
  private refreshInfo(): void {
    for (const o of this.infoObjects) o.destroy();
    this.infoObjects = [];
    const def = STAGES[this.selected];
    const x = L.infoX + 16;
    let y = L.infoY + 14;
    const font = { fontFamily: HUD_FONT, color: '#2b2622' };
    const add = (obj: Phaser.GameObjects.GameObject) => {
      this.infoObjects.push(obj);
      return obj;
    };

    const title = this.add.text(x, y, `${def.code} ${def.name}`, {
      ...font, fontSize: '20px', fontStyle: 'bold', wordWrap: { width: L.infoW - 32 },
    });
    add(title);
    y += title.height + 10;
    add(
      this.add.text(
        x, y,
        [
          `${def.chapter}장`,
          `★3 제한 시간  ${formatTime(def.threeStarSeconds)}`,
          `최고 별  ${starText(progress.getBestStars(def.number))}`,
        ].join('\n'),
        { ...font, fontSize: '15px', lineSpacing: 6 },
      ),
    );
    y += 84;

    if (def.bossId) {
      const boss = getBossById(def.bossId);
      add(this.add.text(x, y, `보스  ${boss.name}`, { ...font, fontSize: '16px', fontStyle: 'bold', color: '#b3302a' }));
      y += 28;
      this.placeChips(bossChipSpecs(boss), x, y, add);
    } else {
      add(this.add.text(x, y, '일반 스테이지', { ...font, fontSize: '15px', color: '#6b5a3a' }));
    }
  }

  /** 칩을 가로로 늘어놓고 폭이 넘치면 줄을 바꾼다 */
  private placeChips(
    specs: { text: string; color: string; background: string }[],
    startX: number,
    startY: number,
    add: (obj: Phaser.GameObjects.GameObject) => Phaser.GameObjects.GameObject,
  ): void {
    const maxX = L.infoX + L.infoW - 16;
    const gap = 6;
    let x = startX;
    let y = startY;
    for (const s of specs) {
      const chip = this.add.text(x, y, s.text, {
        fontFamily: HUD_FONT, fontSize: '13px', color: s.color, backgroundColor: s.background, padding: { x: 6, y: 2 },
      });
      if (x > startX && x + chip.width > maxX) {
        x = startX;
        y += 26;
        chip.setPosition(x, y);
      }
      x += chip.width + gap;
      add(chip);
    }
  }

  // ----- 아래 버튼 -----

  private createBottomButtons(): void {
    new MenuButton(this, 104, 490, 160, 66, '타이틀로 (Esc)', () => this.scene.start('Title'), { fontSize: 15 });
    new MenuButton(this, 284, 490, 160, 66, `설정 (${KEY_MAP.openSettings.slice(3)})`, () => openSettings(this), { fontSize: 15 });
    this.add.text(380, 480, '방향키 이동  ·  Enter 출전', { fontFamily: HUD_FONT, fontSize: '14px', color: '#9aa5c0' });
  }

  // ----- 동작 -----

  private launch(): void {
    this.scene.start('Battle', { stage: this.selected });
  }

  private onKeyDown(code: string): void {
    if (isBlockedByOverlay(this)) return;
    const dir = mapDirectionOf(code);
    if (dir) {
      this.selected = moveSelection(this.selected, dir);
      this.refreshSelection();
    } else if (code === KEY_MAP.mapLaunch) {
      this.launch();
    } else if (code === KEY_MAP.back) {
      this.scene.start('Title');
    } else if (code === KEY_MAP.openSettings) {
      openSettings(this);
    }
  }
}

function starText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(STAR_RULES.maxStars - stars);
}

function formatTime(seconds: number): string {
  const sec = Math.floor(seconds);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
