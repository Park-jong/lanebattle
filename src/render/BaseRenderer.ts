import Phaser from 'phaser';
import type { Base } from '../battle/entities';
import { baseAppearance, baseDamagePhase, baseVisualCenter, type BaseAppearance, type DamagePhase } from '../data/baseAppearance';
import { HUD_FONT } from '../scenes/layout';
import type { BattlefieldProjection } from './battlefield';

const FIVE = [0xe9c76d, 0x5d9db9, 0xc56149, 0xe8e0c4, 0x293941];

/** 장·관문별 기지 외형. 구조물은 파손 단계가 바뀔 때만 다시 그리고 불빛만 갱신한다. */
export class BaseRenderer {
  readonly appearance: BaseAppearance;
  readonly centerX: number;
  readonly groundY: number;
  readonly top: number;
  private readonly structure: Phaser.GameObjects.Graphics;
  private readonly effects: Phaser.GameObjects.Graphics;
  private readonly nameplate: Phaser.GameObjects.Text;
  private phase: DamagePhase = 0;
  private shielded = false;
  private previousHp: number;
  private clock = 0;
  private hitLeft = 0;

  constructor(scene: Phaser.Scene, readonly base: Base, field: BattlefieldProjection, stage: number) {
    this.appearance = baseAppearance(stage, base.team);
    this.centerX = baseVisualCenter(base.x, this.appearance.width);
    this.groundY = field.ground(base);
    this.top = this.groundY - this.appearance.height;
    this.previousHp = base.hp;
    // 출입하는 소환 개체가 큰 정면 벽에 가려지지 않게 건축물은 뒤에 둔다.
    this.structure = scene.add.graphics().setPosition(this.centerX, this.groundY).setDepth(field.depth(base) - 4);
    this.effects = scene.add.graphics().setPosition(this.centerX, this.groundY).setDepth(field.depth(base) + 0.1);
    this.nameplate = scene.add.text(this.centerX, this.top - 12, this.appearance.name, {
      fontFamily: HUD_FONT, fontSize: '13px', fontStyle: 'bold', color: base.team === 'ally' ? '#f6d58b' : '#e2c5ec',
      stroke: '#10201b', strokeThickness: 3, backgroundColor: '#16231dd9', padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 1).setDepth(60);
    this.redraw();
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.base.hp < this.previousHp) this.hitLeft = 0.16;
    this.previousHp = this.base.hp;
    this.hitLeft = Math.max(0, this.hitLeft - dt);
    const next = baseDamagePhase(this.base.hp, this.base.maxHp);
    if (next !== this.phase || this.shielded !== this.base.invulnerable) {
      this.phase = next; this.shielded = this.base.invulnerable; this.redraw();
    }
    this.structure.setX(this.centerX + Math.sin(this.clock * 70) * this.hitLeft * 12);
    this.nameplate.setAlpha(this.phase === 3 ? 0.55 : 1);
    this.drawEffects();
  }

