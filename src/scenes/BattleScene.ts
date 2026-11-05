import Phaser from 'phaser';
import { ALLIES } from '../data/allies';
import type { Tag } from '../data/types';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { SKILLS, type SkillId } from '../data/skills';
import { STAGE_COUNT } from '../data/waves';
import { STAR_RULES } from '../data/rewards';
import { getStageDef } from '../battle/stage';
import { ALL_SYNERGY_IDS, Battle, type DamageEvent } from '../battle/battle';
import { isSynergyId, SYNERGY, type SynergyId } from '../data/synergy';
import { Base, Fighter, type Body } from '../battle/entities';
import {
  BATTLEFIELD, BATTLE_LAYOUT as L, centeredRow, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, HUD_FONT, minimapX,
  PAUSE_BUTTON, RESULT_LAYOUT, type Rect,
} from './layout';
import {
  BUTTON_FILL_ACTION, BUTTON_FILL_GATHER, colorForTags, ENEMY_COLOR, HERO_COLOR,
  SHRINE_COLOR, SKILL_COLORS, TAG_COLORS,
} from './palette';
import { builds, progress, summonOrder, wallet } from '../game/session';
import { addTestBadge } from './testBadge';
import { computeBuildEffects, parseUpgradeQuery } from '../game/buildEffects';
import type { BattleModifiers } from '../battle/modifiers';
import { ResultRecorder } from '../game/resultRecorder';
import type { StageResult } from '../battle/result';
import { ORIENTATION_KEY, type OrientationWatcher } from '../orientation';
import { bossChipSpecs } from './bossChips';
import { DamageFloaters } from './DamageFloaters';
import { floaterStyle } from './floaterStyle';
import { HudButton } from './HudButton';
import { KEY_MAP, KeyInput, skillIndexOf, summonIndexOf } from './input';
import { describePossessionSkill, describeSkill, skillStatus } from '../game/skillText';
import { describeUnit, summonStatus } from '../game/unitText';
import { Tooltip } from './Tooltip';
import { addArtImage, CharacterRenderer } from '../render/CharacterRenderer';
import { DEFAULT_UI as U, skillShortName, unitShortName } from '../ui/default/tokens';
import { festivalNight, panel } from '../ui/default/decor';
import { meterFill, resourceMeter } from '../ui/default/meters';
import { BattlefieldProjection } from '../render/battlefield';
import { drawBattlefield } from './battlefieldDecor';

/** 보스 등장 연출 길이(초): 화면이 어두워지고 이름이 나타났다 사라진다 */
const BOSS_INTRO_SECONDS = 1.6;
/** 일반 비행 유닛이 떠 있는 높이 */
const FLY_LIFT = 40;
/** 스킬 이펙트가 퍼지는 시간(초) */
const CAST_FX_SECONDS = 0.3;
/** 화면 겹침 깊이: HUD < 일시정지 덮개 < 결과 덮개 < 패널·글자 < 팝업 버튼 */
const DEPTH = { pauseDim: 180, resultDim: 190, resultPanel: 195, popupText: 200, popupButton: 210 } as const;

interface CastFx {
  id: SkillId;
  x: number;
  y: number;
  facing: 1 | -1;
  range: number;
  shape: 'fan' | 'circle';
  /** 빙의 스킬이면 이펙트 색을 정하는 유닛 태그 */
  tint?: Tag;
  age: number;
}

/** 빙의 표시 색 (금색) */
const POSSESSION_GOLD = 0xffd84a;

