import Phaser from 'phaser';
import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { RESOURCES } from '../data/resources';
import { SKILL_EFFECTS, SKILLS, type SkillId } from '../data/skills';
import { STAGE_COUNT } from '../data/waves';
import { STAR_RULES } from '../data/rewards';
import { getStageDef } from '../battle/stage';
import { ALL_SYNERGY_IDS, Battle } from '../battle/battle';
import { isSynergyId, SYNERGY, type SynergyId } from '../data/synergy';
import type { Base, Body, Fighter } from '../battle/entities';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, HUD_FONT } from './layout';
import { colorForTags, ENEMY_COLOR, TAG_COLORS } from './palette';
import { HudButton } from './HudButton';
import { KEY_MAP, KeyInput, skillIndexOf, summonIndexOf } from './input';

const BUTTON_W = 74;
const BUTTON_H = 56;
const BUTTON_GAP = 4;
const BUTTON_Y = GAME_HEIGHT - BUTTON_H - 6;
const SKILL_W = 110;
const SKILL_H = 40;
const SKILL_Y = BUTTON_Y - SKILL_H - 6;
/** 보스 등장 연출 길이(초): 화면이 어두워지고 이름이 나타났다 사라진다 */
const BOSS_INTRO_SECONDS = 1.6;
/** 보스 체력바 배치 (위쪽 가운데, 기본 HUD 글자 아래) */
const BOSS_BAR_W = 400;
const BOSS_BAR_X = (GAME_WIDTH - BOSS_BAR_W) / 2;
const BOSS_NAME_Y = 94;
const BOSS_BAR_Y = 116;
const BOSS_CHIP_Y = 138;
/** 일반 비행 유닛이 떠 있는 높이 */
const FLY_LIFT = 40;
/** 스킬 이펙트가 퍼지는 시간(초) */
const CAST_FX_SECONDS = 0.3;
/** 결과 패널 (HUD 버튼보다 아래, 결과 글자보다 아래에 그린다) */
const RESULT_PANEL = { x: 230, y: 60, w: 500, h: 340 };
const RESULT_BUTTON_Y = GAME_HEIGHT / 2 + 70;
const RESULT_BUTTON_W = 160;
const RESULT_BUTTON_GAP = 20;

interface CastFx {
  id: SkillId;
  x: number;
  facing: 1 | -1;
  age: number;
}