  private polygon(color: number, points: number[][], alpha = 1): void {
    this.structure.fillStyle(color, alpha).fillPoints(points.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
  }

  private stroke(color: number, points: number[][], width = 1.5, alpha = 1): void {
    this.structure.lineStyle(width, color, alpha).strokePoints(points.map(([x, y]) => new Phaser.Math.Vector2(x, y)), false);
  }

  private redraw(): void {
    this.structure.clear();
    if (this.phase === 3) { this.rubble(); return; }
    if (this.appearance.kind === 'gutdang') this.gutdang();
    else if (this.appearance.kind === 'ghostTree') this.ghostTree();
    else if (this.appearance.kind === 'serpentGate') this.serpentGate();
    else this.gate(this.appearance.kind === 'ruinedShrine');
    if (this.phase > 0) this.damage();
  }

  private foundation(width: number, color = 0x73756a): void {
    const g = this.structure, w = width / 2;
    this.polygon(0x343b36, [[-w - 5, -4], [w + 7, -4], [w + 14, 8], [-w - 12, 8]]);
    this.polygon(color, [[-w, -12], [w - 4, -12], [w + 10, -4], [-w - 8, -4]]);
    g.fillStyle(0x4c544d).fillRect(-w - 8, -4, width + 18, 7);
    this.stroke(0xa6aa90, [[-w + 3, -11], [w - 5, -11], [w + 7, -5]], 1, 0.7);
    for (let i = 0; i < 5; i++) {
      const x = -w + i * width / 5;
      this.stroke(0x343e38, [[x, -4], [x + 3, 3]], 1);
    }
  }

  /** 두 겹의 지붕 면·기왓골·용마루·들린 처마를 묶어 위쪽 면이 보이게 그린다. */
  private roof(y: number, width: number, color: number, damaged = false): void {
    const g = this.structure, half = width / 2, ridge = y - 30;
    const right = this.appearance.variant % 2 ? 9 : 13;
    this.polygon(0x142626, [[-half - 5, y + 4], [half + right, y + 4], [half + 7, y + 13], [-half, y + 13]]);
    this.polygon(color, [[-half - 7, y - 5], [-half + 12, y - 2], [-width * 0.25, ridge],
      [width * 0.23, ridge], [half - 12, y - 2], [half + 8, y - 7], [half + 3, y + 6], [-half - 2, y + 6]]);
    this.polygon(0xa0b6a0, [[-width * 0.25, ridge], [-width * 0.23 + right, ridge - 8],
      [width * 0.23 + right, ridge - 8], [width * 0.23, ridge]], 0.3);
    for (let i = 0; i <= 16; i++) {
      const bx = -half + 4 + i * (width - 8) / 16;
      const tx = bx * 0.47;
      if (damaged && i > 11 && i < 15) continue;
      this.stroke(0x162d2e, [[tx, ridge + 1], [bx, y + 4]], 1.5, 0.75);
      g.fillStyle(0x9ba88c, 0.65).fillEllipse(bx, y + 6, 5, 3);
    }
    this.stroke(0xc4b27b, [[-half - 7, y - 5], [-half + 10, y + 5], [half - 10, y + 5], [half + 8, y - 7]], 2);
    g.lineStyle(3, 0x667c69, 1).lineBetween(-width * 0.25 - 6, ridge, width * 0.23 + 6, ridge);
    for (const side of [-1, 1]) {
      this.stroke(0xb99e60, [[side * width * 0.23, ridge], [side * (width * 0.23 + 8), ridge - 4],
        [side * (width * 0.23 + 11), ridge - 1]], 2);
    }
  }

  private talisman(x: number, y: number, color: number, torn = false): void {
    const g = this.structure;
    this.polygon(color, [[x - 4, y], [x + 4, y], [x + 4, y + (torn ? 11 : 20)], [x, y + (torn ? 8 : 18)], [x - 4, y + 20]]);
    g.lineStyle(1, 0xa24c37, 1).lineBetween(x, y + 3, x, y + 13);
    g.lineBetween(x - 2, y + 6, x + 2, y + 6).lineBetween(x - 2, y + 10, x + 2, y + 13);
  }

  private lantern(x: number, y: number, enemy = false): void {
    const g = this.structure;
    g.lineStyle(1, 0x9b855a, 1).lineBetween(x, y - 9, x, y);
    g.fillStyle(enemy ? 0x7d5c83 : 0xc79d56).fillRoundedRect(x - 6, y, 12, 18, 3);
    g.fillStyle(enemy ? this.appearance.glow : 0xffe4a0, this.phase >= 2 ? 0.4 : 0.9).fillRect(x - 3, y + 2, 6, 14);
    g.lineStyle(1, 0x4c3d2e, 0.7).lineBetween(x - 5, y + 6, x + 5, y + 6).lineBetween(x - 5, y + 12, x + 5, y + 12);
    g.fillStyle(0x514b39).fillRect(x - 5, y - 2, 10, 3).fillRect(x - 5, y + 17, 10, 3);
  }

  private flag(x: number, y: number, color: number, reverse = false): void {
    const direction = reverse ? -1 : 1;
    this.stroke(0xbbaa80, [[x, -8], [x, y - 4]], 2);
    this.polygon(color, [[x, y], [x + direction * 19, y + 3], [x + direction * 16, y + 25],
      [x + direction * 8, y + (this.phase > 1 ? 16 : 29)], [x, y + 24]]);
    this.stroke(0xe7dba9, [[x + direction * 4, y + 4], [x + direction * 4, y + 21]], 1, 0.6);
  }

  private gutdang(): void {
    const g = this.structure, a = this.appearance;
    this.foundation(156, 0x8c8c75);
    // 낮은 담장과 석등이 본채·앞마당을 하나의 큰 실루엣으로 묶는다.
    for (const side of [-1, 1]) {
      g.fillStyle(0x686e59).fillRect(side < 0 ? -88 : 57, -43, 32, 31);
      g.fillStyle(0x41564c).fillRect(side < 0 ? -91 : 55, -46, 37, 6);
      this.stroke(0xa4a68c, [[side * 58, -33], [side * 87, -33]], 1, 0.65);
    }
    this.polygon(0x514c39, [[61, -111], [75, -121], [75, -17], [61, -9]]);
    g.fillStyle(0x96784e).fillRect(-61, -112, 122, 99);
    g.fillStyle(0xd1c08b).fillRect(-50, -103, 99, 72);
    g.fillStyle(0x36493a).fillRect(-21, -98, 42, 86);
    g.fillStyle(0xffd57b, this.phase >= 2 ? 0.12 : 0.45).fillRect(-17, -91, 34, 77);
    for (const x of [-58, -27, 27, 58]) {
      g.fillStyle(0x684a34).fillRect(x - 3, -112, 6, 101);
      g.fillStyle(0xb98b54).fillRect(x - 1, -108, 2, 92);
    }
    for (const x of [-42, 42]) {
      g.fillStyle(0xe8cc87, this.phase >= 2 ? 0.45 : 0.9).fillRect(x - 9, -89, 18, 31);
      for (const dx of [-4, 2]) g.lineStyle(1, 0x7e6240, 1).lineBetween(x + dx, -90, x + dx, -57);
      for (const yy of [-80, -69]) g.lineBetween(x - 9, yy, x + 9, yy);
    }
    this.roof(-113, 166, a.roof, this.phase > 0);
    g.fillStyle(0x9b4c35).fillRect(-59, -103, 118, 6);
    for (let i = 0; i < 9; i++) g.fillStyle(i % 2 ? 0xc1a560 : 0x427565).fillCircle(-51 + i * 13, -100, 2);
    // 금줄과 다섯 색 천은 큰 지붕 아래에서 읽히도록 배치한다.
    this.stroke(0xd7bc78, [[-67, -94], [-28, -88], [30, -88], [67, -94]], 1.5);
    for (let i = 0; i < 5; i++) {
      this.polygon(FIVE[(i + a.variant) % 5], [[-39 + i * 19, -88], [-31 + i * 19, -88], [-32 + i * 19, -70], [-38 + i * 19, -72]]);
    }
    this.talisman(-22, -66, 0xf1d78e, this.phase > 0);
    this.talisman(23, -61, 0xf1d78e, this.phase > 1);
    this.lantern(-65, -76); this.lantern(66, -76);
    for (let i = 0; i < 3; i++) {
      this.flag(-85 + i * 6, -125 - i * 8, FIVE[(i + a.chapter) % 5]);
    }
    if (a.variant >= 2) this.flag(84, -137, FIVE[a.variant], true);
    if (a.boss) this.flag(91, -151, 0xd9b757, true);
    g.fillStyle(0x9c9679).fillRect(-26, -9, 52, 5).fillRect(-33, -4, 66, 5).fillRect(-39, 1, 78, 5);
    // 큰 북과 향로로 무당의 굿당임을 표시한다.
    g.fillStyle(0x523d2e).fillRect(-73, -26, 5, 23).fillRect(-53, -26, 5, 23);
    g.fillStyle(0xa44f36).fillEllipse(-61, -31, 28, 33);
    g.fillStyle(0xddc590).fillEllipse(-63, -31, 22, 29);
    g.lineStyle(1.5, 0x7e5b36, 1).strokeEllipse(-63, -31, 22, 29);
    g.fillStyle(0x446a68).fillCircle(-63, -34, 5).fillCircle(-63, -28, 5);
    g.fillStyle(0xac503b).fillCircle(-63, -33, 3);
    g.fillStyle(0x8c8055).fillRoundedRect(45, -21, 20, 11, 4).fillRect(48, -11, 3, 7).fillRect(59, -11, 3, 7);
    for (const dx of [49, 55, 61]) this.stroke(0x8a6743, [[dx, -21], [dx + 1, -33]], 1);
  }

  private gate(shrine: boolean): void {
    const g = this.structure, a = this.appearance, boss = a.boss;
    this.foundation(boss ? 188 : 176, 0x686578);
    const wall = shrine ? 0x5c4f59 : a.kind === 'netherGate' ? 0x51455f : 0x59605a;
    for (const side of [-1, 1]) {
      const sx = side < 0 ? -91 : 56;
      g.fillStyle(wall).fillRect(sx, -94, 36, 82);
      this.polygon(0x303640, [[sx + 30, -94], [sx + 42, -102], [sx + 42, -18], [sx + 30, -12]]);
      for (let yy = -88; yy < -17; yy += 17) {
        g.lineStyle(1, 0x292d34, 0.8).lineBetween(sx + 1, yy, sx + 34, yy);
        g.lineBetween(sx + 12 + (yy % 2 ? 6 : 0), yy, sx + 12 + (yy % 2 ? 6 : 0), yy + 17);
      }
      if (a.kind === 'jangseungGate') this.jangseung(side * 79, -83, boss);
      else {
        g.fillStyle(0x29303a).fillRect(sx - 2, -100, 40, 8);
        this.lantern(side * 78, -63, true);
      }
    }
    g.fillStyle(wall).fillRect(-57, -123, 114, 112);
    this.polygon(0x32333e, [[57, -123], [71, -134], [71, -21], [57, -11]]);
    g.fillStyle(0x18212a).fillRoundedRect(-40, -108, 80, 99, { tl: 25, tr: 25, bl: 0, br: 0 });
    g.fillStyle(a.glow, this.phase >= 2 ? 0.08 : 0.22).fillRoundedRect(-31, -97, 62, 84, { tl: 23, tr: 23, bl: 0, br: 0 });
    for (const side of [-1, 1]) {
      const doorX = side < 0 ? -37 : 4;
      if (this.phase === 2 && side > 0) continue;
      g.fillStyle(shrine ? 0x57414c : 0x41434c).fillRect(doorX, -88, 33, 77);
      g.lineStyle(1, 0x1a232b, 0.9);
      for (let i = 1; i < 4; i++) g.lineBetween(doorX + i * 8, -87, doorX + i * 8, -12);
      g.fillStyle(0x8b7b62).fillRect(doorX - 1, -67, 34, 4).fillRect(doorX - 1, -30, 34, 4);
    }
    this.roof(-126, boss ? 182 : 168, a.roof, this.phase > 0);
    if (a.kind === 'netherGate') this.roof(-91, 192, a.roof, this.phase > 1);
    if (shrine) {
      this.talisman(-48, -93, 0xc4b7a3, this.phase > 0);
      this.talisman(47, -83, 0xc4b7a3, true);
      // 낡은 깃발·우물·항아리로 장터의 각 관문을 구분한다.
      if (a.variant % 2 === 0) {
        g.fillStyle(0x77727a).fillEllipse(-70, -17, 33, 15);
        g.fillStyle(0x1d2531).fillEllipse(-70, -20, 26, 10);
      } else {
        g.fillStyle(0x67524f).fillEllipse(-70, -23, 23, 29);
        g.fillStyle(0x262831).fillEllipse(-70, -35, 17, 6);
      }
    }
    this.demonFace(0, shrine ? -99 : a.kind === 'netherGate' ? -109 : -98, boss ? 1.05 : 0.85);
    const sealY = a.kind === 'netherGate' ? -61 : -58;
    this.talisman(-8, sealY, 0xc4af84, this.phase > 0);
    this.talisman(9, sealY + 8, 0xc4af84, this.phase > 1);
    for (let i = 0; i <= a.variant; i++) {
      const x = -50 + i * 24;
      this.stroke(a.accent, [[x, -112], [x + 1, -105], [x - 2, -101]], 1.5, 0.7);
    }
    if (boss) {
      this.flag(-95, -154, 0x75506f);
      this.flag(95, -154, 0x75506f, true);
    }
    for (let i = 0; i < (a.kind === 'netherGate' ? 4 : 2); i++) {
      g.fillStyle(i % 2 ? 0x656172 : 0x7b7381).fillRect(-34 - i * 6, -10 + i * 4, 68 + i * 12, 4);
    }
  }

  private jangseung(x: number, y: number, iron: boolean): void {
    const g = this.structure;
    g.fillStyle(iron ? 0x7d8580 : 0x7b7158).fillRoundedRect(x - 13, y - 15, 26, 84, 3);
    this.polygon(iron ? 0xb0b6a0 : 0xa39469, [[x - 17, y - 12], [x, y - 25], [x + 17, y - 12]]);
    g.fillStyle(0x283334).fillTriangle(x - 9, y + 1, x - 1, y + 5, x - 10, y + 8);
    g.fillTriangle(x + 9, y + 1, x + 1, y + 5, x + 10, y + 8);
    this.stroke(0x303a33, [[x - 8, y + 23], [x + 8, y + 23]], 3);
    for (let i = 0; i < 4; i++) this.stroke(0xc0b487, [[x - 7 + i * 5, y + 20], [x - 7 + i * 5, y + 27]], 1);
    if (iron) for (let i = 0; i < 3; i++) g.fillStyle(0x444e4d).fillRect(x - 13, y + 37 + i * 12, 26, 4);
  }

  private demonFace(x: number, y: number, scale: number): void {
    const g = this.structure, s = scale;
    this.polygon(0x8a7981, [[x - 25 * s, y], [x - 17 * s, y - 16 * s], [x + 17 * s, y - 16 * s],
      [x + 25 * s, y], [x + 14 * s, y + 19 * s], [x - 14 * s, y + 19 * s]]);
    this.polygon(0xb49d8c, [[x - 20 * s, y - 8 * s], [x - 29 * s, y - 23 * s], [x - 10 * s, y - 14 * s]]);
    this.polygon(0xb49d8c, [[x + 20 * s, y - 8 * s], [x + 29 * s, y - 23 * s], [x + 10 * s, y - 14 * s]]);
    g.fillStyle(0x222732).fillEllipse(x - 10 * s, y, 15 * s, 9 * s).fillEllipse(x + 10 * s, y, 15 * s, 9 * s);
    g.fillStyle(this.appearance.glow, this.phase >= 2 ? 0.4 : 1).fillEllipse(x - 10 * s, y, 9 * s, 4 * s).fillEllipse(x + 10 * s, y, 9 * s, 4 * s);
    this.polygon(0xb5a292, [[x, y - 1 * s], [x - 5 * s, y + 9 * s], [x + 5 * s, y + 9 * s]]);
    g.fillStyle(0x282c35).fillEllipse(x, y + 14 * s, 25 * s, 9 * s);
    for (const side of [-1, 1]) this.polygon(0xe0cda7, [[x + side * 7 * s, y + 10 * s], [x + side * 10 * s, y + 20 * s], [x + side * 12 * s, y + 11 * s]]);
  }

  private serpentGate(): void {
    const g = this.structure, a = this.appearance;
    this.foundation(186, 0x637f7d);
    // 바위와 비늘형 수문은 전각·성문과 다른 둥근 실루엣이다.
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI + i * Math.PI / 7;
      const x = Math.cos(angle) * 65, y = -39 + Math.sin(angle) * 80;
      this.polygon(i % 2 ? 0x526b70 : 0x617c7a, [[x - 25, y - 18], [x + 18, y - 24], [x + 29, y + 13], [x + 4, y + 30], [x - 24, y + 18]]);
      this.stroke(0x92aca0, [[x - 20, y - 16], [x + 15, y - 20], [x + 24, y + 11]], 1.5, 0.5);
    }
    g.fillStyle(0x122832).fillRoundedRect(-43, -107, 86, 99, { tl: 39, tr: 39, bl: 0, br: 0 });
    g.fillStyle(a.glow, this.phase >= 2 ? 0.1 : 0.22).fillEllipse(0, -43, 61, 66);
    // 기둥을 감아 오른 이무기의 몸통과 갈기·뿔.
    for (const side of [-1, 1]) {
      this.stroke(0x355a60, [[side * 60, -16], [side * 75, -48], [side * 55, -73], [side * 64, -105], [side * 31, -132]], 18);
      this.stroke(0x93a887, [[side * 60, -16], [side * 75, -48], [side * 55, -73], [side * 64, -105], [side * 31, -132]], 3, 0.7);
      for (let i = 0; i < 5; i++) this.polygon(0x698f7c, [[side * 64, -31 - i * 19], [side * 82, -39 - i * 19], [side * 65, -45 - i * 19]]);
    }
    this.polygon(0x70958d, [[-32, -139], [-18, -157], [18, -157], [32, -139], [20, -115], [-20, -115]]);
    for (const side of [-1, 1]) {
      this.stroke(0xc5c39a, [[side * 18, -152], [side * 32, -166], [side * 34, -159]], 3);
      g.fillStyle(a.glow).fillEllipse(side * 14, -140, 12, 4);
      this.stroke(0xb3c2a0, [[side * 17, -126], [side * 35, -128], [side * 41, -120]], 1.5);
    }
    this.polygon(0x283d43, [[-12, -127], [0, -119], [12, -127]]);
    const bars = 5 + a.variant;
    for (let i = 0; i < bars; i++) {
      const x = -35 + i * 70 / (bars - 1);
      g.fillStyle(0x577375).fillRect(x, -83, 4, 72);
      g.fillStyle(0x9daf99, 0.6).fillRect(x, -83, 1, 72);
    }
    this.stroke(0x859b83, [[-58, -63], [59, -63]], 5);
    if (a.variant === 1) {
      for (const side of [-1, 1]) this.polygon(0x9d9a80, [[side * 68, 0], [side * 76, -14], [side * 91, -3]]);
    } else {
      for (let i = 0; i < 3; i++) g.lineStyle(1.5, 0x75b8b0, 0.5).strokeEllipse(0, -2 + i * 4, 83 + i * 19, 9 + i * 4);
    }
    if (a.variant === 2) for (const side of [-1, 1]) this.stroke(0x796147, [[side * 75, -7], [side * 95, -35], [side * 91, -66]], 8);
    this.talisman(-5, -61, 0xc7ba8d, this.phase > 0);
  }

