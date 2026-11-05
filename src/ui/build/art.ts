import Phaser from 'phaser';
import type { Rect } from '../../scenes/layout';
import type { BuildIcon, BuildTheme } from './theme';

/** Crisp vector emblems, drawn in game coordinates so both skins stay sharp on phones. */
export function drawBuildIcon(scene: Phaser.Scene, icon: BuildIcon, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setPosition(x - size / 2, y - size / 2).setScale(size / 48);
  g.lineStyle(2.5, color, 1).fillStyle(color, 0.18);
  const path = (points: number[][], close = false, fill = false) => {
    const v = points.map(([px, py]) => new Phaser.Math.Vector2(px, py));
    if (fill) g.fillPoints(v, close);
    g.strokePoints(v, close);
  };
  const line = (a: number, b: number, c: number, d: number) => g.lineBetween(a, b, c, d);
  switch (icon) {
    case 'bell':
      path([[12, 32], [15, 27], [15, 19], [18, 13], [30, 13], [33, 19], [33, 27], [36, 32]], true, true);
      g.strokeCircle(24, 9, 3); line(19, 37, 29, 37); line(24, 32, 24, 37); break;
    case 'sword': case 'blades':
      path([[15, 31], [32, 9], [39, 8], [38, 16], [21, 34]], true, true);
      line(11, 27, 26, 38); line(17, 33, 10, 42); line(6, 38, 14, 44);
      if (icon === 'blades') { line(10, 9, 36, 40); line(7, 31, 20, 22); } break;
    case 'heart':
      path([[24, 39], [8, 24], [7, 17], [11, 11], [18, 10], [24, 16], [30, 10], [37, 11], [41, 17], [40, 24]], true, true);
      path([[13, 24], [20, 24], [23, 18], [27, 30], [30, 24], [36, 24]]); break;
    case 'revive': case 'cycle':
      g.beginPath().arc(24, 24, 16, 0.5, 5.5).strokePath();
      path([[29, 7], [37, 10], [35, 19]], false); if (icon === 'revive') { line(18, 25, 30, 25); line(24, 19, 24, 31); }
      else { path([[17, 29], [24, 17], [31, 29]], true, true); } break;
    case 'battery':
      g.strokeRoundedRect(11, 11, 26, 30, 3); line(18, 7, 30, 7);
      path([[26, 15], [18, 26], [25, 26], [22, 36], [31, 23], [24, 23]], true, true); break;
    case 'wind':
      path([[5, 17], [32, 17], [38, 13], [36, 8], [31, 7], [27, 10]]);
      path([[10, 24], [39, 24], [43, 28], [40, 33], [35, 33]]);
      path([[5, 31], [23, 31], [27, 36], [24, 41], [19, 40]]); break;
    case 'fan':
      path([[24, 39], [5, 19], [11, 11], [20, 7], [29, 7], [38, 11], [43, 19]], true, true);
      for (const [px, py] of [[11, 13], [19, 9], [29, 9], [37, 13]]) line(24, 38, px, py); break;
    case 'heal':
      path([[18, 8], [30, 8], [30, 18], [40, 18], [40, 30], [30, 30], [30, 40], [18, 40], [18, 30], [8, 30], [8, 18], [18, 18]], true, true); break;
    case 'flame':
      path([[24, 5], [24, 18], [32, 14], [39, 25], [37, 35], [31, 41], [18, 41], [10, 34], [9, 25], [15, 14], [17, 24]], true, true);
      path([[24, 27], [19, 34], [24, 39], [29, 34]], true); break;
    case 'sun': case 'medal':
      g.fillStyle(color, 0.18).fillCircle(24, 23, 11).strokeCircle(24, 23, 11);
      if (icon === 'sun') for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(24 + Math.cos(a) * 16, 23 + Math.sin(a) * 16, 24 + Math.cos(a) * 21, 23 + Math.sin(a) * 21); }
      else { path([[15, 31], [12, 44], [22, 39]]); path([[33, 31], [36, 44], [26, 39]]); }
      path([[24, 16], [30, 25], [24, 29], [18, 25]], true, true); break;
    case 'shield':
      path([[24, 6], [39, 12], [37, 29], [31, 37], [24, 42], [17, 37], [11, 29], [9, 12]], true, true);
      path([[17, 23], [22, 29], [32, 18]]); break;
    case 'ghost':
      path([[10, 40], [10, 20], [14, 11], [24, 7], [34, 11], [38, 20], [38, 40], [31, 35], [24, 40], [17, 35]], true, true);
      g.fillStyle(color, 1).fillCircle(18, 22, 2.5).fillCircle(30, 22, 2.5); break;
    case 'link':
      g.strokeCircle(16, 24, 11).strokeCircle(32, 24, 11); line(18, 24, 30, 24); break;
    case 'coin':
      g.strokeCircle(24, 24, 17).strokeCircle(24, 24, 12); g.strokeRect(20, 20, 8, 8); break;
    case 'pouch':
      path([[17, 15], [12, 7], [24, 10], [36, 7], [31, 15], [39, 29], [37, 39], [24, 42], [11, 39], [9, 29]], true, true);
      line(16, 16, 32, 16); g.strokeCircle(24, 29, 5); break;
    case 'bolt':
      path([[27, 4], [9, 27], [23, 27], [20, 44], [39, 19], [25, 19]], true, true); break;
    case 'gate':
      path([[8, 40], [8, 12], [40, 12], [40, 40]]); line(5, 8, 43, 8); line(16, 15, 16, 40); line(32, 15, 32, 40);
      path([[24, 21], [28, 29], [24, 36], [20, 29]], true, true); break;
    case 'target':
      g.strokeCircle(24, 24, 14).strokeCircle(24, 24, 5);
      for (const [a, b, c, d] of [[24, 3, 24, 15], [24, 33, 24, 45], [3, 24, 15, 24], [33, 24, 45, 24]]) line(a, b, c, d); break;
    case 'drone':
      g.strokeRoundedRect(17, 18, 14, 12, 3);
      for (const [px, py] of [[10, 10], [38, 10], [10, 38], [38, 38]]) { line(24, 24, px, py); g.strokeCircle(px, py, 6); } break;
    case 'missile':
      path([[16, 30], [22, 14], [36, 6], [37, 22], [27, 33]], true, true);
      path([[16, 25], [9, 28], [8, 37], [20, 33]]); path([[29, 30], [27, 41], [20, 41], [21, 33]]);
      line(13, 36, 6, 44); g.strokeCircle(29, 17, 3); break;
    case 'fist':
      path([[12, 24], [9, 19], [13, 13], [18, 17], [18, 9], [24, 9], [24, 17], [29, 10], [34, 12], [32, 20], [39, 17], [42, 22], [34, 33], [32, 40], [16, 40], [14, 31]], true, true); break;
    case 'hammer':
      path([[10, 12], [18, 5], [39, 22], [32, 31]], true, true); path([[24, 24], [9, 40], [14, 44], [29, 28]], true, true); break;
    case 'lock':
      g.strokeRoundedRect(12, 21, 24, 20, 3); g.beginPath().arc(24, 20, 9, Math.PI, Math.PI * 2).strokePath();
      g.fillStyle(color, 1).fillCircle(24, 29, 2); line(24, 30, 24, 34); break;
    case 'question':
      path([[16, 15], [19, 9], [29, 9], [34, 15], [32, 22], [24, 28], [24, 32]]); g.fillStyle(color, 1).fillCircle(24, 39, 2); break;
    case 'order':
      for (let i = 0; i < 3; i++) { g.strokeRect(8, 9 + i * 12, 5, 5); line(20, 12 + i * 12, 39, 12 + i * 12); } break;
    case 'crate':
      path([[8, 12], [40, 12], [42, 17], [42, 39], [6, 39], [6, 17]], true, true);
      line(6, 20, 42, 20); line(18, 12, 18, 39); line(30, 12, 30, 39);
      g.strokeRoundedRect(18, 6, 12, 6, 1); line(21, 29, 27, 29); break;
    case 'shockwave':
      path([[7, 8], [19, 24], [7, 40]]); path([[20, 8], [32, 24], [20, 40]]);
      line(41, 9, 41, 17); line(41, 21, 41, 27); line(41, 31, 41, 39); break;
  }
  return g;
}

