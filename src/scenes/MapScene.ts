import Phaser from 'phaser';
import { STAGES } from '../data/stages';
import { getBossById } from '../data/bosses';
import { STAR_RULES } from '../data/rewards';
import { gridPosition, moveSelection, stageAt } from '../game/mapGrid';
import { TEST_MODE } from '../data/testMode';
import { builds, gameSave, isTestMode, progress } from '../game/session';
import { drawNightSky } from './background';
import { bossChipSpecs } from './bossChips';
import { FULLSCREEN_LAYOUT, HUD_FONT, MAP_LAYOUT as L } from './layout';
import { FullscreenButton } from './FullscreenButton';
import { KEY_MAP, KeyInput, mapDirectionOf } from './input';
import { MenuButton } from './MenuButton';
import { chapterColor } from './palette';
import { DEFAULT_UI as U } from '../ui/default/tokens';
import { CHAPTER_TITLES, recommendedStage } from '../ui/default/journey';
import { panel } from '../ui/default/decor';
import { addArtImage } from '../render/CharacterRenderer';
import { addTestBadge } from './testBadge';
import { ChapterSelector } from '../ui/default/ChapterSelector';
import { isBlockedByOverlay, openSettings } from './openSettings';
import { gameSkin } from '../game/skin';

/** One chapter and five large gates, with the selected destination always in view. */
export class MapScene extends Phaser.Scene {
  private selected = 0;
  private launching = false;
  private chapterButtons: ChapterSelector[] = [];
  private routeObjects: Phaser.GameObjects.GameObject[] = [];
  private previewObjects: Phaser.GameObjects.GameObject[] = [];
  private keyInput!: KeyInput;

  constructor() { super('Map'); }

  init(data: { stage?: number } = {}): void {
    const resume = recommendedStage(STAGES.map(s => progress.getBestStars(s.number)));
    const requested = data.stage ?? resume;
    this.selected = Number.isFinite(requested) ? Math.max(0, Math.min(STAGES.length - 1, Math.floor(requested))) : resume;
    this.launching = false;
    this.chapterButtons = [];
    this.routeObjects = [];
    this.previewObjects = [];
  }