  private ghostTree(): void {
    const g = this.structure, a = this.appearance;
    // 큰 뿌리·갈라진 줄기·휘어진 가지로 건물과 확연히 다른 기지를 만든다.
    for (const side of [-1, 1]) {
      this.stroke(0x294239, [[side * 25, -23], [side * 57, -2], [side * 98, 3]], 18);
      this.stroke(0x53654b, [[side * 27, -21], [side * 59, -5], [side * 97, 1]], 3, 0.8);
      this.stroke(0x334e3f, [[side * 9, -66], [side * 55, -104], [side * 91, -109], [side * 98, -133]], 16);
      this.stroke(0x738064, [[side * 16, -66], [side * 55, -105], [side * 90, -110], [side * 98, -132]], 2, 0.7);
      this.stroke(0x3c5543, [[side * 13, -112], [side * 44, -148], [side * 69, -158], [side * 72, -175]], 12);
      this.stroke(0x697759, [[side * 15, -111], [side * 44, -147], [side * 68, -158]], 2, 0.7);
      for (let j = 0; j < 3; j++) {
        const bx = side * (67 + j * 10);
        this.stroke(0x294c3b, [[bx, -11], [bx + side * 7, -80 - j * 12]], 3);
        for (let k = 0; k < 3; k++) {
          const by = -28 - k * 18;
          this.polygon(0x52784d, [[bx, by], [bx + side * 17, by - 10], [bx + side * 10, by + 1]]);
        }
      }
    }
    this.polygon(0x536149, [[-37, -7], [-28, -57], [-34, -106], [-16, -142], [-11, -169],
      [9, -160], [29, -124], [28, -85], [39, -31], [47, -2], [12, -11], [-4, -5]]);
    this.polygon(0x283e35, [[10, -155], [26, -119], [20, -76], [35, -30], [42, -4], [12, -11], [8, -59]]);
    for (const x of [-21, -9, 9, 22]) this.stroke(0x87906b, [[x, -18], [x - 5, -58], [x, -106], [x - 2, -130]], 1.5, 0.5);
    g.fillStyle(0x112326).fillEllipse(0, -42, 45, 62);
    g.fillStyle(a.glow, this.phase >= 2 ? 0.08 : 0.2).fillEllipse(0, -43, 28, 43);
    for (const side of [-1, 1]) {
      g.fillStyle(0x142b29).fillEllipse(side * 19, -90, 25, 14);
      g.fillStyle(a.glow, this.phase >= 2 ? 0.3 : 1).fillEllipse(side * 19, -90, 13, 5);
    }
    this.polygon(0x85916b, [[-2, -87], [-10, -66], [7, -68]]);
    this.stroke(0xb0ba8b, [[-34, -58], [-14, -51], [14, -52], [37, -65]], 2, 0.7);
    for (const x of [-21, 22]) this.talisman(x, -66, 0xd1c697, this.phase > 0);
    for (let i = 0; i < 3 + (a.variant % 3); i++) {
      const x = -68 + i * 34, yy = -116 - (i % 2) * 18;
      this.stroke(0x9b9a6d, [[x, yy], [x - 3, yy + 22]], 1);
      this.talisman(x - 3, yy + 22, i % 2 ? 0xe2cf98 : 0x7f5263, this.phase > 1);
    }
    for (let i = 0; i < 6; i++) {
      const x = -85 + i * 31, y = -117 - (i % 3) * 20;
      g.fillStyle(i % 2 ? 0x466047 : 0x374f41, 1).fillEllipse(x, y, 43, 24);
    }
    if (a.boss) {
      g.lineStyle(5, 0x67596d, 1).strokeEllipse(0, -145, 69, 26);
      g.fillStyle(0x212532).fillEllipse(0, -146, 52, 15);
      for (const side of [-1, 1]) this.stroke(0x74657d, [[side * 28, -148], [side * 34, -162], [side * 22, -158]], 3);
    }
  }

