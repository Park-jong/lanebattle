import Phaser from 'phaser';
import { ALLIES } from '../data/allies';
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
  BATTLE_LAYOUT as L, centeredRow, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, HUD_FONT, minimapX,
  PAUSE_BUTTON, RESULT_LAYOUT, type Rect,
} from './layout';
import {
  BUTTON_FILL, BUTTON_FILL_ACTION, BUTTON_FILL_GATHER, colorForTags, ENEMY_COLOR, HERO_COLOR, HUD_PANEL,
  HUD_STRIP, SHRINE_COLOR, SKILL_COLORS, TAG_COLORS,
} from './palette';
import { builds, progress, summonOrder, wallet } from '../game/session';
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
import { addArtImage, CharacterRenderer } from '../render/CharacterRenderer';

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
  facing: 1 | -1;
  range: number;
  age: number;
}

/** 전투 상태를 도형으로 그리고 입력만 전달하는 씬 */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private paused = false;
  private world!: Phaser.GameObjects.Graphics;
  private characters!: CharacterRenderer;
  private hud!: Phaser.GameObjects.Graphics;
  private summonButtons: HudButton[] = [];
  private skillButtons: HudButton[] = [];
  /** 소환 버튼(키) 번호 -> ALLIES 인덱스. 저장된 소환 순서를 따른다 */
  private slotAlly: number[] = [];
  private castFx: CastFx[] = [];
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
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, COMBAT.battlefieldLength, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x2a3350);
    this.world = this.add.graphics().setDepth(30);
    this.characters = new CharacterRenderer(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.characters.destroy());
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.floaters = new DamageFloaters(this);
    this.createHudTexts();
    this.createBossUi();
    this.createButtons();
    this.createPauseUi();
    this.createResultUi();
    this.setupInput();
  }

  /** HUD 글자: 바 안의 숫자, 오른쪽 정보 3줄, 아래 한 줄 */
  private createHudTexts(): void {
    const small = (r: Rect, size: number, color = '#ffffff') =>
      this.add
        .text(r.x, r.y, '', { fontFamily: HUD_FONT, fontSize: `${size}px`, color, lineSpacing: -2 })
        .setScrollFactor(0)
        .setDepth(95);
    const inBar = (r: Rect) => small({ ...r, x: r.x + 4, y: r.y }, 12).setStroke('#000000', 2);
    this.talismanText = inBar(L.talismanBar);
    this.spiritText = inBar(L.spiritBar);
    this.shrineText = inBar(L.shrineBar);
    this.castleText = inBar(L.castleBar);
    this.infoText = small(L.infoText, 12, '#cfd6ee');
    this.noteText = small(L.noteText, 12, '#ffd166');
  }

  /** 보스 이름·상태·연출 글자와 성 무적 표시 (처음엔 숨김) */
  private createBossUi(): void {
    const style = { fontFamily: HUD_FONT, color: '#ffffff' };
    this.bossNameText = this.add
      .text(GAME_WIDTH / 2, L.bossName.y, '', { ...style, fontSize: '16px', fontStyle: 'bold' })
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
    this.resultPanel.fillStyle(0x10142a, 1).fillRect(x, y, w, h);
    this.resultPanel.lineStyle(2, 0xffffff, 0.6).strokeRect(x, y, w, h);
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
    const playing = this.battle.result === 'playing';
    const active = playing && !this.paused;
    if (active) {
      this.battle.step(delta / 1000, { moveDir: this.moveDir() });
      this.bossIntroLeft = Math.max(0, this.bossIntroLeft - delta / 1000);
    }
    this.watchBossAppearance();
    this.characters.update(active ? delta / 1000 : 0, [this.battle.hero, ...this.battle.allies, ...this.battle.enemies],
      GROUND_Y, (body) => body instanceof Fighter && body.flying ? this.liftOf(body) : 0);
    this.characters.pruneProjectiles(this.battle.projectiles);
    if (!playing) this.resultElapsed += delta / 1000;
    this.updateCastFx(delta / 1000, active);
    this.updateFloaters(delta / 1000, active);
    this.followHero();
    this.drawWorld();
    this.drawHud();
    this.updateButtons();
    this.updateOverlay();
  }

  /** 키보드와 화면 ◀ ▶ 버튼을 합친 이동 방향 (-1, 0, 1) */
  private moveDir(): number {
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
    const lift = t instanceof Fighter && t.flying ? this.liftOf(t) : 0;
    const y = GROUND_Y - heightOf(t) - lift - 14;
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
      unsubscribe?.();
    });
  }

  /** 전투 중에만 일시정지/재개한다. 멈추면 누르고 있던 이동 버튼을 놓는다 */
  private setPaused(value: boolean): void {
    if (this.battle.result !== 'playing' || this.paused === value) return;
    this.paused = value;
    if (value) {
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
    this.moveLeftButton = new HudButton(this, L.moveLeft, arrow, { onPress: () => {} });
    this.moveLeftButton.setTexts('◀', '');
    this.moveRightButton = new HudButton(this, L.moveRight, arrow, { onPress: () => {} });
    this.moveRightButton.setTexts('▶', '');
    this.pauseButton = new HudButton(
      this, L.pause, { center: true, bigLabel: true, labelSize: 26, fill: BUTTON_FILL_ACTION },
      { onPress: () => this.setPaused(!this.paused) },
    );
    this.pauseButton.setTexts('⏸', '');

    this.slotAlly.forEach((allyIndex, i) => {
      const def = ALLIES[allyIndex];
      const btn = new HudButton(
        this, L.summon[i], { fill: BUTTON_FILL, border: colorForTags(def.tags), borderWidth: 4 },
        { onPress: () => { if (!this.paused) this.battle.summon(allyIndex); } },
      );
      btn.setTexts(`${(i + 1) % 10} ${def.name}`, `${this.battle.allyDef(allyIndex).cost}`);
      btn.setPortrait(`ally:${def.id}`);
      this.summonButtons.push(btn);
    });
    SKILLS.forEach((def, i) => {
      const btn = new HudButton(
        this, L.skills[i], { shape: 'round', center: true, fill: BUTTON_FILL_ACTION, border: SKILL_COLORS[def.id], borderWidth: 3 },
        { onPress: () => { if (!this.paused) this.battle.castSkill(def.id); } },
      );
      btn.setTexts(`${KEY_MAP.skills[i].slice(3)} ${def.name}`, `신력 ${def.spiritCost}`);
      this.skillButtons.push(btn);
    });
    this.gatherButton = new HudButton(
      this, L.gather, { center: true, labelSize: 15, fill: BUTTON_FILL_GATHER },
      { onPress: () => { if (!this.paused) this.battle.gather(); } },
    );
  }

  private updateButtons(): void {
    const b = this.battle;
    this.slotAlly.forEach((allyIndex, i) => {
      const base = ALLIES[allyIndex];
      const def = b.allyDef(allyIndex); // 업그레이드로 바뀐 비용·쿨타임
      const cd = b.summonCooldown(allyIndex);
      const enabled = cd <= 0 && b.resources.talisman >= def.cost && b.allies.length < COMBAT.maxAllies;
      const sub = cd > 0 ? `${cd.toFixed(1)}s` : `${def.cost}`;
      this.summonButtons[i].setTexts(`${(i + 1) % 10} ${base.name}`, sub);
      this.summonButtons[i].setState(cd / def.cooldown, enabled);
    });
    SKILLS.forEach((def, i) => {
      const cd = b.skillCooldown(def.id);
      const enabled =
        b.result === 'playing' && cd <= 0 && b.hero.alive && !b.hero.status?.stunned && b.resources.spirit >= def.spiritCost;
      const sub = cd > 0 ? `${cd.toFixed(1)}s` : `신력 ${def.spiritCost}`;
      this.skillButtons[i].setTexts(`${KEY_MAP.skills[i].slice(3)} ${def.name}`, sub);
      this.skillButtons[i].setState(cd / b.skillCooldownMax(def.id), enabled);
    });
    const cost = b.resources.nextGatherCost;
    const r = b.resources;
    this.gatherButton.setTexts(
      `R 기운 모으기\n${r.gatherLevel}/${r.maxGatherLevel}`,
      cost === null ? '최대' : `부적 ${cost}`,
    );
    this.gatherButton.setState(0, cost !== null && r.talisman >= cost);
    this.moveLeftButton.setState(0, true);
    this.moveRightButton.setState(0, true);
    this.pauseButton.setState(0, true);
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
      this.castFx.push({ ...e, age: 0 });
      this.characters.cast(this.battle.hero, e, GROUND_Y);
    }
    if (advance) for (const fx of this.castFx) fx.age += dt;
    this.castFx = this.castFx.filter((fx) => fx.age < CAST_FX_SECONDS);
  }

  /** 스킬 범위 이펙트 (임시 도형): 부채 바람은 반원, 나머지는 원이 퍼진다 */
  private drawCastFx(): void {
    const g = this.world;
    for (const fx of this.castFx) {
      const t = fx.age / CAST_FX_SECONDS;
      const alpha = 0.5 * (1 - t);
      if (fx.id === 'fanWind') {
        const r = fx.range * t;
        const start = fx.facing > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.fillStyle(TAG_COLORS.wind, alpha).slice(fx.x, GROUND_Y, r, start, start + Math.PI, false).fillPath();
      } else {
        const full = fx.range;
        const color = fx.id === 'blessing' ? TAG_COLORS.divine : TAG_COLORS.fire;
        g.fillStyle(color, alpha).fillCircle(fx.x, GROUND_Y, full * t);
        g.lineStyle(2, color, alpha * 2).strokeCircle(fx.x, GROUND_Y, full * t);
      }
    }
  }

  private drawWorld(): void {
    const g = this.world;
    const b = this.battle;
    g.clear();
    // 땅
    g.fillStyle(0x4a4034, 1).fillRect(0, GROUND_Y, COMBAT.battlefieldLength, GAME_HEIGHT - GROUND_Y);
    g.fillStyle(0x6b5a3a, 1).fillRect(0, GROUND_Y, COMBAT.battlefieldLength, 6);

    // 오라 반경: 옅은 원
    for (const a of b.auraCircles) {
      g.fillStyle(0xfff2a8, 0.1).fillCircle(a.x, GROUND_Y, a.radius);
      g.lineStyle(1, 0xfff2a8, 0.35).strokeCircle(a.x, GROUND_Y, a.radius);
    }
    this.drawBase(b.shrine, 0xe0b52e);
    this.drawBase(b.castle, ENEMY_COLOR);
    this.castleShieldText
      .setVisible(b.castle.invulnerable)
      .setPosition(b.castle.x, GROUND_Y - b.castle.height - 16);
    for (const f of b.allies) this.drawFighter(f, colorForTags(f.stats.tags));
    for (const f of b.enemies) this.drawFighter(f, ENEMY_COLOR);

    // 영웅
    const h = b.hero;
    if (h.alive) {
      const w = HERO.width, ht = HERO.height;
      if (!this.characters.shows(h)) {
        g.fillStyle(TAG_COLORS.hero, 1).fillRect(h.x - w / 2, GROUND_Y - ht, w, ht);
        g.fillStyle(0xd9473b, 1).fillRect(h.x - w / 2, GROUND_Y - ht, w, 8);
      }
      this.drawHpBar(h.x, GROUND_Y - ht - 8, w + 8, h.hp / h.maxHp, 0x66dd66);
      this.drawStatusMarks(h, h.x, GROUND_Y - ht, w, ht);
    }

    this.drawCastFx();

    // 투사체
    for (const p of b.projectiles) {
      if (this.characters.projectile(p, GROUND_Y, b.elapsed)) continue;
      const color = p.team === 'ally' ? 0xffe28a : 0xb58cff;
      g.fillStyle(color, 1).fillCircle(p.x, GROUND_Y - 24, p.attackType === 'magic' ? 6 : 4);
    }
  }

  private drawBase(base: Base, color: number): void {
    const g = this.world;
    g.fillStyle(color, 1).fillRect(base.x - base.width / 2, GROUND_Y - base.height, base.width, base.height);
    g.lineStyle(2, 0x000000, 0.7).strokeRect(base.x - base.width / 2, GROUND_Y - base.height, base.width, base.height);
    this.drawHpBar(base.x, GROUND_Y - base.height - 10, base.width + 20, base.hp / base.maxHp, 0xdd5555);
  }

  private drawFighter(f: Fighter, color: number): void {
    const g = this.world;
    const w = f.stats.width * f.sizeScale;
    const h = f.stats.height * f.sizeScale;
    // 비행 유닛은 위쪽에 띄워 그린다
    const lift = f.flying ? this.liftOf(f) : 0;
    const top = GROUND_Y - h - lift;
    if (!this.characters.shows(f)) g.fillStyle(color, 1).fillRect(f.x - w / 2, top, w, h);
    if (f.stats.elite) g.lineStyle(3, 0xffd166, 1).strokeRect(f.x - w / 2, top, w, h);
    if (f.isBoss) g.lineStyle(3, 0xff4040, 1).strokeRect(f.x - w / 2, top, w, h);
    // 떠 있으면 그림자를 땅에 둔다 (비행/착지 구분)
    if (lift > 0) g.fillStyle(0x000000, 0.35).fillEllipse(f.x, GROUND_Y + 2, w, 8);
    this.drawHpBar(f.x, top - 6, w + 6, f.hp / f.maxHp, f.team === 'ally' ? 0x66dd66 : 0xdd5555);
    this.drawStatusMarks(f, f.x, top, w, h);
  }

  /** 비행 유닛이 떠 있는 높이. 보스는 패턴 데이터의 높이를 쓴다 */
  private liftOf(f: Fighter): number {
    const def = this.battle.encounter?.def;
    if (def && this.battle.encounter?.boss === f && def.pattern.kind === 'descend') return def.pattern.flyHeight;
    return FLY_LIFT;
  }

  /** 상태 표시 (임시): 화상 빨강 점, 감속 파랑 점, 기절 노랑 점, 방어 파괴 주황 칸(중첩 수), 버프 초록 테두리 */
  private drawStatusMarks(body: Body, cx: number, top: number, w: number, h: number): void {
    const st = body.status;
    if (!st) return;
    const g = this.world;
    if (st.buffed) g.lineStyle(2, 0x44dd66, 1).strokeRect(cx - w / 2 - 2, top - 2, w + 4, h + 4);
    const y = top - 16;
    let x = cx - w / 2;
    const dot = (color: number) => {
      g.fillStyle(color, 1).fillCircle(x + 3, y, 3);
      x += 8;
    };
    if (st.burning) dot(0xff3030);
    if (st.slowed) dot(0x3fa0ff);
    if (st.stunned) dot(0xffe040);
    for (let i = 0; i < st.defenseBreakStacks; i++) {
      g.fillStyle(0xff9020, 1).fillRect(x, y - 3, 5, 6);
      x += 7;
    }
  }

  private drawHpBar(cx: number, y: number, width: number, ratio: number, color: number): void {
    const g = this.world;
    g.fillStyle(0x000000, 0.6).fillRect(cx - width / 2, y, width, 4);
    g.fillStyle(color, 1).fillRect(cx - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 4);
  }

  private drawHud(): void {
    const g = this.hud;
    const b = this.battle;
    const r = b.resources;
    g.clear();
    // 위쪽 띠와 아래 패널 배경
    g.fillStyle(HUD_STRIP, 0.88).fillRect(L.topStrip.x, L.topStrip.y, L.topStrip.w, L.topStrip.h);
    g.fillStyle(HUD_PANEL, 1).fillRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
    g.lineStyle(2, 0x6b5a3a, 1).lineBetween(0, L.panel.y, GAME_WIDTH, L.panel.y);
    this.drawBossHud(g);

    this.bar(g, L.talismanBar, r.talisman / r.maxTalisman, 0xe0b52e);
    this.bar(g, L.spiritBar, r.spirit / r.maxSpirit, 0x58a6ff);
    this.bar(g, L.shrineBar, b.shrine.hp / b.shrine.maxHp, 0x66aaff);
    const shielded = b.castle.invulnerable;
    this.bar(g, L.castleBar, b.castle.hp / b.castle.maxHp, shielded ? 0x9aa5c0 : 0xdd5555);
    this.talismanText.setText(`부적 ${Math.floor(r.talisman)}/${r.maxTalisman} (+${r.talismanPerSec}/s)`);
    this.spiritText.setText(`신력 ${Math.floor(r.spirit)}/${r.maxSpirit}`);
    this.shrineText.setText(`서낭당 ${Math.ceil(b.shrine.hp)}`);
    this.castleText.setText(shielded ? '원귀의 성 무적' : `원귀의 성 ${Math.ceil(b.castle.hp)}`);
    this.drawMinimap(g);

    const def = getStageDef(b.stage);
    this.infoText.setText(
      `${def.code} ${def.name}\n` +
        `웨이브 ${b.waveCount}  ${formatTime(b.elapsed)}  위협 ${b.threatLevel}\n` +
        `${this.enemyLine()}  아군 ${b.allies.length}/${COMBAT.maxAllies}`,
    );
    const hero = b.hero;
    const heroLine = hero.alive ? '' : `영웅 부활 ${Math.ceil(hero.respawnTimer)}초  `;
    this.noteText.setText(heroLine + this.synergyLine());
  }

  /** 미니맵: 전장 전체를 가로로 줄여 아군·적·영웅·보스 점과 현재 카메라 범위를 보여 준다 */
  private drawMinimap(g: Phaser.GameObjects.Graphics): void {
    const b = this.battle;
    const m = L.minimap;
    const len = COMBAT.battlefieldLength;
    const at = (x: number) => minimapX(x, len, m);
    g.fillStyle(0x000000, 0.65).fillRect(m.x, m.y, m.w, m.h);
    g.lineStyle(1, 0xffffff, 0.5).strokeRect(m.x, m.y, m.w, m.h);
    const mid = m.y + m.h / 2;
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
    g.lineStyle(1, 0xffffff, 0.9).strokeRect(at(this.cameras.main.scrollX), m.y + 1, camW, m.h - 2);
  }

  /** 적 수 표시. 상한에 닿으면 대기 수도 보여 준다 */
  private enemyLine(): string {
    const b = this.battle;
    const pending = b.pendingSpawns > 0 ? ` (대기 ${b.pendingSpawns})` : '';
    return `적 ${b.enemyCount}/${COMBAT.maxEnemies}${pending}`;
  }

  /** 활성 연계 이름 (켜진 것이 없으면 빈 문자열) */
  private synergyLine(): string {
    const names = this.battle.synergy.activeIds().map((id) => SYNERGY[id].name);
    return names.length > 0 ? `연계: ${names.join(', ')}` : '';
  }

  private bar(g: Phaser.GameObjects.Graphics, r: Rect, ratio: number, color: number): void {
    g.fillStyle(0x000000, 0.6).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(color, 1).fillRect(r.x, r.y, r.w * Math.max(0, Math.min(1, ratio)), r.h);
    g.lineStyle(1, 0xffffff, 0.5).strokeRect(r.x, r.y, r.w, r.h);
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
      const row = next !== null ? [this.restartButton, this.nextButton, this.mapButton] : [this.restartButton, this.mapButton];
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

/** 몸 위쪽까지의 높이(땅 기준). 데미지 숫자를 머리 위에 띄우는 데 쓴다 */
function heightOf(body: Body): number {
  if (body instanceof Base) return body.height;
  if (body instanceof Fighter) return body.stats.height * body.sizeScale;
  return HERO.height;
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
