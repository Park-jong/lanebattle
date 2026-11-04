import Phaser from 'phaser';
import { ALLIES } from '../data/allies';
import { COMBAT } from '../data/combat';
import { HERO } from '../data/hero';
import { RESOURCES } from '../data/resources';
import { STAGE_COUNT } from '../data/waves';
import { ALL_SYNERGY_IDS, Battle } from '../battle/battle';
import { isSynergyId, SYNERGY, type SynergyId } from '../data/synergy';
import type { Base, Body, Fighter } from '../battle/entities';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, HUD_FONT } from './layout';
import { colorForTags, ENEMY_COLOR, TAG_COLORS } from './palette';
import { HudButton } from './HudButton';
import { KEY_MAP, KeyInput, summonIndexOf } from './input';

const BUTTON_W = 74;
const BUTTON_H = 56;
const BUTTON_GAP = 4;
const BUTTON_Y = GAME_HEIGHT - BUTTON_H - 6;

/** 전투 상태를 도형으로 그리고 입력만 전달하는 씬 */
export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private paused = false;
  private world!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private summonButtons: HudButton[] = [];
  private gatherButton!: HudButton;
  private restartButton!: HudButton;
  private keyInput!: KeyInput;
  /** 승패가 난 뒤 지난 시간(초) */
  private resultElapsed = 0;

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
    });
    this.paused = false;
    this.resultElapsed = 0;
    this.summonButtons = [];
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

    this.createButtons();
    this.setupInput();
  }

  update(_time: number, delta: number): void {
    const playing = this.battle.result === 'playing';
    if (playing && !this.paused) {
      this.battle.step(delta / 1000, { moveDir: this.keyInput.moveDir() });
    }
    if (!playing) this.resultElapsed += delta / 1000;
    this.followHero();
    this.drawWorld();
    this.drawHud();
    this.updateButtons();
    this.updateOverlay();
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

  private restart(): void {
    if (this.restartAllowed) this.scene.restart();
  }

  private onKeyDown(code: string): void {
    if (this.battle.result !== 'playing') {
      if (code === KEY_MAP.gatherOrRestart) this.restart();
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
    const gx = 6 + ALLIES.length * (BUTTON_W + BUTTON_GAP);
    this.restartButton = new HudButton(
      this, GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2 + 70, 160, 44, 0x3a6b4a,
      () => this.restart(),
    );
    this.restartButton.setTexts('다시 하기', '');
    this.restartButton.setVisible(false);
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
    const lift = f.stats.flying ? 40 : 0;
    const top = GROUND_Y - h - lift;
    g.fillStyle(color, 1).fillRect(f.x - w / 2, top, w, h);
    if (f.stats.elite) g.lineStyle(3, 0xffd166, 1).strokeRect(f.x - w / 2, top, w, h);
    this.drawHpBar(f.x, top - 6, w + 6, f.hp / f.maxHp, f.team === 'ally' ? 0x66dd66 : 0xdd5555);
    this.drawStatusMarks(f, f.x, top, w, h);
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
    this.bar(g, 8, 8, 200, 12, r.talisman / r.maxTalisman, 0xe0b52e);
    this.bar(g, 8, 24, 200, 12, r.spirit / r.maxSpirit, 0x58a6ff);
    this.bar(g, 330, 8, 180, 14, b.shrine.hp / b.shrine.maxHp, 0x66aaff);
    this.bar(g, GAME_WIDTH - 190, 8, 180, 14, b.castle.hp / b.castle.maxHp, 0xdd5555);

    const hero = b.hero;
    const heroLine = hero.alive ? '' : `  영웅 부활 ${Math.ceil(hero.respawnTimer)}초`;
    const sec = Math.floor(b.elapsed);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    this.hudText.setPosition(8, 42);
    this.hudText.setText(
      `부적 ${Math.floor(r.talisman)}/${r.maxTalisman} (+${r.talismanPerSec}/s)  신력 ${Math.floor(r.spirit)}/${r.maxSpirit}\n` +
        `위협 ${b.threatLevel}  시간 ${mm}:${ss}  아군 ${b.allies.length}/${COMBAT.maxAllies}  웨이브 ${b.waveCount}${heroLine}` +
        this.synergyLine(),
    );
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
    this.restartButton.setVisible(ended);
    if (ended) this.restartButton.setState(0, this.restartAllowed);
    const hint = this.restartAllowed ? '\nR 또는 다시 하기 버튼으로 재시작' : '';
    if (result === 'victory') {
      this.overlay.setText(`승리!${hint}`).setVisible(true);
    } else if (result === 'defeat') {
      this.overlay.setText(`패배...${hint}`).setVisible(true);
    } else if (this.paused) {
      this.overlay.setText('일시정지\nEsc 또는 P로 계속').setVisible(true);
    } else {
      this.overlay.setVisible(false);
    }
  }
}

/** URL ?synergy=all 이면 모든 연계, 쉼표로 ID를 나열하면 그 연계만. 기본은 꺼짐 */
function synergiesFromUrl(): SynergyId[] {
  const value = new URLSearchParams(window.location.search).get('synergy');
  if (!value) return [];
  if (value === 'all') return [...ALL_SYNERGY_IDS];
  return value.split(',').filter(isSynergyId);
}