  private damage(): void {
    const g = this.structure, color = this.appearance.kind === 'ghostTree' ? 0x142824 : 0x1c2330;
    this.stroke(color, [[-48, -104], [-39, -89], [-45, -76], [-31, -57], [-37, -40]], 3);
    this.stroke(0xc8b494, [[-47, -103], [-38, -89], [-44, -77]], 1, 0.35);
    if (this.phase >= 2) {
      this.stroke(color, [[41, -117], [28, -98], [34, -82], [22, -61], [30, -39], [18, -20]], 5);
      this.stroke(color, [[32, -82], [54, -75], [62, -51]], 3);
      g.fillStyle(0x25312f, 0.55).fillEllipse(-15, -21, 63, 23);
    }
    for (let i = 0; i < 3 + this.phase * 3; i++) {
      const x = -72 + i * 19, y = -5 + (i % 3) * 4;
      this.polygon(i % 2 ? 0x6f6a64 : 0x8b7e70, [[x - 6, y], [x - 2, y - 6], [x + 5, y - 3], [x + 7, y + 2]]);
    }
  }

  private rubble(): void {
    if (this.appearance.kind === 'ghostTree') {
      for (const side of [-1, 1]) this.stroke(0x344d3b, [[side * 12, -7], [side * 52, 0], [side * 95, 3]], 15);
      this.polygon(0x556548, [[-37, -2], [-29, -36], [-11, -48], [-3, -28], [10, -40], [29, -26], [38, 1]]);
      this.polygon(0x263d32, [[-3, -28], [10, -40], [29, -26], [38, 1], [9, -1]]);
      this.structure.fillStyle(0x82926b).fillEllipse(-13, -31, 28, 10);
      this.structure.lineStyle(1, 0x3c553d, 0.7).strokeEllipse(-13, -31, 16, 5);
      this.stroke(0x4a5d43, [[30, 2], [57, -23], [84, -29]], 12);
      this.stroke(0x788464, [[31, 0], [56, -25], [84, -30]], 2, 0.6);
      this.structure.fillStyle(0x23392e).fillEllipse(-58, -10, 26, 12).fillEllipse(61, -6, 29, 12);
      return;
    }
    this.foundation(175, 0x5f6258);
    const g = this.structure;
    for (let i = 0; i < 16; i++) {
      const x = -81 + (i * 41 % 163), y = -8 - (i * 17 % 30);
      this.polygon(i % 3 ? 0x66665f : this.appearance.roof,
        [[x - 9, y + 5], [x - 4, y - 9], [x + 10, y - 5], [x + 15, y + 8]]);
    }
    this.stroke(0x655440, [[-47, -7], [-28, -51], [-23, -48]], 7);
    this.stroke(0x473d3d, [[22, -7], [54, -39]], 9);
    g.fillStyle(0x192a27, 0.45).fillEllipse(0, 3, 168, 20);
  }