/** 전투 상태를 도형으로 그리고 입력만 전달하는 씬 */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private paused = false;
  private world!: Phaser.GameObjects.Graphics;
  private groundFx!: Phaser.GameObjects.Graphics;
  private field!: BattlefieldProjection;
  private characters!: CharacterRenderer;
  private hud!: Phaser.GameObjects.Graphics;
  private summonButtons: HudButton[] = [];
  private skillButtons: HudButton[] = [];
  /** 소환 버튼(키) 번호 -> ALLIES 인덱스. 저장된 소환 순서를 따른다 */
  private slotAlly: number[] = [];
  private castFx: CastFx[] = [];
  private tooltip!: Tooltip;
  /** 마우스가 올라가 있는 버튼 (없으면 null) */
  private hover: { kind: 'skill' | 'summon'; index: number } | null = null;
  /** 지금 열려 있는 툴팁의 대상 (내용을 다시 만들지 않으려는 표시) */
  private tooltipShown: string | null = null;
  private inspecting = false;
  private inspectButton!: HudButton;
  private meterValues = new Map<string, number>();
  private uiDelta = 0;
  private gatherButton!: HudButton;
  private moveLeftButton!: HudButton;
  private moveRightButton!: HudButton;
  private pauseButton!: HudButton;
  private resumeButton!: HudButton;
  private pauseMapButton!: HudButton;
  private restartButton!: HudButton;
  private nextButton!: HudButton;
  private mapButton!: HudButton;
  /** 결과를 한 번만 계산·기록한다 */
  private recorder!: ResultRecorder;
  private floaters!: DamageFloaters;
  private pauseDim!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pausePanel!: Phaser.GameObjects.Graphics;
  private pauseHint!: Phaser.GameObjects.Text;
  private pauseShown = false;
  private resultDim!: Phaser.GameObjects.Rectangle;
  private resultPanel!: Phaser.GameObjects.Graphics;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultStars!: Phaser.GameObjects.Text;
  private resultBody!: Phaser.GameObjects.Text;
  private resultLaidOut = false;
  private talismanText!: Phaser.GameObjects.Text;
  private spiritText!: Phaser.GameObjects.Text;
  private shrineText!: Phaser.GameObjects.Text;
  private castleText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private noteText!: Phaser.GameObjects.Text;
  /** 영웅 머리 위 "빙의: ○○" 이름표 (빙의했을 때만 만든다) */
  private possessionLabel?: Phaser.GameObjects.Text;
  /** 이번 전투에 적용하는 빌드 효과 (사용 중인 빌드 또는 ?upg=) */
  private modifiers!: BattleModifiers;
  private keyInput!: KeyInput;
  /** 승패가 난 뒤 지난 시간(초) */
  private resultElapsed = 0;
  /** 보스 등장 연출 남은 시간(초). 0이면 연출 없음 */
  private bossIntroLeft = 0;
  private bossSeen = false;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossIntroText!: Phaser.GameObjects.Text;
  private bossStateText!: Phaser.GameObjects.Text;
  private bossChips: Phaser.GameObjects.Text[] = [];
  private castleShieldText!: Phaser.GameObjects.Text;
  private bossPortrait?: Phaser.GameObjects.Image;

  constructor() {
    super('Battle');
  }

  /** 스테이지 번호: 씬 데이터 또는 URL ?stage=N (기본 0) */
  init(data: { stage?: number }): void {
    const fromUrl = Number(new URLSearchParams(window.location.search).get('stage'));
    const stage = data.stage ?? (Number.isFinite(fromUrl) ? fromUrl : 0);
    this.modifiers = modifiersForBattle();
    this.battle = new Battle({
      stage: Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(stage))),
      synergies: synergiesFromUrl(),
      bossAt: bossAtFromUrl(),
      modifiers: this.modifiers,
    });
    this.recorder = new ResultRecorder(progress, wallet);
    this.bossIntroLeft = 0;
    this.bossSeen = false;
    this.bossPortrait = undefined;
    this.bossChips = [];
    this.paused = false;
    this.pauseShown = false;
    this.resultLaidOut = false;
    this.resultElapsed = 0;
    this.summonButtons = [];
    this.skillButtons = [];
    this.slotAlly = ALLIES.map((_, slot) => summonOrder.allyIndexAt(slot));
    this.castFx = [];
    this.hover = null;
    this.tooltipShown = null;
    this.inspecting = false;
    this.meterValues.clear();
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, COMBAT.battlefieldLength, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(U.night);
    this.cameras.main.fadeIn(180, 17, 26, 43);
    festivalNight(this, COMBAT.battlefieldLength, BATTLEFIELD.backY - 12, 0);
    drawBattlefield(this);
    this.field = new BattlefieldProjection((body) => body instanceof Fighter ? this.liftOf(body) : 0);
    this.groundFx = this.add.graphics().setDepth(5);
    this.world = this.add.graphics().setDepth(50);
    this.drawBase(this.battle.shrine, 0xe0b52e);
    this.drawBase(this.battle.castle, ENEMY_COLOR);
    this.characters = new CharacterRenderer(this, this.field);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.characters.destroy());
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.floaters = new DamageFloaters(this);
    this.createHudTexts();
    this.createPossessionLabel();
    addTestBadge(this);
    this.createBossUi();
    this.createButtons();
    this.createPauseUi();
    this.createResultUi();
    this.setupInput();
    this.tooltip = new Tooltip(this);
  }

  /** HUD 글자: 바 안의 숫자, 오른쪽 정보 3줄, 아래 한 줄 */
  private createHudTexts(): void {
    const small = (r: Rect, size: number, color = '#ffffff') =>
      this.add
        .text(r.x, r.y, '', { fontFamily: HUD_FONT, fontSize: `${size}px`, color, lineSpacing: -2 })
        .setScrollFactor(0)
        .setDepth(95);
    const inBar = (r: Rect) => small({ ...r, x: r.x + 36, y: r.y + 1 }, r.h > 26 ? 16 : 14, U.text);
    this.talismanText = inBar(L.talismanBar);
    this.spiritText = inBar(L.spiritBar);
    this.shrineText = inBar(L.shrineBar);
    this.castleText = inBar(L.castleBar);
    this.infoText = small(L.infoText, 14, U.muted).setWordWrapWidth(L.infoText.w, true).setLineSpacing(2);
    this.noteText = small(L.noteText, 12, U.goldText);
  }

  /** 빙의 중이면 영웅 머리 위에 금색 이름표를 둔다 */
  private createPossessionLabel(): void {
    const form = this.battle.heroForm;
    this.possessionLabel = undefined;
    if (!form) return;
    this.possessionLabel = this.add
      .text(0, 0, `빙의: ${form.name}`, {
        fontFamily: HUD_FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffe48a', backgroundColor: '#1b1e33cc', padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 1).setDepth(60);
  }

  /** 보스 이름·상태·연출 글자와 성 무적 표시 (처음엔 숨김) */
  private createBossUi(): void {
    const style = { fontFamily: HUD_FONT, color: '#ffffff' };
    this.bossNameText = this.add
      .text(GAME_WIDTH / 2, L.bossName.y, '', { ...style, fontSize: '18px', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(95).setVisible(false);
    this.bossStateText = this.add
      .text(L.bossBar.x + L.bossBar.w + 8, L.bossBar.y - 1, '', { ...style, fontSize: '13px' })
      .setScrollFactor(0).setDepth(95).setVisible(false);
    this.bossIntroText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '', { ...style, fontSize: '64px', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(150).setVisible(false);
    this.castleShieldText = this.add
      .text(0, 0, '무적', { ...style, fontSize: '16px', fontStyle: 'bold', backgroundColor: '#3a6fd4cc', padding: { x: 6, y: 2 } })
      .setOrigin(0.5, 1).setDepth(60).setVisible(false);
  }

  /** 입력을 막는 반투명 전체 덮개 (처음엔 숨김) */
  private createDim(depth: number, alpha: number): Phaser.GameObjects.Rectangle {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, alpha)
      .setScrollFactor(0).setDepth(depth).setInteractive();
    setShown(dim, false);
    return dim;
  }

  /** 일시정지 화면: 덮개, 제목, 계속·지도로 버튼 */
  private createPauseUi(): void {
    this.pauseDim = this.createDim(DEPTH.pauseDim, 0.65);
    this.pausePanel = panel(this, 220, 160, 520, 230, true, DEPTH.pauseDim + 1).setScrollFactor(0).setVisible(false);
    const style = { fontFamily: HUD_FONT, color: '#ffffff' };
    this.pauseTitle = this.add
      .text(GAME_WIDTH / 2, 200, '일시정지', { ...style, fontSize: '48px', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.popupText).setVisible(false);
    this.pauseHint = this.add
      .text(GAME_WIDTH / 2, 262, '지도로 나가면 이번 전투는 기록되지 않습니다', { ...style, fontSize: '15px', color: '#cfd6ee' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.popupText).setVisible(false);
    const [resume, toMap] = centeredRow(2, PAUSE_BUTTON.w, PAUSE_BUTTON.gap, PAUSE_BUTTON.y);
    const big = { center: true, bigLabel: true, labelSize: 18, depth: DEPTH.popupButton };
    this.resumeButton = new HudButton(this, resume, { ...big, fill: 0x3a6b4a }, { onPress: () => this.setPaused(false) });
    this.resumeButton.setTexts('계속 (Esc/P)', '');
    this.pauseMapButton = new HudButton(this, toMap, { ...big, fill: 0x6b5a3a }, { onPress: () => this.abandonToMap() });
    this.pauseMapButton.setTexts(`지도로 (${KEY_MAP.toMap.slice(3)})`, '');
    this.resumeButton.setVisible(false);
    this.pauseMapButton.setVisible(false);
  }

  /** 결과 화면: 전체 덮개 위에 패널과 글자, 버튼 (처음엔 숨김) */
  private createResultUi(): void {
    this.resultDim = this.createDim(DEPTH.resultDim, 0.7);
    const { x, y, w, h } = RESULT_LAYOUT.panel;
    const cx = x + w / 2;
    this.resultPanel = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.resultPanel).setVisible(false);
    this.resultPanel.fillStyle(U.panel, 1).fillRoundedRect(x, y, w, h, 16);
    this.resultPanel.lineStyle(1, U.gold, 0.8).strokeRoundedRect(x, y, w, h, 16);
    this.resultPanel.lineStyle(1, U.gold, 0.2).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 12);
    const style = { fontFamily: HUD_FONT, color: '#ffffff' };
    const depth = DEPTH.popupText;
    this.resultTitle = this.add
      .text(cx, y + 14, '', { ...style, fontSize: '34px', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth).setVisible(false);
    this.resultStars = this.add
      .text(cx, y + 62, '', { ...style, fontSize: '40px', color: '#ffd84a' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth).setVisible(false);
    this.resultBody = this.add
      .text(x + 40, y + 120, '', { ...style, fontSize: '15px', lineSpacing: 6 })
      .setScrollFactor(0).setDepth(depth).setVisible(false);

    const { w: bw, gap, y: by } = RESULT_LAYOUT.button;
    const [first] = centeredRow(1, bw, gap, by);
    const big = { center: true, bigLabel: true, labelSize: 16, depth: DEPTH.popupButton };
    this.restartButton = new HudButton(this, first, { ...big, fill: 0x3a6b4a }, { onPress: () => this.restart() });
    this.restartButton.setTexts(`${KEY_MAP.gatherOrRestart.slice(3)} 다시 하기`, '');
    this.nextButton = new HudButton(this, first, { ...big, fill: 0x3a5a8b }, { onPress: () => this.goNextStage() });
    this.nextButton.setTexts(`${KEY_MAP.nextStage.slice(3)} 다음 스테이지`, '');
    this.mapButton = new HudButton(this, first, { ...big, fill: 0x6b5a3a }, { onPress: () => this.goMap() });
    this.mapButton.setTexts(`${KEY_MAP.toMap.slice(3)} 지도로`, '');
    for (const b of [this.restartButton, this.nextButton, this.mapButton]) b.setVisible(false);
  }

  update(_time: number, delta: number): void {
    this.uiDelta = Math.min(delta / 1000, 0.06);
    const playing = this.battle.result === 'playing';
    const active = playing && !this.paused;
    if (active) {
      this.battle.step(delta / 1000, { moveDir: this.moveDir() });
      this.bossIntroLeft = Math.max(0, this.bossIntroLeft - delta / 1000);
    }
    this.watchBossAppearance();
    this.characters.update(active ? delta / 1000 : 0, [this.battle.hero, ...this.battle.allies, ...this.battle.enemies]);
    this.characters.pruneProjectiles(this.battle.projectiles);
    if (!playing) this.resultElapsed += delta / 1000;
    this.updateCastFx(delta / 1000, active);
    this.updateFloaters(delta / 1000, active);
    this.followHero();
    this.drawWorld();
    this.drawHud();
    this.updateButtons();
    this.updateTooltip();
    this.updateOverlay();
  }

  // ----- 툴팁 -----

  /** 버튼에 마우스가 있으면 설명을 열고 상태 줄을 매 프레임 갱신한다. 일시정지·결과 화면에서는 닫는다 */
  private updateTooltip(): void {
    const hover = this.hover;
    // 일시정지·결과 덮개는 입력을 막지만, 이미 열려 있던 툴팁은 여기서 닫는다
    if (this.paused || this.battle.result !== 'playing') this.closeInspection();
    if (this.inspecting && !hover) {
      const ids = this.battle.synergy.activeIds();
      const overviewKey = `overview:${ids.join(',')}`;
      if (this.tooltipShown !== overviewKey) {
        const synergies = ids.map((id) => `✓ ${SYNERGY[id].name}`);
        this.tooltip.show(L.inspect, { title: '전투 정보', lines: [
          '카드 또는 1~0 / Q W E 키로 유닛과 스킬 설명을 확인하세요.',
          '설명 모드에서는 이동·소환·스킬·기운 모으기가 실행되지 않습니다.',
          '', '현재 활성 연계', ...(synergies.length ? synergies : ['활성화된 연계가 없습니다.']),
        ] }, { text: '전투는 계속 진행됩니다 · I로 닫기', ok: true });
        this.tooltipShown = overviewKey;
      }
      return;
    }
    if (!hover || this.paused || this.battle.result !== 'playing') {
      this.tooltip.hide();
      this.tooltipShown = null;
      return;
    }
    const b = this.battle;
    const key = `${hover.kind}:${hover.index}`;
    if (hover.kind === 'skill') {
      const def = SKILLS[hover.index];
      const status = skillStatus({
        heroAlive: b.hero.alive, stunned: !!b.hero.status?.stunned, cooldown: b.skillCooldown(def.id),
        spirit: b.resources.spirit, spiritCost: b.skillSpiritCost(def.id),
      });
      if (this.tooltipShown !== key) {
        this.tooltip.show(L.skills[hover.index], this.skillTooltip(def.id), status);
        this.tooltipShown = key;
      } else this.tooltip.setStatus(status);
      return;
    }
    const allyIndex = this.slotAlly[hover.index];
    const def = b.allyDef(allyIndex);
    const status = summonStatus({
      allyCount: b.allies.length, maxAllies: COMBAT.maxAllies, cooldown: b.summonCooldown(allyIndex),
      talisman: b.resources.talisman, cost: def.cost,
    });
    if (this.tooltipShown !== key) {
      const keyLabel = String((hover.index + 1) % 10);
      this.tooltip.show(L.summon[hover.index], describeUnit(def.id, this.modifiers, keyLabel), status);
      this.tooltipShown = key;
    } else this.tooltip.setStatus(status);
  }

  /** 스킬 툴팁 문구: 빙의 중이면 빙의 스킬, 아니면 기본 무당 스킬 */
  private skillTooltip(id: SkillId) {
    const b = this.battle;
    const unitId = b.hero.possessedId;
    const possessed = unitId && b.possessionSkillsActive ? describePossessionSkill(unitId, id) : null;
    if (possessed) return possessed;
    return describeSkill(id, this.modifiers);
  }

  /** 키보드와 화면 ◀ ▶ 버튼을 합친 이동 방향 (-1, 0, 1) */
  private moveDir(): number {
    if (this.inspecting) return 0;
    const touch = (this.moveRightButton.isHeld ? 1 : 0) - (this.moveLeftButton.isHeld ? 1 : 0);
    return Math.max(-1, Math.min(1, this.keyInput.moveDir() + touch));
  }

  // ----- 데미지 숫자 -----

  /** 피해 기록을 숫자로 바꿔 띄우고, 이미 떠 있는 숫자는 움직인다 */
  private updateFloaters(dt: number, advance: boolean): void {
    for (const e of this.battle.drainDamageEvents()) {
      this.spawnFloater(e);
      if (e.amount > 0 && e.kind !== 'burn' && e.kind !== 'immune') this.characters.hit(e.target);
    }
    this.floaters.update(advance ? dt : 0);
  }

  private spawnFloater(e: DamageEvent): void {
    const t = e.target;
    const y = this.field.top(t) - 14;
    this.floaters.spawn(e.x + (Math.random() - 0.5) * 16, y, floaterStyle(e));
  }

  // ----- 보스 -----

  /** 보스가 처음 등장한 프레임에 연출을 시작하고 약점·저항 칩을 만든다 */
  private watchBossAppearance(): void {
    const enc = this.battle.encounter;
    if (!enc || this.bossSeen || enc.state === 'pending') return;
    this.bossSeen = true;
    this.bossPortrait = addArtImage(this, `boss:${enc.def.id}`, 'icon', L.bossBar.x - 25, L.bossBar.y + 6, 34, 34)
      ?.setScrollFactor(0).setDepth(95);
    this.bossIntroLeft = BOSS_INTRO_SECONDS;
    this.bossIntroText.setText(enc.def.name);
    this.bossNameText.setText(enc.def.name);
    this.bossChips = bossChipSpecs(enc.def).map((spec) =>
      this.add
        .text(0, L.bossChips.y, spec.text, {
          fontFamily: HUD_FONT, fontSize: '13px', color: spec.color, backgroundColor: spec.background, padding: { x: 6, y: 2 },
        })
        .setScrollFactor(0).setDepth(95),
    );
    const gap = 6;
    const total = this.bossChips.reduce((sum, c) => sum + c.width, 0) + gap * (this.bossChips.length - 1);
    let x = (GAME_WIDTH - total) / 2;
    for (const c of this.bossChips) {
      c.setX(x);
      x += c.width + gap;
    }
  }

  /** 보스 등장 연출 / 체력바 / 상태 글자. 보스가 죽으면 숨긴다 */
  private drawBossHud(g: Phaser.GameObjects.Graphics): void {
    const enc = this.battle.encounter;
    const boss = enc?.boss;
    const show = !!enc && !!boss && boss.alive;
    this.bossNameText.setVisible(show);
    this.bossStateText.setVisible(show);
    this.bossPortrait?.setVisible(show);
    for (const c of this.bossChips) c.setVisible(show);

    // 등장 연출: 화면이 어두워졌다가 풀리고, 이름이 나타났다 사라진다
    if (this.bossIntroLeft > 0) {
      const t = 1 - this.bossIntroLeft / BOSS_INTRO_SECONDS;
      const wave = Math.sin(Math.PI * t);
      g.fillStyle(0x000000, 0.6 * wave).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.bossIntroText.setVisible(true).setAlpha(wave).setScale(1 + 0.2 * t);
    } else {
      this.bossIntroText.setVisible(false);
    }
    if (!enc || !boss || !show) return;
    this.bar(g, L.bossBar, boss.hp / boss.maxHp, 0xc23b3b);
    this.bossStateText.setText(enc.statusLabel);
  }

  // ----- 입력 -----

  private setupInput(): void {
    this.keyInput = new KeyInput(window, (code) => this.onKeyDown(code));
    this.keyInput.attach();

    // 창이 숨겨지면 자동 일시정지 (키 눌림도 풀어 둔다)
    const onVisibility = () => {
      if (!document.hidden) return;
      this.keyInput.releaseAll();
      this.setPaused(true);
    };
    const onBlur = () => { this.keyInput.releaseAll(); this.setPaused(true); };
    const releaseMovement = () => { this.moveLeftButton.release(); this.moveRightButton.release(); };
    window.addEventListener('pointercancel', releaseMovement);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    // 세로 화면이 되면 자동 일시정지. 가로로 돌아와도 사용자가 직접 재개한다
    const watcher = this.registry.get(ORIENTATION_KEY) as OrientationWatcher | undefined;
    const unsubscribe = watcher?.subscribe((portrait) => {
      if (portrait) this.setPaused(true);
    });
    if (watcher?.isPortrait) this.setPaused(true);

    // 씬이 끝나면 리스너를 모두 해제한다
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.keyInput.detach();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointercancel', releaseMovement);
      window.removeEventListener('blur', onBlur);
      unsubscribe?.();
    });
  }

  /** 전투 중에만 일시정지/재개한다. 멈추면 누르고 있던 이동 버튼을 놓는다 */
  private setPaused(value: boolean): void {
    if (this.battle.result !== 'playing' || this.paused === value) return;
    this.paused = value;
    if (value) {
      this.closeInspection();
      this.moveLeftButton.release();
      this.moveRightButton.release();
    }
  }

  /** 결과가 난 직후 일정 시간은 재시작 입력을 무시한다 */
  private get restartAllowed(): boolean {
    return this.battle.result !== 'playing' && this.resultElapsed >= COMBAT.resultInputDelay;
  }

  /** 현재 스테이지를 다시 시작 (URL의 ?stage와 무관하게 지금 스테이지로) */
  private restart(): void {
    if (this.restartAllowed) this.scene.restart({ stage: this.battle.stage });
  }

  /** 승리했고 마지막 스테이지가 아니면 다음 스테이지 번호 */
  private get nextStage(): number | null {
    const next = this.battle.stage + 1;
    return this.battle.result === 'victory' && next < STAGE_COUNT ? next : null;
  }

  private goNextStage(): void {
    const next = this.nextStage;
    if (this.restartAllowed && next !== null) this.scene.restart({ stage: next });
  }

  /** 결과 화면에서 지도로 돌아간다 (방금 한 스테이지를 선택해 둔다) */
  private goMap(): void {
    if (this.restartAllowed) this.scene.start('Map', { stage: this.battle.stage });
  }

  /** 일시정지 중 전투를 포기하고 지도로 간다. 결과를 계산하지 않으므로 진행 기록은 남지 않는다 */
  private abandonToMap(): void {
    if (this.paused && this.battle.result === 'playing') this.scene.start('Map', { stage: this.battle.stage });
  }

  /** 결과를 한 번만 계산해 기록하고 같은 값을 돌려준다. 아직 안 끝났으면 null */
  private settledResult(): StageResult | null {
    return this.recorder.settle(this.battle.stage, (prev) => this.battle.stageResult(prev));
  }

  private onKeyDown(code: string): void {
    if (this.battle.result !== 'playing') {
      if (code === KEY_MAP.gatherOrRestart) this.restart();
      else if (code === KEY_MAP.nextStage) this.goNextStage();
      else if (code === KEY_MAP.toMap) this.goMap();
      return;
    }
    if ((KEY_MAP.pause as readonly string[]).includes(code)) {
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused) {
      if (code === KEY_MAP.toMap) this.abandonToMap();
      return;
    }
    if (code === KEY_MAP.inspect) { this.toggleInspection(); return; }
    if (this.inspecting) {
      const skill = skillIndexOf(code), summon = summonIndexOf(code);
      if (skill >= 0) this.inspectCard('skill', skill);
      else if (summon >= 0) this.inspectCard('summon', summon);
      return;
    }
    if (code === KEY_MAP.gatherOrRestart) {
      this.battle.gather();
      return;
    }
    const skill = skillIndexOf(code);
    if (skill >= 0) {
      this.battle.castSkill(SKILLS[skill].id);
      return;
    }
    const index = summonIndexOf(code);
    if (index >= 0) this.battle.summon(this.slotAlly[index]);
  }

  // ----- 버튼 -----

  private createButtons(): void {
    const arrow = { center: true, bigLabel: true, labelSize: 30, fill: BUTTON_FILL_ACTION };
    this.moveLeftButton = new HudButton(this, L.moveLeft, arrow, { onPress: () => {}, onInspect: () => this.inspecting });
    this.moveLeftButton.setTexts('◀', '');
    this.moveRightButton = new HudButton(this, L.moveRight, arrow, { onPress: () => {}, onInspect: () => this.inspecting });
    this.moveRightButton.setTexts('▶', '');
    this.pauseButton = new HudButton(
      this, L.pause, { center: true, bigLabel: true, labelSize: 26, fill: BUTTON_FILL_ACTION },
      { onPress: () => this.setPaused(!this.paused) },
    );
    this.pauseButton.setTexts('⏸', '');
    this.inspectButton = new HudButton(this, L.inspect, { center: true, bigLabel: true, labelSize: 15, border: U.teal },
      { onPress: () => this.toggleInspection() });
    this.inspectButton.setTexts('설명 보기 (I)', '');

    this.slotAlly.forEach((allyIndex, i) => {
      const def = ALLIES[allyIndex];
      const btn = new HudButton(
        this, L.summon[i], { fill: U.panel, border: colorForTags(def.tags), portraitTile: true, key: String((i + 1) % 10) },
        {
          onInspect: () => this.inspectCard('summon', i),
          onPress: () => { if (!this.paused) this.battle.summon(allyIndex); },
          onHover: () => { if (!this.inspecting) this.hover = { kind: 'summon', index: i }; },
          onHoverOut: () => { if (!this.inspecting && this.hover?.kind === 'summon' && this.hover.index === i) this.hover = null; },
        },
      );
      btn.setTexts(unitShortName(def.id, def.name), `${this.battle.allyDef(allyIndex).cost}`);
      btn.setPortrait(`ally:${def.id}`);
      this.summonButtons.push(btn);
    });
    SKILLS.forEach((def, i) => {
      const btn = new HudButton(
        this, L.skills[i], { center: true, labelSize: 13, fill: U.panel, border: SKILL_COLORS[def.id], borderWidth: 3,
          key: KEY_MAP.skills[i].slice(3), glyph: ['≋', '✦', '✧'][i] },
        {
          onInspect: () => this.inspectCard('skill', i),
          onPress: () => { if (!this.paused) this.battle.castSkill(def.id); },
          onHover: () => { if (!this.inspecting) this.hover = { kind: 'skill', index: i }; },
          onHoverOut: () => { if (!this.inspecting && this.hover?.kind === 'skill' && this.hover.index === i) this.hover = null; },
        },
      );
      btn.setTexts(skillShortName(this.battle.skillName(def.id)), `신력 ${this.battle.skillSpiritCost(def.id)}`);
      this.skillButtons.push(btn);
    });
    this.gatherButton = new HudButton(
      this, L.gather, { center: true, labelSize: 15, fill: BUTTON_FILL_GATHER, border: U.gold, key: 'R', glyph: '◈' },
      { onPress: () => { if (!this.paused) this.battle.gather(); }, onInspect: () => this.inspecting },
    );
  }

  private updateButtons(): void {
    const b = this.battle;
    this.slotAlly.forEach((allyIndex, i) => {
      const base = ALLIES[allyIndex];
      const def = b.allyDef(allyIndex); // 업그레이드로 바뀐 비용·쿨타임
      const cd = b.summonCooldown(allyIndex);
      const enabled = cd <= 0 && b.resources.talisman >= def.cost && b.allies.length < COMBAT.maxAllies;
      const reason = cd > 0 ? `${cd.toFixed(1)}초` : b.allies.length >= COMBAT.maxAllies ? '정원 가득' : b.resources.talisman < def.cost ? '부적 부족' : '준비';
      this.summonButtons[i].setTexts(unitShortName(base.id, base.name), `${def.cost}`);
      this.summonButtons[i].setState(cd / def.cooldown, enabled, reason);
    });
    SKILLS.forEach((def, i) => {
      const cd = b.skillCooldown(def.id);
      const cost = b.skillSpiritCost(def.id);
      const enabled = b.result === 'playing' && cd <= 0 && b.hero.alive && !b.hero.status?.stunned && b.resources.spirit >= cost;
      const reason = !b.hero.alive ? '부활 중' : b.hero.status?.stunned ? '기절 중' : cd > 0 ? `${cd.toFixed(1)}초` : b.resources.spirit < cost ? '신력 부족' : '준비';
      this.skillButtons[i].setTexts(skillShortName(b.skillName(def.id)), `신력 ${cost}`);
      this.skillButtons[i].setState(cd / b.skillCooldownMax(def.id), enabled, reason);
    });
    const gatherCost = b.resources.nextGatherCost;
    const r = b.resources;
    this.gatherButton.setTexts(
      `기운 모으기\n${r.gatherLevel}/${r.maxGatherLevel}단계`,
      gatherCost === null ? '최대' : `부적 ${gatherCost}`,
    );
    this.gatherButton.setState(0, gatherCost !== null && r.talisman >= gatherCost,
      gatherCost === null ? '최대 단계' : r.talisman >= gatherCost ? '충전 강화' : '부적 부족');
    this.inspectButton.setTexts(this.inspecting ? '설명 닫기 (I)' : '설명 보기 (I)', '');
    this.inspectButton.setState(0, true, this.inspecting ? '카드·숫자키로 확인' : '유닛 · 스킬 정보');
    this.moveLeftButton.setState(0, true);
    this.moveRightButton.setState(0, true);
    this.pauseButton.setState(0, true);
  }

  private toggleInspection(): void {
    if (this.paused || this.battle.result !== 'playing') return;
    const next = !this.inspecting;
    this.closeInspection();
    this.inspecting = next;
    this.moveLeftButton.release(); this.moveRightButton.release();
    this.keyInput.releaseAll();
  }

  private inspectCard(kind: 'skill' | 'summon', index: number): boolean {
    if (!this.inspecting) return false;
    this.hover = { kind, index };
    this.tooltipShown = null;
    return true;
  }

  private closeInspection(): void {
    this.inspecting = false;
    this.hover = null;
    this.tooltipShown = null;
    this.tooltip?.hide();
  }

  // ----- 그리기 -----

  private followHero(): void {
    const cam = this.cameras.main;
    const target = this.battle.hero.x - GAME_WIDTH / 2;
    cam.scrollX = Math.max(0, Math.min(COMBAT.battlefieldLength - GAME_WIDTH, target));
  }

  /** 시전 기록을 받아 이펙트를 만들고, 일시정지 중이 아니면 나이를 먹인다 */
  private updateCastFx(dt: number, advance: boolean): void {
    for (const e of this.battle.drainCastEvents()) {
      this.castFx.push({ id: e.id, x: e.x, y: this.field.ground(this.battle.hero), facing: e.facing,
        range: e.range, shape: e.shape, tint: e.possessed?.tint, age: 0 });
      this.characters.cast(this.battle.hero, e);
    }
    if (advance) for (const fx of this.castFx) fx.age += dt;
    this.castFx = this.castFx.filter((fx) => fx.age < CAST_FX_SECONDS);
  }

  /** 바닥에 닿는 범위는 레인 원근에 맞춰 납작한 부채꼴·타원으로 표시한다. */
  private drawCastFx(): void {
    const g = this.groundFx;
    for (const fx of this.castFx) {
      const t = fx.age / CAST_FX_SECONDS;
      const alpha = 0.5 * (1 - t);
      if (fx.shape === 'fan') {
        const r = fx.range * t;
        const points = [new Phaser.Math.Vector2(fx.x, fx.y)];
        for (let i = 0; i <= 20; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 20;
          points.push(new Phaser.Math.Vector2(fx.x + Math.cos(angle) * r * fx.facing,
            fx.y + Math.sin(angle) * r * BATTLEFIELD.groundScaleY));
        }
        g.fillStyle(fx.tint ? TAG_COLORS[fx.tint] : TAG_COLORS.wind, alpha).fillPoints(points, true);
      } else {
        const full = fx.range;
        const color = fx.tint ? TAG_COLORS[fx.tint] : fx.id === 'blessing' ? TAG_COLORS.divine : TAG_COLORS.fire;
        g.fillStyle(color, alpha).fillEllipse(fx.x, fx.y, full * t * 2, full * t * 2 * BATTLEFIELD.groundScaleY);
        g.lineStyle(2, color, alpha * 2).strokeEllipse(fx.x, fx.y, full * t * 2, full * t * 2 * BATTLEFIELD.groundScaleY);
      }
    }
  }

  private drawWorld(): void {
    const g = this.world;
    const b = this.battle;
    g.clear();
    const floor = this.groundFx.clear();

    // 오라와 그림자는 캐릭터보다 아래, 지형보다 위에 표시한다.
    for (const a of b.auraCircles) {
      const owner = b.hero.x === a.x ? b.hero : b.allies.find((f) => f.x === a.x);
      const y = owner ? this.field.ground(owner) : GROUND_Y;
      floor.fillStyle(0xfff2a8, 0.1).fillEllipse(a.x, y, a.radius * 2, a.radius * 2 * BATTLEFIELD.groundScaleY);
      floor.lineStyle(1, 0xfff2a8, 0.4).strokeEllipse(a.x, y, a.radius * 2, a.radius * 2 * BATTLEFIELD.groundScaleY);
    }
    for (const base of [b.shrine, b.castle]) {
      floor.fillStyle(0x090e18, 0.4).fillEllipse(base.x + 6, this.field.ground(base) + 4, base.width + 38, 22);
      this.drawHpBar(base.x, this.field.top(base) - 17, base.width + 20, base.hp / base.maxHp,
        base === b.shrine ? U.teal : 0xef9b97);
    }
    this.castleShieldText
      .setVisible(b.castle.invulnerable)
      .setPosition(b.castle.x, this.field.top(b.castle) - 24);
    for (const f of b.allies) this.drawFighter(f, colorForTags(f.stats.tags));
    for (const f of b.enemies) this.drawFighter(f, ENEMY_COLOR);

    // 영웅
    const h = b.hero;
    if (h.alive) {
      const w = HERO.width, ht = HERO.height;
      const ground = this.field.ground(h), top = this.field.top(h);
      const form = b.heroForm;
      floor.fillStyle(0x081b1c, 0.4).fillEllipse(h.x + 2, ground + 2, w + 9, 10);
      floor.lineStyle(1.5, U.gold, 0.7).strokeEllipse(h.x, ground + 1, w + 16, 13);
      if (form) {
        // 빙의 표시: 금색 후광과 테두리
        floor.fillStyle(POSSESSION_GOLD, 0.18).fillEllipse(h.x, ground, w + 40, 18);
        floor.lineStyle(2, POSSESSION_GOLD, 0.9).strokeEllipse(h.x, ground, w + 40, 18);
      }
      if (!this.characters.shows(h)) {
        // 에셋이 없으면 기존 대체 도형 (빙의 중이면 그 유닛의 태그 색)
        g.fillStyle(form ? colorForTags(form.unitTags) : TAG_COLORS.hero, 1).fillRect(h.x - w / 2, top, w, ht);
        g.fillStyle(0xd9473b, 1).fillRect(h.x - w / 2, top, w, 8);
        if (form) g.lineStyle(3, POSSESSION_GOLD, 1).strokeRect(h.x - w / 2, top, w, ht);
      }
      this.drawHpBar(h.x, top - 8, w + 8, h.hp / h.maxHp, U.teal);
      this.drawStatusMarks(h, h.x, top, w);
    }
    this.possessionLabel?.setVisible(h.alive).setPosition(h.x, this.field.top(h) - 22);

    this.drawCastFx();

    // 투사체
    for (const p of b.projectiles) {
      if (this.characters.projectile(p, b.elapsed)) continue;
      const color = p.team === 'ally' ? 0xffe28a : 0xb58cff;
      const point = this.field.projectile(p);
      g.fillStyle(color, 1).fillCircle(point.x, point.y, p.attackType === 'magic' ? 6 : 4);
    }
  }

  private drawBase(base: Base, color: number): void {
    const g = this.add.graphics().setDepth(this.field.depth(base));
    const ground = this.field.ground(base);
    const x = base.x - base.width / 2, y = this.field.top(base);
    const friendly = base === this.battle.shrine;
    const polygon = (color: number, points: number[][]) => g.fillStyle(color, 1)
      .fillPoints(points.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    // 단과 측벽, 지붕 윗면을 함께 보여 주는 약한 사선 구도.
    polygon(0x51554b, [[x - 8, ground - 7], [x + 4, ground - 17], [x + base.width + 17, ground - 13], [x + base.width + 10, ground + 5], [x - 8, ground + 5]]);
    polygon(friendly ? 0x493c30 : 0x292637,
      [[x + base.width, y + 16], [x + base.width + 14, y + 7], [x + base.width + 14, ground - 11], [x + base.width, ground]]);
    g.fillStyle(friendly ? 0x73533a : 0x39324c, 1).fillRoundedRect(x, y + 16, base.width, base.height - 16, 3);
    polygon(friendly ? 0x49676a : 0x494159,
      [[x - 12, y + 22], [base.x, y - 9], [base.x + 15, y - 19], [x + base.width + 25, y + 12], [x + base.width + 12, y + 22]]);
    g.fillStyle(friendly ? 0x344c50 : 0x302a40, 1).fillTriangle(x - 12, y + 22, base.x, y - 9, x + base.width + 12, y + 22);
    g.lineStyle(1.5, friendly ? 0x8ba295 : 0x82728d, 0.7).lineBetween(base.x, y - 9, base.x + 15, y - 19);
    g.lineStyle(3, friendly ? U.gold : 0x94719b, 1).lineBetween(x - 12, y + 22, x + base.width + 12, y + 22);
    g.fillStyle(color, 0.9).fillRoundedRect(base.x - 9, y + 36, 18, Math.max(12, base.height - 36), 3);
    g.fillStyle(0xffefb1, 0.9).fillRoundedRect(base.x - 5, y + 40, 10, 14, 2);
    g.fillStyle(0x9b8d77, 1).fillRect(x - 5, ground - 5, base.width + 10, 5);
  }

  private drawFighter(f: Fighter, color: number): void {
    const g = this.world;
    const w = f.stats.width * f.sizeScale;
    const h = f.stats.height * f.sizeScale;
    // 비행 유닛은 위쪽에 띄워 그린다
    const lift = this.field.elevation(f);
    const ground = this.field.ground(f), top = this.field.top(f);
    if (!this.characters.shows(f)) g.fillStyle(color, 1).fillRect(f.x - w / 2, top, w, h);
    if (f.stats.elite || f.isBoss) this.groundFx.lineStyle(2, f.isBoss ? 0xff8179 : 0xffd166, 0.85)
      .strokeEllipse(f.x, ground + 2, w + 16, Math.max(12, w * 0.3));
    const shadowScale = lift > 0 ? 0.75 : 1;
    this.groundFx.fillStyle(0x07191b, lift > 0 ? 0.22 : 0.35)
      .fillEllipse(f.x + 2, ground + 2, (w + 9) * shadowScale, Math.max(7, w * 0.24) * shadowScale);
    this.drawHpBar(f.x, top - 6, w + 6, f.hp / f.maxHp, f.team === 'ally' ? U.teal : 0xef9b97);
    this.drawStatusMarks(f, f.x, top, w);
  }

  /** 비행 유닛이 떠 있는 높이. 보스는 패턴 데이터의 높이를 쓴다 */
  private liftOf(f: Fighter): number {
    const def = this.battle.encounter?.def;
    if (def && this.battle.encounter?.boss === f && def.pattern.kind === 'descend') return def.pattern.flyHeight;
    return FLY_LIFT;
  }

  /** 상태 아이콘과 발밑 버프 타원. 본체·체력바와 같은 배치 좌표를 사용한다. */
  private drawStatusMarks(body: Body, cx: number, top: number, w: number): void {
    const st = body.status;
    if (!st) return;
    const g = this.world;
    if (st.buffed) this.groundFx.lineStyle(1.5, 0x78d8a1, 0.75)
      .strokeEllipse(cx, this.field.ground(body) + 2, w + 12, Math.max(10, w * 0.3));
    const y = top - 19;
    let x = cx - w / 2;
    const marks: Array<'stun' | 'heal' | 'burn' | 'break' | 'slow' | 'dispel'> = [];
    if (st.stunned) marks.push('stun');
    if (st.healBlocked) marks.push('heal');
    if (st.burning) marks.push('burn');
    if (st.defenseBreakStacks) marks.push('break');
    if (st.slowed) marks.push('slow');
    if (st.buffsDisabled) marks.push('dispel');
    for (const mark of marks.slice(0, 4)) {
      g.fillStyle(U.night, 0.95).fillRoundedRect(x, y - 6, 12, 12, 3);
      const color = mark === 'burn' ? 0xff9970 : mark === 'slow' ? 0x9dd9ff : U.gold;
      g.lineStyle(1.5, color, 1);
      if (mark === 'stun') {
        g.lineBetween(x + 6, y - 4, x + 6, y + 4).lineBetween(x + 2, y, x + 10, y);
      } else if (mark === 'burn') {
        g.fillStyle(color).fillTriangle(x + 2, y + 4, x + 7, y - 4, x + 10, y + 4);
      } else if (mark === 'slow') {
        g.lineBetween(x + 6, y - 4, x + 6, y + 4).lineBetween(x + 2, y, x + 6, y + 4).lineBetween(x + 10, y, x + 6, y + 4);
      } else if (mark === 'break') {
        for (let i = 0; i < st.defenseBreakStacks; i++) {
          g.fillStyle(color).fillRect(x + 2 + (i % 4) * 2.3, y - 3 + Math.floor(i / 4) * 4, 1.5, 2);
        }
      } else {
        g.strokeCircle(x + 6, y, 4).lineBetween(x + 2, y + 4, x + 10, y - 4);
        if (mark === 'heal') g.lineBetween(x + 3, y, x + 9, y).lineBetween(x + 6, y - 3, x + 6, y + 3);
      }
      x += 13;
    }
  }

  private drawHpBar(cx: number, y: number, width: number, ratio: number, color: number): void {
    meterFill(this.world, { x: cx - width / 2, y, w: width, h: 4 }, ratio, color);
  }

  private drawHud(): void {
    const g = this.hud;
    const b = this.battle;
    const r = b.resources;
    g.clear();
    // 위쪽 띠와 아래 패널 배경
    g.fillStyle(U.night, 0.96).fillRect(L.topStrip.x, L.topStrip.y, L.topStrip.w, L.topStrip.h);
    g.fillStyle(U.night, 1).fillRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
    g.lineStyle(1, U.gold, 0.4).lineBetween(0, L.panel.y, GAME_WIDTH, L.panel.y);
    for (const x of [166, 604, 716]) g.lineStyle(1, U.edge, 0.25).lineBetween(x, 402, x, 524);
    this.drawBossHud(g);

    resourceMeter(g, L.talismanBar, this.meterRatio('talisman', r.talisman / r.maxTalisman), U.gold, 'talisman');
    resourceMeter(g, L.spiritBar, this.meterRatio('spirit', r.spirit / r.maxSpirit), 0x80c9e9, 'spirit');
    resourceMeter(g, L.shrineBar, this.meterRatio('shrine', b.shrine.hp / b.shrine.maxHp), U.teal, 'shrine');
    const shielded = b.castle.invulnerable;
    resourceMeter(g, L.castleBar, this.meterRatio('castle', b.castle.hp / b.castle.maxHp), shielded ? 0x9aa5c0 : 0xef9b97, 'castle');
    this.talismanText.setText(`부적  ${Math.floor(r.talisman)} / ${r.maxTalisman}`);
    this.spiritText.setText(`신력  ${Math.floor(r.spirit)} / ${r.maxSpirit}`);
    this.shrineText.setText(`서낭당 ${Math.ceil(b.shrine.hp)}`);
    this.castleText.setText(shielded ? '원귀성 · 봉인' : `원귀성 ${Math.ceil(b.castle.hp)}`);
    this.drawMinimap(g);

    const def = getStageDef(b.stage);
    this.infoText.setText(
      `${def.code} ${def.name}\n` +
        `웨이브 ${b.waveCount}  ${formatTime(b.elapsed)}  위협 ${b.threatLevel}\n` +
        `${this.enemyLine()}  아군 ${b.allies.length}/${COMBAT.maxAllies}`,
    );
    const hero = b.hero;
    const heroLine = hero.alive ? '' : `영웅 부활 ${Math.ceil(hero.respawnTimer)}초  `;
    const note = heroLine + this.possessionLine() + this.synergyLine();
    this.noteText.setText(this.inspecting ? '설명 모드 · 카드 선택 · I로 닫기' : note.length > 29 ? `${note.slice(0, 28)}…` : note);
  }

  /** 미니맵: 전장 전체를 가로로 줄여 아군·적·영웅·보스 점과 현재 카메라 범위를 보여 준다 */
  private drawMinimap(g: Phaser.GameObjects.Graphics): void {
    const b = this.battle;
    const m = L.minimap;
    const len = COMBAT.battlefieldLength;
    const at = (x: number) => minimapX(x, len, m);
    g.fillStyle(0x081323, 0.8).fillRoundedRect(m.x, m.y, m.w, m.h, m.h / 2);
    const mid = m.y + m.h / 2;
    g.lineStyle(1, U.edge, 0.3).lineBetween(m.x + 8, mid, m.x + m.w - 8, mid);
    g.fillStyle(SHRINE_COLOR, 1).fillRect(at(b.shrine.x) - 2, m.y + 3, 4, m.h - 6);
    g.fillStyle(b.castle.invulnerable ? 0x9aa5c0 : 0xdd5555, 1).fillRect(at(b.castle.x) - 3, m.y + 3, 6, m.h - 6);
    for (const f of b.allies) g.fillStyle(colorForTags(f.stats.tags), 1).fillRect(at(f.x) - 1, mid + 2, 3, 3);
    for (const f of b.enemies) {
      if (f.isBoss) continue;
      g.fillStyle(0xb58cff, 1).fillRect(at(f.x) - 1, mid - 5, 3, 3);
    }
    const boss = b.encounter?.boss;
    if (boss?.alive) g.fillStyle(0xff4040, 1).fillCircle(at(boss.x), mid, 4);
    if (b.hero.alive) {
      const hx = at(b.hero.x);
      g.fillStyle(HERO_COLOR, 1).fillTriangle(hx, mid - 5, hx - 4, mid + 5, hx + 4, mid + 5);
    }
    const camW = (GAME_WIDTH / len) * m.w;
    g.fillStyle(0xffffff, 0.05).fillRoundedRect(at(this.cameras.main.scrollX), m.y + 2, camW, m.h - 4, 5);
    g.lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(at(this.cameras.main.scrollX), m.y + 2, camW, m.h - 4, 5);
  }

  /** 적 수 표시. 상한에 닿으면 대기 수도 보여 준다 */
  private enemyLine(): string {
    const b = this.battle;
    const pending = b.pendingSpawns > 0 ? ` (대기 ${b.pendingSpawns})` : '';
    return `적 ${b.enemyCount}/${COMBAT.maxEnemies}${pending}`;
  }

  /** 빙의 중이면 "빙의: ○○" */
  private possessionLine(): string {
    const form = this.battle.heroForm;
    if (!form) return '';
    return `빙의: ${form.name}  `;
  }

  /** 활성 연계 이름 (켜진 것이 없으면 빈 문자열) */
  private synergyLine(): string {
    const names = this.battle.synergy.activeIds().map((id) => SYNERGY[id].name);
    return names.length > 0 ? `연계 ${names.length}개 · ${names.slice(0, 2).join(', ')}${names.length > 2 ? ' 외' : ''}` : '';
  }

  private bar(g: Phaser.GameObjects.Graphics, r: Rect, ratio: number, color: number): void {
    meterFill(g, r, this.meterRatio(`bar:${r.x}:${r.y}`, ratio), color);
  }

  private meterRatio(key: string, ratio: number): number {
    const target = Math.max(0, Math.min(1, ratio));
    const previous = this.meterValues.get(key) ?? target;
    const value = previous + (target - previous) * (1 - Math.exp(-this.uiDelta * 16));
    this.meterValues.set(key, value);
    return value;
  }

  /** 일시정지·결과 화면의 보임/숨김 */
  private updateOverlay(): void {
    const ended = this.battle.result !== 'playing';
    this.setPauseShown(!ended && this.paused);

    const next = this.nextStage;
    setShown(this.resultDim, ended);
    this.resultPanel.setVisible(ended);
    this.resultTitle.setVisible(ended);
    this.resultStars.setVisible(ended);
    this.resultBody.setVisible(ended);
    if (!ended) return;
    if (!this.resultLaidOut) {
      // 보이는 버튼을 왼쪽부터 다시 하기, (다음 스테이지), 지도로 순으로 가운데 정렬
      this.resultLaidOut = true;
      const row = next !== null ? [this.nextButton, this.restartButton, this.mapButton] : [this.restartButton, this.mapButton];
      const { w, gap, y } = RESULT_LAYOUT.button;
      centeredRow(row.length, w, gap, y).forEach((rect, i) => {
        row[i].moveTo(rect.x, rect.y);
        row[i].setVisible(true);
      });
    }
    for (const btn of [this.restartButton, this.nextButton, this.mapButton]) btn.setState(0, this.restartAllowed);
    this.drawResultTexts();
  }

  private setPauseShown(shown: boolean): void {
    if (shown === this.pauseShown) return;
    this.pauseShown = shown;
    setShown(this.pauseDim, shown);
    this.pauseTitle.setVisible(shown);
    this.pausePanel.setVisible(shown);
    this.pauseHint.setVisible(shown);
    this.resumeButton.setVisible(shown);
    this.pauseMapButton.setVisible(shown);
  }

  /** 결과 패널 글자: 제목, 별, 걸린 시간·체력, 별 조건, 보상 */
  private drawResultTexts(): void {
    const res = this.settledResult();
    if (!res) return;
    const def = getStageDef(this.battle.stage);
    const hpPercent = Math.floor((this.battle.shrine.hp / this.battle.shrine.maxHp) * 100);
    const mark = (ok: boolean) => (ok ? '✔' : '✘');
    this.resultTitle.setText(res.victory ? '승리!' : '패배...');
    this.resultStars.setText('★'.repeat(res.stars) + '☆'.repeat(STAR_RULES.maxStars - res.stars));
    this.resultBody.setText(
      [
        `${def.code} ${def.name}`,
        `걸린 시간 ${formatTime(this.battle.elapsed)}    서낭당 체력 ${hpPercent}%`,
        `${mark(res.conditions.clear)} ★1  클리어`,
        `${mark(res.conditions.shrineHp)} ★2  서낭당 체력 ${STAR_RULES.shrineHpRatio * 100}% 이상`,
        `${mark(res.conditions.time)} ★3  ★2 조건 + ${formatTime(def.threeStarSeconds)} 안에 클리어`,
        `엽전 +${res.yeopjeon}    신명 +${res.sinmyeong}`,
      ].join('\n'),
    );
  }
}

/** 보이기/숨기기와 함께 입력 받기도 켜고 끈다 */
function setShown(obj: Phaser.GameObjects.Rectangle, shown: boolean): void {
  obj.setVisible(shown);
  if (obj.input) obj.input.enabled = shown;
}

/** 초 → mm:ss */
function formatTime(seconds: number): string {
  const sec = Math.floor(seconds);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

/** URL ?synergy=all 이면 모든 연계, 쉼표로 ID를 나열하면 그 연계만. 기본은 꺼짐 */
function synergiesFromUrl(): SynergyId[] {
  const value = new URLSearchParams(window.location.search).get('synergy');
  if (!value) return [];
  if (value === 'all') return [...ALL_SYNERGY_IDS];
  return value.split(',').filter(isSynergyId);
}

/**
 * 전투에 적용할 빌드 효과. URL ?upg=id1,id2:3 이 있으면 그 노드들을(신명·규칙과 무관, 저장에는 반영 안 함),
 * 없으면 사용 중인 빌드를 쓴다
 */
function modifiersForBattle(): BattleModifiers {
  const upg = new URLSearchParams(window.location.search).get('upg');
  return computeBuildEffects(upg !== null ? parseUpgradeQuery(upg) : builds.current.toData());
}

/** URL ?bossAt=초 로 보스 등장 시각을 바꾼다 (없거나 잘못된 값이면 기본 60초) */
function bossAtFromUrl(): number | undefined {
  const value = new URLSearchParams(window.location.search).get('bossAt');
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