  create(): void {
    drawNightSky(this);
    const journey = this.add.graphics().setDepth(-1);
    journey.fillStyle(0x0c1c24, 0.82).fillRoundedRect(18, 70, 924, 78, 10);
    journey.lineStyle(1, U.gold, 0.16).lineBetween(36, 148, 924, 148);
    this.add.text(24, 19, gameSkin.current === 'military' ? '작전 지도' : '축제의 여정', { fontFamily: HUD_FONT, fontSize: '30px', fontStyle: 'bold', color: U.text });
    const total = STAGES.reduce((sum, s) => sum + progress.getBestStars(s.number), 0);
    this.add.text(930, 30, '★ ' + total + ' / ' + STAGES.length * STAR_RULES.maxStars, {
      fontFamily: HUD_FONT, fontSize: '21px', fontStyle: 'bold', color: U.goldText,
    }).setOrigin(1, 0);

    new FullscreenButton(this, FULLSCREEN_LAYOUT.map, 'icon');

    L.chapters.forEach((r, i) => {
      const cleared = STAGES.filter(stage => stage.chapter === i + 1).map(stage => progress.getBestStars(stage.number) > 0);
      this.chapterButtons.push(new ChapterSelector(this, r, i, CHAPTER_TITLES[i], cleared, () => {
        if (!this.launching && !isBlockedByOverlay(this)) this.select(stageAt(i, gridPosition(this.selected).col));
      }));
    });
    panel(this, L.route.x, L.route.y, L.route.w, L.route.h, true, -2);
    panel(this, L.preview.x, L.preview.y, L.preview.w, L.preview.h);
    const p = L.preview, cy = p.y + p.h - 41;
    new MenuButton(this, p.x + 70, cy, 116, 66, '빌드 바꾸기', () => this.openBuild(), { fontSize: 16 });
    new MenuButton(this, p.x + 222, cy, 172, 66, '출전  →', () => this.launch(), { fontSize: 25, tone: 'primary' });
    new MenuButton(this, 104, 490, 160, 66, '타이틀 (Esc)', () => { if (!this.launching) this.scene.start('Title'); }, { fontSize: 16 });
    new MenuButton(this, 284, 490, 160, 66, '설정 (O)', () => { if (!this.launching) openSettings(this); }, { fontSize: 16 });
    if (isTestMode) new MenuButton(this, 460, 490, 160, 66, TEST_MODE.resetButton, () => this.resetTestData(), { fontSize: 14 });
    addTestBadge(this);
    new MenuButton(this, 460, 35, 260, 66, `게임 스킨: ${gameSkin.current === 'military' ? '밀리터리' : '기본'} ⇄`, () => {
      if (this.launching || isBlockedByOverlay(this)) return;
      gameSkin.toggle(); this.scene.restart({ stage: this.selected });
    }, { fontSize: 15 });
    this.refresh();
    this.keyInput = new KeyInput(window, code => this.onKeyDown(code));
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  private select(stage: number): void {
    this.selected = stage;
    this.refresh();
  }

  private refresh(): void {
    const row = gridPosition(this.selected).row;
    this.chapterButtons.forEach((button, i) => button.setSelected(i === row));
    this.drawRoute(row);
    this.drawPreview();
  }

  private drawRoute(row: number): void {
    for (const object of this.routeObjects) object.destroy();
    this.routeObjects = [];
    const track = <T extends Phaser.GameObjects.GameObject>(object: T): T => { this.routeObjects.push(object); return object; };
    const color = chapterColor(row + 1);
    const completed = STAGES.filter(s => s.chapter === row + 1 && progress.getBestStars(s.number) > 0).length;
    track(this.add.text(48, 181, (row + 1) + '장 · ' + CHAPTER_TITLES[row], {
      fontFamily: HUD_FONT, fontSize: '26px', fontStyle: 'bold', color: U.text,
    }));
    track(this.add.text(48, 221, '다섯 관문을 지나, 축제의 등불을 되찾으세요.', {
      fontFamily: HUD_FONT, fontSize: '15px', color: U.muted,
    }));
    track(this.add.text(566, 189, completed + ' / 5 완료', {
      fontFamily: HUD_FONT, fontSize: '15px', color: U.goldText,
    }).setOrigin(1, 0));
    const path = track(this.add.graphics());
    path.lineStyle(6, color, 0.12);
    for (let i = 0; i < 4; i++) {
      const a = L.nodes[i], b = L.nodes[i + 1];
      path.lineBetween(a.x + a.w / 2, a.y + 35, b.x + b.w / 2, b.y + 35);
    }
    path.lineStyle(1, color, 0.4);
    for (let i = 0; i < 4; i++) {
      const a = L.nodes[i], b = L.nodes[i + 1];
      path.lineBetween(a.x + a.w / 2, a.y + 35, b.x + b.w / 2, b.y + 35);
    }
    L.nodes.forEach((r, i) => {
      const number = stageAt(row, i), def = STAGES[number], stars = progress.getBestStars(number);
      const selected = number === this.selected, cx = r.x + r.w / 2, cy = r.y + 35;
      const g = track(this.add.graphics());
      if (selected) g.fillStyle(U.gold, 0.1).fillCircle(cx, cy, 42);
      g.fillStyle(0x091524).fillCircle(cx, cy + 3, 34);
      g.fillStyle(selected ? U.gold : stars ? 0x345953 : U.panelRaised).fillCircle(cx, cy, 34);
      g.lineStyle(selected ? 2 : 1, selected ? U.gold : stars ? U.teal : U.edge, 0.8).strokeCircle(cx, cy, 34);
      if (selected) g.lineStyle(1, U.gold, 0.4).strokeCircle(cx, cy, 40);
      const portrait = def.bossId ? addArtImage(this, 'boss:' + def.bossId, 'icon', cx, cy, 58, 58) : undefined;
      if (portrait) track(portrait);
      else track(this.add.text(cx, cy, String(i + 1).padStart(2, '0'), {
        fontFamily: HUD_FONT, fontSize: '27px', fontStyle: 'bold', color: selected ? U.darkText : U.text,
      }).setOrigin(0.5));
      track(this.add.text(cx, cy + 45, starText(stars), {
        fontFamily: HUD_FONT, fontSize: '19px', color: stars ? U.goldText : '#718798',
      }).setOrigin(0.5));
      if (def.isBossStage) track(this.add.text(cx, cy - 48, '보스', {
        fontFamily: HUD_FONT, fontSize: '14px', color: '#f0aba0', fontStyle: 'bold',
      }).setOrigin(0.5));
      const hit = track(this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', () => { if (!this.launching) this.select(number); });
    });
    track(this.add.text(48, 413, '← → 관문 선택    ↑ ↓ 장 변경    Enter 출전', {
      fontFamily: HUD_FONT, fontSize: '14px', color: U.muted,
    }));
  }

  private drawPreview(): void {
    for (const object of this.previewObjects) object.destroy();
    this.previewObjects = [];
    const track = <T extends Phaser.GameObjects.GameObject>(object: T): T => { this.previewObjects.push(object); return object; };
    const def = STAGES[this.selected], p = L.preview, x = p.x + 20, color = chapterColor(def.chapter);
    const scenery = track(this.add.graphics());
    scenery.fillStyle(0x203749).fillRoundedRect(p.x + 12, p.y + 12, p.w - 24, 108, 12);
    scenery.fillStyle(color, 0.08).fillCircle(p.x + p.w - 64, p.y + 64, 46);
    scenery.fillStyle(0x344f60).fillTriangle(p.x + 90, p.y + 120, p.x + 175, p.y + 37, p.x + 260, p.y + 120);
    scenery.fillStyle(0x172b3b).fillTriangle(p.x + 150, p.y + 120, p.x + 230, p.y + 60, p.x + 300, p.y + 120);
    track(this.add.text(x + 4, p.y + 26, 'STAGE ' + def.code, {
      fontFamily: HUD_FONT, fontSize: '18px', fontStyle: 'bold', color: U.goldText,
    }));
    track(this.add.text(x + 4, p.y + 62, gameSkin.current === 'military' ? def.isBossStage ? '감염 지휘 개체 격파' : '지휘소 방어 · 감염 거점 돌파' : def.isBossStage ? '보스와의 한판' : '마을의 등불 지키기', {
      fontFamily: HUD_FONT, fontSize: '15px', color: U.text,
    }));
    const portrait = addArtImage(this, def.bossId ? 'boss:' + def.bossId : 'hero:kkomaMudang', 'icon',
      p.x + p.w - 68, p.y + 67, 86, 86);
    if (portrait) track(portrait);
    track(this.add.text(x, p.y + 132, def.name, {
      fontFamily: HUD_FONT, fontSize: '22px', fontStyle: 'bold', color: U.darkText,
      wordWrap: { width: p.w - 40, useAdvancedWrap: true },
    }));
    track(this.add.text(x, p.y + 184, '최고 기록  ' + starText(progress.getBestStars(def.number)), {
      fontFamily: HUD_FONT, fontSize: '17px', color: '#77623b',
    }));
    track(this.add.text(x, p.y + 213, '★3 목표 ' + formatTime(def.threeStarSeconds) + ' · 빌드 ' + (builds.activeIndex + 1), {
      fontFamily: HUD_FONT, fontSize: '15px', color: '#77623b',
    }));
    if (def.bossId) {
      let chipX = x, chipY = p.y + 246;
      for (const spec of bossChipSpecs(getBossById(def.bossId))) {
        const chip = track(this.add.text(0, 0, spec.text, {
          fontFamily: HUD_FONT, fontSize: '13px', color: spec.color,
          backgroundColor: spec.background, padding: { x: 5, y: 2 },
        }));
        if (chipX + chip.width > p.x + p.w - 20) { chipX = x; chipY += 25; }
        chip.setPosition(chipX, chipY); chipX += chip.width + 5;
      }
    } else track(this.add.text(x, p.y + 249, gameSkin.current === 'military' ? '병과를 배치하고 작전에 도전하세요.' : '요괴 친구들과 함께 도전하세요.', {
      fontFamily: HUD_FONT, fontSize: '15px', color: '#77623b',
    }));
  }

  private resetTestData(): void {
    if (this.launching || !window.confirm(TEST_MODE.resetConfirm)) return;
    gameSave.clearStorage();
    window.location.reload();
  }

  private launch(): void {
    if (this.launching || isBlockedByOverlay(this)) return;
    this.launching = true;
    this.input.enabled = false;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Battle', { stage: this.selected });
    });
    this.cameras.main.fadeOut(180, 17, 26, 43);
  }

  private openBuild(): void {
    if (!this.launching) this.scene.start('Build', { stage: this.selected });
  }

  private onKeyDown(code: string): void {
    if (this.launching || isBlockedByOverlay(this)) return;
    const direction = mapDirectionOf(code);
    if (direction) this.select(moveSelection(this.selected, direction));
    else if (code === KEY_MAP.mapLaunch) this.launch();
    else if (code === KEY_MAP.back) this.scene.start('Title');
    else if (code === KEY_MAP.openBuild) this.openBuild();
    else if (code === KEY_MAP.openSettings) openSettings(this);
  }
}

function starText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(STAR_RULES.maxStars - stars);
}

function formatTime(seconds: number): string {
  const secondsInt = Math.floor(seconds);
  return String(Math.floor(secondsInt / 60)).padStart(2, '0') + ':' + String(secondsInt % 60).padStart(2, '0');
}