  private drawEffects(): void {
    const g = this.effects.clear(), a = this.appearance, t = this.clock;
    if (this.phase < 3) {
      if (this.base.team === 'ally') {
        for (const side of [-1, 1]) {
          g.fillStyle(a.glow, (this.phase === 2 ? 0.025 : 0.055) * (0.8 + Math.sin(t * 2 + side) * 0.2))
            .fillCircle(side * 65, -67, 24);
        }
        // 향로에서 올라오는 가느다란 연기.
        for (let i = 0; i < 3; i++) {
          const age = (t * 0.3 + i / 3) % 1;
          g.fillStyle(0xd7dac4, (1 - age) * 0.18).fillEllipse(55 + Math.sin(t * 1.5 + i) * 4, -33 - age * 28, 4 + age * 4, 7);
        }
      } else {
        for (let i = 0; i < 3 + a.variant % 3; i++) {
          const x = -66 + i * 31 + Math.sin(t * 1.4 + i) * 4;
          const y = -12 - (t * 13 + i * 19) % 55;
          const alpha = (this.phase >= 2 ? 0.12 : 0.27) * (0.7 + Math.sin(t * 2 + i) * 0.3);
          g.fillStyle(a.glow, alpha * 0.3).fillCircle(x, y, 13);
          g.fillStyle(a.glow, alpha).fillEllipse(x, y, 5, 9);
          g.fillTriangle(x - 3, y, x + 2, y - 11, x + 3, y + 2);
        }
        if (this.shielded) {
          g.lineStyle(1.5, a.glow, 0.25 + Math.sin(t * 2) * 0.08).strokeEllipse(0, -69, a.width - 15, a.height - 9);
          for (const side of [-1, 1]) g.fillStyle(a.glow, 0.7).fillCircle(side * 34, -26, 2.5);
        }
      }
    }
    if (this.phase >= 2) {
      for (let i = 0; i < 4; i++) {
        const age = (t * 0.45 + i / 4) % 1;
        g.fillStyle(0x233135, (1 - age) * 0.28).fillEllipse(-35 + i * 22 + Math.sin(t + i) * 9,
          -18 - age * 56, 14 + age * 19, 12 + age * 16);
      }
    }
  }
}