/** 전투 상태를 도형으로 그리고 입력만 전달하는 씬 */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private paused = false;
  private world!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private summonButtons: HudButton[] = [];
  private skillButtons: HudButton[] = [];
  private castFx: CastFx[] = [];
  private gatherButton!: HudButton;
  private restartButton!: HudButton;
  private nextButton!: HudButton;
  private resultPanel!: Phaser.GameObjects.Graphics;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultStars!: Phaser.GameObjects.Text;
  private resultBody!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
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

  constructor() {
    super('Battle');
  }

  /** 스테이지 번호: 씬 데이터 또는 URL ?stage=N (기본 0) */
  init(data: { stage?: number }): void {
    const fromUrl = Number(new URLSearchParams(window.location.search).get('stage'));
    const stage = data.stage ?? (Number.isFinite(fromUrl) ? fromUrl : 0);
    this.battle = new Battle({
      stage: Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(stage))),
      synergies: synergiesFromUrl(),
      bossAt: bossAtFromUrl(),
    });
    this.bossIntroLeft = 0;
    this.bossSeen = false;
    this.bossChips = [];
    this.paused = false;
    this.resultElapsed = 0;
    this.summonButtons = [];
    this.skillButtons = [];
    this.castFx = [];
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, COMBAT.battlefieldLength, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x2a3350);
    this.world = this.add.graphics();
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.hudText = this.add
      .text(0, 0, '', { fontFamily: HUD_FONT, fontSize: '13px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(95);
    this.overlay = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', {
        fontFamily: HUD_FONT, fontSize: '40px', color: '#ffffff', align: 'center',
        backgroundColor: '#000000aa', padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.stageText = this.add
      .text(330, 26, '', { fontFamily: HUD_FONT, fontSize: '12px', color: '#cfd6ee' })
      .setScrollFactor(0)
      .setDepth(95);
    const def = getStageDef(this.battle.stage);
    this.stageText.setText(`스테이지 ${def.code} ${def.name}`);
    this.createBossUi();
    this.createResultUi();
    this.createButtons();
    this.setupInput();
  }

  /** 보스 이름·상태·연출 글자와 성 무적 표시 (처음엔 숨김) */
  private createBossUi(): void {
    const style = { fontFamily: HUD_FONT, color: '#ffffff' };
    this.bossNameText = this.add
      .text(GAME_WIDTH / 2, BOSS_NAME_Y, '', { ...style, fontSize: '16px', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(95).setVisible(false);
    this.bossStateText = this.add
      .text(BOSS_BAR_X + BOSS_BAR_W + 8, BOSS_BAR_Y - 1, '', { ...style, fontSize: '13px' })
      .setScrollFactor(0).setDepth(95).setVisible(false);
    this.bossIntroText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '', { ...style, fontSize: '64px', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(150).setVisible(false);
    this.castleShieldText = this.add
      .text(0, 0, '무적', { ...style, fontSize: '16px', fontStyle: 'bold', backgroundColor: '#3a6fd4cc', padding: { x: 6, y: 2 } })
      .setOrigin(0.5, 1).setDepth(60).setVisible(false);
  }

  /** 결과 화면 패널과 글자 (처음엔 숨김) */
  private createResultUi(): void {
    const { x, y, w, h } = RESULT_PANEL;
    const cx = x + w / 2;
    this.resultPanel = this.add.graphics().setScrollFactor(0).setDepth(98).setVisible(false);
    this.resultPanel.fillStyle(0x10142a, 0.92).fillRect(x, y, w, h);
    this.resultPanel.lineStyle(2, 0xffffff, 0.6).strokeRect(x, y, w, h);
    const style = { fontFamily: HUD_FONT, color: '#ffffff' };
    this.resultTitle = this.add
      .text(cx, y + 14, '', { ...style, fontSize: '34px', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(200).setVisible(false);
    this.resultStars = this.add
      .text(cx, y + 62, '', { ...style, fontSize: '40px', color: '#ffd84a' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(200).setVisible(false);
    this.resultBody = this.add
      .text(x + 40, y + 120, '', { ...style, fontSize: '15px', lineSpacing: 6 })
      .setScrollFactor(0).setDepth(200).setVisible(false);
  }

  update(_time: number, delta: number): void {
    const playing = this.battle.result === 'playing';
    if (playing && !this.paused) {
      this.battle.step(delta / 1000, { moveDir: this.keyInput.moveDir() });
      this.bossIntroLeft = Math.max(0, this.bossIntroLeft - delta / 1000);
    }
    this.watchBossAppearance();
    if (!playing) this.resultElapsed += delta / 1000;
    this.updateCastFx(delta / 1000, playing && !this.paused);
    this.followHero();
    this.drawWorld();
    this.drawHud();
    this.updateButtons();
    this.updateOverlay();
  }

  // ----- 보스 -----

  /** 보스가 처음 등장한 프레임에 연출을 시작하고 약점·저항 칩을 만든다 */
  private watchBossAppearance(): void {
    const enc = this.battle.encounter;
    if (!enc || this.bossSeen || enc.state === 'pending') return;
    this.bossSeen = true;
    this.bossIntroLeft = BOSS_INTRO_SECONDS;
    this.bossIntroText.setText(enc.def.name);
    this.bossNameText.setText(enc.def.name);
    const chips: [string, string, string][] = [
      ...enc.def.weaknessLabels.map((l): [string, string, string] => [`약점: ${l}`, '#1a1a1a', '#ffd84a']),
      ...enc.def.resistanceLabels.map((l): [string, string, string] => [`저항: ${l}`, '#1a1a1a', '#a0a0a0']),
    ];
    this.bossChips = chips.map(([label, color, bg]) =>
      this.add
        .text(0, BOSS_CHIP_Y, label, { fontFamily: HUD_FONT, fontSize: '13px', color, backgroundColor: bg, padding: { x: 6, y: 2 } })
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
    this.bar(g, BOSS_BAR_X, BOSS_BAR_Y, BOSS_BAR_W, 16, boss.hp / boss.maxHp, 0xc23b3b);
    this.bossStateText.setText(enc.statusLabel);
  }

  // ----- 입력 -----

  private setupInput(): void {
    this.keyInput = new KeyInput(window, (code) => this.onKeyDown(code));
    this.keyInput.attach();
    // 씬이 끝나면 리스너를 해제한다
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
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

  private onKeyDown(code: string): void {
    if (this.battle.result !== 'playing') {
      if (code === KEY_MAP.gatherOrRestart) this.restart();
      else if (code === KEY_MAP.nextStage) this.goNextStage();
      return;
    }
    if ((KEY_MAP.pause as readonly string[]).includes(code)) {
      this.paused = !this.paused;
      return;
    }
    if (this.paused) return;
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
    if (index >= 0) this.battle.summon(index);
  }

  // ----- 버튼 -----

  private createButtons(): void {
    ALLIES.forEach((def, i) => {
      const color = colorForTags(def.tags);
      const btn = new HudButton(
        this, 6 + i * (BUTTON_W + BUTTON_GAP), BUTTON_Y, BUTTON_W, BUTTON_H, color,
        () => {
          if (!this.paused) this.battle.summon(i);
        },
      );
      btn.setTexts(`${(i + 1) % 10} ${def.name}`, `${def.cost}`);
      this.summonButtons.push(btn);
    });
    SKILLS.forEach((def, i) => {
      const btn = new HudButton(
        this, 6 + i * (SKILL_W + BUTTON_GAP), SKILL_Y, SKILL_W, SKILL_H, 0x4a4a6b,
        () => {
          if (!this.paused) this.battle.castSkill(def.id);
        },
      );
      btn.setTexts(`${KEY_MAP.skills[i].slice(3)} ${def.name}`, `신력 ${def.spiritCost}`);
      this.skillButtons.push(btn);
    });
    const gx = 6 + ALLIES.length * (BUTTON_W + BUTTON_GAP);
    this.restartButton = new HudButton(
      this, GAME_WIDTH / 2 - 80, RESULT_BUTTON_Y, RESULT_BUTTON_W, 44, 0x3a6b4a,
      () => this.restart(),
    );
    this.restartButton.setTexts(`${KEY_MAP.gatherOrRestart.slice(3)} 다시 하기`, '');
    this.restartButton.setVisible(false);
    this.nextButton = new HudButton(
      this, GAME_WIDTH / 2 + RESULT_BUTTON_GAP / 2, RESULT_BUTTON_Y, RESULT_BUTTON_W, 44, 0x3a5a8b,
      () => this.goNextStage(),
    );
    this.nextButton.setTexts(`${KEY_MAP.nextStage.slice(3)} 다음 스테이지`, '');
    this.nextButton.setVisible(false);
    this.gatherButton = new HudButton(
      this, gx, BUTTON_Y, GAME_WIDTH - gx - 6, BUTTON_H, 0x6b5a3a,
      () => {
        if (!this.paused) this.battle.gather();
      },
    );
  }

  private updateButtons(): void {
    const b = this.battle;
    ALLIES.forEach((def, i) => {
      const cd = b.summonCooldown(i);
      const enabled = cd <= 0 && b.resources.talisman >= def.cost && b.allies.length < COMBAT.maxAllies;
      const sub = cd > 0 ? `${cd.toFixed(1)}s` : `${def.cost}`;
      this.summonButtons[i].setTexts(`${(i + 1) % 10} ${def.name}`, sub);
      this.summonButtons[i].setState(cd / def.cooldown, enabled);
    });
    SKILLS.forEach((def, i) => {
      const cd = b.skillCooldown(def.id);
      const enabled =
        b.result === 'playing' && cd <= 0 && b.hero.alive && !b.hero.status?.stunned && b.resources.spirit >= def.spiritCost;
      const sub = cd > 0 ? `${cd.toFixed(1)}s` : `신력 ${def.spiritCost}`;
      this.skillButtons[i].setTexts(`${KEY_MAP.skills[i].slice(3)} ${def.name}`, sub);
      this.skillButtons[i].setState(cd / def.cooldown, enabled);
    });
    const cost = b.resources.nextGatherCost;
    const r = b.resources;
    this.gatherButton.setTexts(
      `R 기운 모으기 ${r.gatherLevel}/${RESOURCES.gather.costs.length}`,
      cost === null ? '최대' : `${cost}`,
    );
    this.gatherButton.setState(0, cost !== null && r.talisman >= cost);
  }

  // ----- 그리기 -----

  private followHero(): void {
    const cam = this.cameras.main;
    const target = this.battle.hero.x - GAME_WIDTH / 2;
    cam.scrollX = Math.max(0, Math.min(COMBAT.battlefieldLength - GAME_WIDTH, target));
  }

  /** 시전 기록을 받아 이펙트를 만들고, 일시정지 중이 아니면 나이를 먹인다 */
  private updateCastFx(dt: number, advance: boolean): void {
    for (const e of this.battle.drainCastEvents()) this.castFx.push({ ...e, age: 0 });
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
        const r = SKILL_EFFECTS.fanWind.range * t;
        const start = fx.facing > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.fillStyle(TAG_COLORS.wind, alpha).slice(fx.x, GROUND_Y, r, start, start + Math.PI, false).fillPath();
      } else {
        const full = fx.id === 'blessing' ? SKILL_EFFECTS.blessing.radius : SKILL_EFFECTS.bladeDance.radius;
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
      g.fillStyle(TAG_COLORS.hero, 1).fillRect(h.x - w / 2, GROUND_Y - ht, w, ht);
      g.fillStyle(0xd9473b, 1).fillRect(h.x - w / 2, GROUND_Y - ht, w, 8);
      this.drawHpBar(h.x, GROUND_Y - ht - 8, w + 8, h.hp / h.maxHp, 0x66dd66);
      this.drawStatusMarks(h, h.x, GROUND_Y - ht, w, ht);
    }

    this.drawCastFx();

    // 투사체
    for (const p of b.projectiles) {
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
    g.fillStyle(color, 1).fillRect(f.x - w / 2, top, w, h);
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
    this.drawBossHud(g);
    this.bar(g, 8, 8, 200, 12, r.talisman / r.maxTalisman, 0xe0b52e);
    this.bar(g, 8, 24, 200, 12, r.spirit / r.maxSpirit, 0x58a6ff);
    this.bar(g, 330, 8, 180, 14, b.shrine.hp / b.shrine.maxHp, 0x66aaff);
    this.bar(g, GAME_WIDTH - 190, 8, 180, 14, b.castle.hp / b.castle.maxHp, b.castle.invulnerable ? 0x9aa5c0 : 0xdd5555);

    const hero = b.hero;
    const heroLine = hero.alive ? '' : `  영웅 부활 ${Math.ceil(hero.respawnTimer)}초`;
    const sec = Math.floor(b.elapsed);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    this.hudText.setPosition(8, 42);
    this.hudText.setText(
      `부적 ${Math.floor(r.talisman)}/${r.maxTalisman} (+${r.talismanPerSec}/s)  신력 ${Math.floor(r.spirit)}/${r.maxSpirit}\n` +
        `위협 ${b.threatLevel}  시간 ${mm}:${ss}  아군 ${b.allies.length}/${COMBAT.maxAllies}  웨이브 ${b.waveCount}  ${this.enemyLine()}${heroLine}` +
        this.synergyLine(),
    );
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
    return names.length > 0 ? `\n연계: ${names.join(', ')}` : '';
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, color: number): void {
    g.fillStyle(0x000000, 0.6).fillRect(x, y, w, h);
    g.fillStyle(color, 1).fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
    g.lineStyle(1, 0xffffff, 0.5).strokeRect(x, y, w, h);
  }

  private updateOverlay(): void {
    const result = this.battle.result;
    const ended = result !== 'playing';
    const next = this.nextStage;
    this.restartButton.setVisible(ended);
    this.nextButton.setVisible(ended && next !== null);
    if (ended) {
      // 다음 스테이지 버튼이 있으면 둘을 나란히, 없으면 다시 하기를 가운데에
      const total = next !== null ? RESULT_BUTTON_W * 2 + RESULT_BUTTON_GAP : RESULT_BUTTON_W;
      this.restartButton.moveTo((GAME_WIDTH - total) / 2, RESULT_BUTTON_Y);
      this.restartButton.setState(0, this.restartAllowed);
      this.nextButton.setState(0, this.restartAllowed);
    }
    this.resultPanel.setVisible(ended);
    this.resultTitle.setVisible(ended);
    this.resultStars.setVisible(ended);
    this.resultBody.setVisible(ended);
    if (ended) {
      this.drawResultTexts();
    } else if (this.paused) {
      this.overlay.setText('일시정지\nEsc 또는 P로 계속').setVisible(true);
      return;
    }
    this.overlay.setVisible(false);
  }

  /** 결과 패널 글자: 제목, 별, 걸린 시간·체력, 별 조건, 보상 */
  private drawResultTexts(): void {
    const res = this.battle.stageResult();
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

/** URL ?bossAt=초 로 보스 등장 시각을 바꾼다 (없거나 잘못된 값이면 기본 60초) */
function bossAtFromUrl(): number | undefined {
  const value = new URLSearchParams(window.location.search).get('bossAt');
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