export function buildFrame(g: Phaser.GameObjects.Graphics, rect: Rect, theme: BuildTheme, fill: number, edge: number, selected = false): void {
  const { x, y, w, h } = rect;
  if (theme.id === 'military') {
    const points = [[x + 8, y], [x + w, y], [x + w, y + h - 8], [x + w - 8, y + h], [x, y + h], [x, y + 8]].map(([px, py]) => new Phaser.Math.Vector2(px, py));
    g.fillStyle(fill).fillPoints(points, true).lineStyle(selected ? 2 : 1, edge).strokePoints(points, true);
    g.lineStyle(2, edge, 0.6).lineBetween(x + 5, y + 14, x + 5, y + 28);
  } else {
    g.fillStyle(fill).fillRoundedRect(x, y, w, h, 8).lineStyle(selected ? 2 : 1, edge).strokeRoundedRect(x, y, w, h, 8);
    for (const px of [x + 6, x + w - 6]) { g.fillStyle(edge, 0.8).fillCircle(px, y + 6, 1.5).fillCircle(px, y + h - 6, 1.5); }
  }
  if (selected) g.lineStyle(1, edge, 0.3).strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 10);
  g.lineStyle(1, 0xffffff, 0.06).lineBetween(x + 12, y + 3, x + w - 12, y + 3);
}
