import Phaser from 'phaser';
import { ALLIES } from '../data/allies';
import { STAGES } from '../data/stages';
import { getBossById } from '../data/bosses';
import { getUpgradeNode, nodesOfTree, TIER_UNLOCK_SPENT, UPGRADE_NODES, YOGOE_UNIT_IDS, yogoeNodeIds, type TreeId, type UpgradeNode } from '../data/upgrades';
import { allocateFailureText, BUILD_TABS, deallocateFailureText, HIDDEN_NODE_NAME, HIDDEN_NODE_TEXT, nodeStatus, purchaseText, type BuildTab } from '../game/buildText';
import { builds, gameMode, summonOrder, wallet } from '../game/session';
import { browserStorage } from '../game/save';
import { HUD_FONT, type Rect } from './layout';
import { KEY_MAP, KeyInput } from './input';
import { addTestBadge } from './testBadge';
import { ScrollText } from '../ui/default/ScrollText';
import { unitShortName } from '../ui/default/tokens';
import { BUILD_LAYOUT as L, dialogButtons, nodeCells, tierLabelRect } from '../ui/build/layout';
import { buildFrame, drawBuildIcon } from '../ui/build/art';
import { levelEffectPreview } from '../ui/build/details';
import { addBuildPortrait, loadBuildPortraits } from '../ui/build/portraits';
import { BUILD_THEMES, buildCopy, buildNodeName, MILITARY_UNITS, nodeIcon, shortNodeName, unitIcon, type BuildIcon, type BuildSkin, type BuildTheme } from '../ui/build/theme';

type Dialog = 'manage' | 'reset' | 'copy' | null;
const TAB_ICONS: Record<BuildTab, BuildIcon> = { mudang: 'bell', yogoe: 'ghost', yeongye: 'link', salim: 'pouch', order: 'order' };

/** Shared skill-tree interaction, with independent folklore and tactical presentation. */
export class BuildScene extends Phaser.Scene {
  private stage = 0;
  private tab: BuildTab = 'mudang';
  private skin: BuildSkin = 'default';
  private selectedNode: string | null = null;
  private selectedUnit = YOGOE_UNIT_IDS[0];
  private orderUnit: string | null = null;
  private dialog: Dialog = null;
  private message = '';
  private dirty = true;
  private keyInput!: KeyInput;
  private detailBody!: ScrollText;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private upgradeFlash: string | null = null;

  constructor() { super('Build'); }
  private get theme(): BuildTheme { return BUILD_THEMES[this.skin]; }
  private get skinKey(): string { return `lane-defense.build-ui.${gameMode}`; }

  init(data: { stage?: number } = {}): void {
    this.stage = Math.max(0, Math.min(STAGES.length - 1, Math.floor(data.stage ?? 0) || 0));
    this.tab = 'mudang'; this.selectedNode = null; this.selectedUnit = YOGOE_UNIT_IDS[0];
    this.orderUnit = null; this.dialog = null; this.message = ''; this.dirty = true;
    this.objects = []; this.upgradeFlash = null;
    try { this.skin = browserStorage()?.getItem(this.skinKey) === 'military' ? 'military' : 'default'; } catch { this.skin = 'default'; }
  }

  preload(): void { loadBuildPortraits(this); }

  create(): void {
    this.detailBody = new ScrollText(this, L.detailText, 20);
    addTestBadge(this, 'left');
    this.keyInput = new KeyInput(window, code => {
      if (code !== KEY_MAP.back) return;
      if (this.dialog) { this.dialog = null; this.dirty = true; }
      else this.scene.start('Map', { stage: this.stage });
    });
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  override update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    for (const object of this.objects) { this.tweens.killTweensOf(object); object.destroy(); }
    this.objects = [];
    this.drawBackground(); this.drawHeader(); this.drawTabs();
    if (this.tab === 'order') this.drawOrder(); else this.drawTree(this.tab);
    if (this.dialog) this.drawDialog();
    this.upgradeFlash = null;
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T { this.objects.push(object); return object; }
  private graphics(depth = 0): Phaser.GameObjects.Graphics { return this.track(this.add.graphics().setDepth(depth)); }
  private text(x: number, y: number, text: string, size = 14, color = this.theme.text, width?: number): Phaser.GameObjects.Text {
    return this.track(this.add.text(x, y, text, { fontFamily: HUD_FONT, fontSize: `${size}px`, color,
      lineSpacing: 3, ...(width ? { wordWrap: { width, useAdvancedWrap: true } } : {}) }).setDepth(3));
  }
  private icon(icon: BuildIcon, x: number, y: number, size: number, color = this.theme.accent): Phaser.GameObjects.Graphics {
    return this.track(drawBuildIcon(this, icon, x, y, size, color).setDepth(2));
  }
  private copy(text: string): string {
    if (this.skin === 'default') return text;
    const named = [...UPGRADE_NODES].sort((a, b) => b.name.length - a.name.length)
      .reduce((s, node) => s.split(node.name).join(buildNodeName(node, this.skin)), text);
    return buildCopy(named, this.skin);
  }
  private unitName(id: string): string {
    const ally = ALLIES.find(a => a.id === id)!;
    return this.skin === 'military' ? MILITARY_UNITS[id] ?? ally.name : unitShortName(id, ally.name);
  }

  private button(rect: Rect, label: string, run: () => void, options: { active?: boolean; enabled?: boolean; primary?: boolean; depth?: number; size?: number } = {}): void {
    const t = this.theme, depth = options.depth ?? 1, enabled = options.enabled !== false;
    const g = this.graphics(depth);
    const draw = (hover = false) => {
      g.clear();
      buildFrame(g, rect, t, options.primary && enabled ? t.accent : hover && enabled ? t.raised : t.panel,
        options.active || options.primary && enabled ? t.accent : t.edge, options.active);
      g.setAlpha(enabled ? 1 : 0.45);
    };
    draw();
    this.text(rect.x + rect.w / 2, rect.y + rect.h / 2, label, options.size ?? 14,
      options.primary && enabled ? '#10252b' : options.active ? t.accentText : t.text, rect.w - 10)
      .setOrigin(0.5).setAlign('center').setFontStyle('bold').setDepth(depth + 1).setAlpha(enabled ? 1 : 0.4);
    const hit = this.track(this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setDepth(depth + 2).setInteractive({ useHandCursor: enabled }));
    hit.on('pointerover', () => draw(true)).on('pointerout', () => draw());
    hit.on('pointerdown', () => { if (enabled && (!this.dialog || depth >= 300)) run(); });
  }

  private drawBackground(): void {
    const t = this.theme, g = this.graphics(-10);
    g.fillStyle(t.bg).fillRect(0, 0, 960, 540);
    if (this.skin === 'default') {
      for (let i = 0; i < 5; i++) g.fillStyle(t.glow, 0.006).fillCircle(395, 310, 260 - i * 32);
      g.lineStyle(1, t.accent, 0.055).strokeCircle(385, 318, 196).strokeCircle(385, 318, 184);
      for (let i = 0; i < 45; i++) g.fillStyle(t.accent, 0.08).fillCircle(110 + i * 113 % 550, 112 + i * 79 % 390, 1);
    } else {
      g.lineStyle(1, t.edge, 0.13);
      for (let x = 104; x < 666; x += 24) g.lineBetween(x, 100, x, 504);
      for (let y = 100; y < 505; y += 24) g.lineBetween(104, y, 664, y);
      g.lineStyle(1, t.accent, 0.1).strokeCircle(384, 302, 180);
    }
    g.fillStyle(t.panel, 0.8).fillRect(0, 0, 960, 88);
    g.lineStyle(1, t.accent, 0.22).lineBetween(12, 88, 948, 88);
    buildFrame(g, L.detail, t, t.panel, t.edge);
    const stage = STAGES[this.stage], boss = stage.bossId ? getBossById(stage.bossId) : undefined;
    const footer = boss ? this.copy(`보스 약점 ${boss.weaknessLabels.join('·') || '없음'}  /  저항 ${boss.resistanceLabels.join('·') || '없음'}`)
      : this.skin === 'default' ? '신명을 새겨, 나만의 길을 완성하세요.' : '능력을 개방하고, 나만의 작전을 완성하세요.';
    this.text(116, 513, footer, 11, t.muted);
    this.text(938, 515, '선택 → 상세 확인 → 강화', 11, t.muted).setOrigin(1, 0);
  }

  private drawHeader(): void {
    const t = this.theme;
    this.button(L.back, '‹ 지도', () => this.scene.start('Map', { stage: this.stage }));
    this.text(96, 16, t.title, 26, t.accentText).setFontStyle('bold');
    this.text(98, 53, t.subtitle, 12, t.muted);
    this.text(L.wallet.x, 16, this.skin === 'default' ? '사용 가능한 신명' : '사용 가능한 포인트', 11, t.muted);
    this.text(L.wallet.x, 31, String(builds.availableSinmyeong()), 29, t.accentText).setFontStyle('bold');
    this.text(L.wallet.x + 146, 59, this.copy(`엽전 ${wallet.yeopjeon.toLocaleString()}`), 12, t.muted).setOrigin(1, 0);
    const price = wallet.nextPrice();
    this.button(L.buy, price === null ? '구매 완료' : `포인트 +1\n${price} ${this.skin === 'default' ? '엽전' : 'CR'}`, () => {
      this.message = this.copy(purchaseText(wallet.buySinmyeong())); this.dirty = true;
    }, { enabled: price !== null && wallet.yeopjeon >= price, size: 13 });
    L.slotTabs.forEach((r, i) => this.button(r, `빌드 ${i + 1}\n${i === builds.activeIndex ? '사용 중' : `${builds.getSlot(i).spent()}점`}`, () => {
      builds.selectSlot(i); this.message = `빌드 ${i + 1} 적용`; this.dirty = true;
    }, { active: i === builds.activeIndex, size: 12 }));
    this.button(L.menu, '빌드\n관리 ≡', () => { this.dialog = 'manage'; this.dirty = true; }, { size: 13 });
    this.button(L.skin, `UI 스킨\n${t.name} ⇄`, () => {
      this.skin = this.skin === 'default' ? 'military' : 'default';
      try { browserStorage()?.setItem(this.skinKey, this.skin); } catch { /* In-memory choice still works. */ }
      this.message = ''; this.dirty = true;
    }, { size: 13 });
  }

  private drawTabs(): void {
    BUILD_TABS.forEach((tab, i) => {
      const r = L.treeTabs[i], selected = tab === this.tab;
      this.button(r, '', () => {
        this.tab = tab; this.selectedNode = null; this.orderUnit = null; this.message = ''; this.dirty = true;
      }, { active: selected });
      this.icon(tab === 'mudang' && this.skin === 'military' ? 'sword' : tab === 'yogoe' && this.skin === 'military' ? 'shield'
        : tab === 'salim' && this.skin === 'military' ? 'crate' : TAB_ICONS[tab],
        r.x + r.w / 2, r.y + 25, 29, selected ? this.theme.accent : this.theme.glow);
      this.text(r.x + r.w / 2, r.y + 48, this.theme.tabs[tab], 12, selected ? this.theme.accentText : this.theme.muted).setOrigin(0.5, 0);
    });
  }

  private drawTree(tree: TreeId): void {
    const t = this.theme, build = builds.current;
    this.text(116, 109, t.tabs[tree], 21).setFontStyle('bold');
    this.text(652, 114, `투자 ${build.spentIn(tree)}점`, 13, t.accentText).setOrigin(1, 0);
    const stage = STAGES[this.stage];
    this.text(296, 115, `${stage.code} · ${stage.bossId ? this.copy(getBossById(stage.bossId).name) : '출전 준비'}`, 11, t.muted, 258);
    const cells = nodeCells(tree, this.selectedUnit);
    if (tree === 'yogoe') this.drawUnitPicker();
    else {
      for (let tier = 1; tier <= 4; tier++) {
        if (!nodesOfTree(tree).some(n => n.tier === tier)) continue;
        const r = tierLabelRect(tier), open = build.isTierUnlocked(tree, tier);
        const need = TIER_UNLOCK_SPENT[tier] ?? 0, spent = build.spentIn(tree, tier);
        const g = this.graphics();
        const ratio = Math.min(1, need ? spent / need : 1);
        g.fillStyle(t.edge).fillRoundedRect(r.x + 7, r.y + 30, 4, 39, 2);
        g.fillStyle(open ? t.glow : t.accent).fillRoundedRect(r.x + 7, r.y + 69 - 39 * ratio, 4, 39 * ratio, 2);
        this.text(r.x + 10, r.y + 4, ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][tier - 1], 15, open ? t.accentText : t.muted).setOrigin(0.5, 0);
        if (!open) this.text(r.x + 13, r.y + 73, `${spent}/${need}`, 10, t.muted).setOrigin(0.5, 0);
      }
      const next = [2, 3, 4].find(tier => !build.isTierUnlocked(tree, tier) && nodesOfTree(tree).some(n => n.tier === tier));
      this.text(116, 139, next ? `${next}단 해금 · 낮은 단 투자 ${build.spentIn(tree, next)} / ${TIER_UNLOCK_SPENT[next]}점` : '성장 경로 개방', 11, t.muted);
    }
    const links = this.graphics();
    for (const { nodeId, rect } of cells) {
      const node = getUpgradeNode(nodeId)!;
      const parent = cells.find(cell => cell.nodeId === node.requires);
      if (parent && build.isRevealed(node)) {
        const lit = build.getLevel(parent.nodeId) > 0;
        const x1 = parent.rect.x + parent.rect.w, x2 = rect.x, y = rect.y + 30;
        links.lineStyle(lit ? 3 : 1, lit ? t.glow : t.edge, lit ? 0.8 : 0.6).lineBetween(x1 + 2, y, x2 - 4, y);
        links.fillStyle(lit ? t.glow : t.edge).fillTriangle(x2 - 3, y, x2 - 9, y - 4, x2 - 9, y + 4);
      }
      if (node.exclusiveGroup && !node.finalStage) {
        const group = cells.filter(cell => getUpgradeNode(cell.nodeId)?.exclusiveGroup === node.exclusiveGroup);
        if (group[0]?.nodeId === nodeId && group.length > 1) {
          const last = group[group.length - 1].rect;
          links.lineStyle(1, t.accent, 0.22).strokeRoundedRect(rect.x - 3, rect.y - 3, last.x + last.w - rect.x + 6, rect.h + 6, 8);
        }
      }
    }
    for (const { nodeId, rect } of cells) this.drawNode(getUpgradeNode(nodeId)!, rect);
    this.drawDetail(this.selectedNode ? getUpgradeNode(this.selectedNode) : undefined);
  }

  private drawNode(node: UpgradeNode, r: Rect): void {
    const t = this.theme, build = builds.current, revealed = build.isRevealed(node);
    const check = builds.canAllocate(node.id);
    const status = nodeStatus(build, node, check);
    const fundsNeeded = !check.ok && check.reason === 'notEnoughSinmyeong';
    const level = build.getLevel(node.id), selected = node.id === this.selectedNode;
    const color = status === 'allocated' ? t.accent : status === 'available' ? fundsNeeded ? 0xba9c73 : t.glow : status === 'blocked' ? 0xc47d82 : t.edge;
    const g = this.graphics(1);
    buildFrame(g, r, t, status === 'allocated' ? (this.skin === 'default' ? 0x344039 : 0x263e4d) : t.panel, selected ? t.accent : color, selected);
    const cx = r.x + r.w / 2, cy = r.y + 30;
    g.fillStyle(color, 0.07).fillCircle(cx, cy, 24).lineStyle(1, color, 0.3).strokeCircle(cx, cy, 24);
    this.icon(revealed ? nodeIcon(node, this.skin) : 'question', cx, cy, 36, status === 'locked' ? this.skin === 'default' ? 0x68817f : 0x6c7f96 : color);
    this.text(cx, r.y + 57, revealed ? shortNodeName(node, this.skin) : HIDDEN_NODE_NAME, r.w > 100 ? 12 : 11, status === 'locked' ? t.muted : t.text, r.w - 6).setOrigin(0.5, 0).setAlign('center');
    if (node.exclusiveGroup && !node.finalStage) this.text(r.x + 6, r.y + 5,
      node.exclusiveGroup === 'fanWind' ? 'Q' : node.exclusiveGroup === 'blessing' ? 'W' : 'E', 9, t.muted);
    const badge = status === 'allocated' ? level === node.maxLevel ? '✓' : `${level}` : status === 'available' ? fundsNeeded ? '!' : '+' : status === 'blocked' ? '×' : '';
    g.fillStyle(t.bg).fillCircle(r.x + r.w - 7, r.y + 9, 9);
    if (badge) this.text(r.x + r.w - 7, r.y + 8, badge, 13, status === 'blocked' ? '#e2a0a5' : status === 'allocated' ? t.accentText : '#9ce4c9').setOrigin(0.5);
    else this.icon('lock', r.x + r.w - 7, r.y + 8, 12, 0x7c9399);
    const pipWidth = Math.min(14, (r.w - 24) / node.maxLevel), total = pipWidth * node.maxLevel + (node.maxLevel - 1) * 4;
    for (let i = 0; i < node.maxLevel; i++) g.fillStyle(i < level ? t.accent : t.edge, i < level ? 1 : 0.5)
      .fillRoundedRect(cx - total / 2 + i * (pipWidth + 4), r.y + r.h - 5, pipWidth, 2, 1);
    const hover = this.graphics(4).setAlpha(0);
    hover.lineStyle(2, t.accent, 0.5).strokeRoundedRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 9);
    const hit = this.track(this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setDepth(5).setInteractive({ useHandCursor: true }));
    hit.on('pointerover', () => hover.setAlpha(1)).on('pointerout', () => hover.setAlpha(0)).on('pointerdown', () => {
      if (this.dialog) return;
      this.selectedNode = node.id; this.message = ''; this.dirty = true;
    });
    if (this.upgradeFlash === node.id) {
      const flash = this.graphics(6).lineStyle(3, t.accent).strokeRoundedRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 10);
      this.tweens.add({ targets: flash, alpha: 0, duration: 650 });
      const seal = this.icon(this.skin === 'default' ? 'medal' : 'bolt', cx, cy, 42, t.accent).setDepth(7);
      this.tweens.add({ targets: seal, alpha: 0, y: seal.y - 15, duration: 550, ease: 'Cubic.out' });
    }
  }

  /** Use the selected skin's portrait, with an emblem if a texture is unavailable. */
  private portrait(unitId: string, x: number, y: number, size: number): void {
    const portrait = addBuildPortrait(this, this.skin, unitId, x, y, size);
    if (portrait) this.track(portrait.setDepth(2));
    else this.icon(unitIcon(unitId), x, y, size * 0.7, this.theme.glow);
  }

  private drawUnitPicker(): void {
    this.text(116, 139, this.skin === 'default' ? '요괴를 선택해 성장 경로를 펼치세요' : '병과를 선택해 장비를 개방하세요', 11, this.theme.muted);
    YOGOE_UNIT_IDS.forEach((id, i) => {
      const r = L.unitCells[i], selected = this.selectedUnit === id, ids = yogoeNodeIds(id);
      this.button(r, '', () => { this.selectedUnit = id; this.selectedNode = null; this.message = ''; this.dirty = true; }, { active: selected });
      this.portrait(id, r.x + 29, r.y + 29, 42);
      this.text(r.x + 57, r.y + 17, `${Object.values(ids).filter(n => builds.current.getLevel(n) > 0).length}/3`, 14, selected ? this.theme.accentText : this.theme.muted);
      this.text(r.x + r.w / 2, r.y + 53, this.unitName(id), 12).setOrigin(0.5, 0);
    });
    this.text(128, 345, `${this.unitName(this.selectedUnit)}  /  ${this.skin === 'default' ? '성장의 길' : '장비 개방 경로'}`, 17, this.theme.accentText).setFontStyle('bold');
    this.text(128, 370, this.skin === 'default' ? '기본 강화 → 핵심 능력 → 각성 → 숨겨진 힘' : '기초 훈련 → 병과 특화 → 정예화 → 기밀', 11, this.theme.muted);
  }

  private drawDetail(node?: UpgradeNode): void {
    const t = this.theme;
    this.text(698, 111, '능 력 상 세', 10, t.muted);
    if (!node) {
      this.icon(this.tab === 'yogoe' ? this.skin === 'default' ? 'ghost' : 'shield' : 'medal', 814, 185, 68);
      this.text(814, 238, this.skin === 'default' ? '어떤 힘을 깨울까요?' : '어떤 능력을 개방할까요?', 20).setOrigin(0.5);
      this.detailBody.setText('', t.muted);
      this.text(704, 281, '아이콘을 선택해 효과와\n투자 조건을 확인하세요.\n\n+ 강화   ✓ 완료   ! 포인트 부족\n잠금 · 조건 확인 / × 다른 갈래', 12, t.muted, 224).setLineSpacing(6);
      this.detailActions(false, false); this.drawMessage(); return;
    }
    const revealed = builds.current.isRevealed(node), level = builds.current.getLevel(node.id);
    const g = this.graphics();
    g.fillStyle(t.accent, 0.07).fillCircle(730, 168, 32).lineStyle(1, t.accent, 0.35).strokeCircle(730, 168, 32);
    this.icon(revealed ? nodeIcon(node, this.skin) : 'question', 730, 168, 46);
    this.text(774, 143, revealed ? buildNodeName(node, this.skin) : HIDDEN_NODE_NAME, 16, t.text, 158).setFontStyle('bold');
    this.text(698, 199, revealed ? `Lv. ${level} / ${node.maxLevel}${level < node.maxLevel ? `  →  ${level + 1}` : '  MAX'}` : '미지의 능력', 13, t.accentText);
    if (!revealed) {
      this.detailBody.setText(this.skin === 'default' ? `${HIDDEN_NODE_TEXT}\n\n여정을 이어가면 새로운 힘이 모습을 드러냅니다.`
        : '기밀 모듈이 잠겨 있습니다.\n\n전술 연구를 진행하면 새로운 장비가 공개됩니다.', t.muted);
      this.detailActions(false, false); this.drawMessage(); return;
    }
    const add = builds.canAllocate(node.id), remove = builds.canDeallocate(node.id);
    const desc = this.skin === 'military' && node.possessionOf
      ? '선택한 병과를 직접 통제합니다. 기본 공격·특성과 Q/W/E가 해당 병과의 전투 방식으로 전환됩니다.' : this.copy(node.description);
    const prerequisite = node.requires ? getUpgradeNode(node.requires) : undefined;
    const preview = levelEffectPreview(node, level);
    const lines = [desc, '', preview ? this.copy(preview) : '', `투자 비용  ${this.copy(`신명 ${node.costPerLevel}`)}`,
      prerequisite ? `선행  ${buildNodeName(prerequisite, this.skin)}` : '',
      !add.ok ? this.copy(allocateFailureText(add.reason, node, { build: builds.current, available: builds.availableSinmyeong(), allNodes: UPGRADE_NODES })) : '',
      level > 0 && !remove.ok ? this.copy(deallocateFailureText(remove) ?? '') : ''];
    this.detailBody.setText(lines.filter((s, i) => s || i === 1).join('\n'), t.text);
    if (node.tree === 'yeongye' && !this.message) {
      this.text(698, 400, '관련', 10, t.muted);
      this.synergyUnits(node).forEach((id, i) => this.portrait(id, 748 + i * 33, 405, 28));
    }
    this.detailActions(add.ok, remove.ok, node.costPerLevel); this.drawMessage();
  }

  private synergyUnits(node: UpgradeNode): string[] {
    if (node.id === 'guardFormation') return ['haetae', 'foxfireArcher', 'gumiho'];
    if (node.id === 'linkRing') return ALLIES.filter(a => a.tags.length > 1).map(a => a.id);
    if (node.id === 'hundredDemons') return ['clubGoblin', 'foxfireArcher', 'haetae', 'yeongdeungWind'];
    if (node.id === 'ghostGate') return ALLIES.filter(a => builds.current.getLevel(yogoeNodeIds(a.id).awaken) > 0).slice(0, 5).map(a => a.id);
    const tags = /dokkaebi/.test(node.id) ? ['dokkaebi'] : /ember/.test(node.id) ? ['fire'] : /guardian/.test(node.id) ? ['divine'] : /tailwind/.test(node.id) ? ['wind'] : /fireWind/.test(node.id) ? ['fire', 'wind'] : ['divine', 'dokkaebi'];
    return ALLIES.filter(ally => ally.tags.some(tag => tags.includes(tag))).slice(0, 6).map(a => a.id);
  }
  private detailActions(add: boolean, remove: boolean, cost?: number): void {
    this.button(L.allocate, `강화${cost === undefined ? '' : ` · ${cost}점`}  +`, () => this.allocate(), { enabled: add, primary: true, size: 17 });
    this.button(L.deallocate, '회수 −', () => this.deallocate(), { enabled: remove, size: 13 });
  }
  private drawMessage(): void {
    if (this.message) this.text(L.message.x, L.message.y, this.message, 11, this.theme.accentText, L.message.w).setDepth(8);
  }

  private drawOrder(): void {
    this.text(116, 109, this.theme.tabs.order, 21).setFontStyle('bold');
    this.text(116, 139, '선택한 순서가 전투 카드와 숫자 단축키에 적용됩니다', 11, this.theme.muted);
    summonOrder.order.forEach((id, i) => {
      const r = L.orderCells[i];
      this.button(r, '', () => { this.orderUnit = id; this.message = ''; this.dirty = true; }, { active: id === this.orderUnit });
      this.portrait(id, r.x + r.w / 2, r.y + 34, 48);
      this.text(r.x + 9, r.y + 6, String((i + 1) % 10), 12, this.theme.accentText);
      this.text(r.x + r.w / 2, r.y + 67, this.unitName(id), 12).setOrigin(0.5, 0);
    });
    this.button(L.orderReset, '기본 순서', () => { summonOrder.reset(); this.dirty = true; });
    this.text(L.orderHint.x, L.orderHint.y, '카드를 선택하고 앞 / 뒤로 옮기세요.\n자주 쓰는 유닛을 편한 단축키에 배치할 수 있습니다.', 13, this.theme.muted, L.orderHint.w);
    const id = this.orderUnit, index = id ? summonOrder.order.indexOf(id) : -1;
    this.text(698, 111, '배 치 상 세', 10, this.theme.muted);
    if (id) { this.portrait(id, 732, 168, 62); this.text(780, 150, this.unitName(id), 20, this.theme.text, 150); }
    else this.icon('order', 814, 168, 58);
    const ally = ALLIES.find(a => a.id === id);
    this.detailBody.setText(ally ? `현재 위치  ${(index + 1) % 10}번\n단축키  ${(index + 1) % 10}\n\n${this.copy(ally.ability)}` : '유닛 카드를 선택하고 아래 버튼으로 순서를 조정하세요.', this.theme.text);
    this.button(L.allocate, '‹ 앞으로', () => { if (id) summonOrder.move(id, -1); this.dirty = true; }, { enabled: index > 0, primary: true });
    this.button(L.deallocate, '뒤로 ›', () => { if (id) summonOrder.move(id, 1); this.dirty = true; }, { enabled: index >= 0 && index < 9, size: 13 });
    this.drawMessage();
  }

  private allocate(): void {
    const node = this.selectedNode ? getUpgradeNode(this.selectedNode) : undefined;
    if (!node) return;
    const result = builds.allocate(node.id);
    this.message = result.ok ? `${buildNodeName(node, this.skin)} · Lv. ${builds.current.getLevel(node.id)}` : this.copy(allocateFailureText(result.reason, node,
      { build: builds.current, available: builds.availableSinmyeong(), allNodes: UPGRADE_NODES }));
    if (result.ok) this.upgradeFlash = node.id;
    this.dirty = true;
  }
  private deallocate(): void {
    const node = this.selectedNode ? getUpgradeNode(this.selectedNode) : undefined;
    if (!node) return;
    const result = builds.deallocate(node.id);
    this.message = result.ok ? `${node.costPerLevel}점 회수` : this.copy(deallocateFailureText(result) ?? '');
    this.dirty = true;
  }

  private drawDialog(): void {
    const t = this.theme, p = L.dialogPanel;
    this.track(this.add.rectangle(0, 0, 960, 540, 0x030a11, 0.88).setOrigin(0).setDepth(300).setInteractive());
    buildFrame(this.graphics(301), p, t, t.panel, t.accent);
    const title = this.dialog === 'manage' ? '빌드 관리' : this.dialog === 'reset' ? '현재 빌드를 초기화할까요?' : '복사할 빌드를 선택하세요';
    this.text(480, 173, title, 23, t.accentText).setOrigin(0.5, 0).setDepth(302);
    this.text(480, 221, this.dialog === 'manage' ? `빌드 ${builds.activeIndex + 1} · 투자 ${builds.current.spent()}점`
      : this.dialog === 'reset' ? '투자한 포인트가 모두 돌아옵니다.' : '대상 빌드의 기존 설정을 덮어씁니다.', 15, t.text).setOrigin(0.5, 0).setDepth(302);
    const actions: { text: string; run: () => void }[] = this.dialog === 'manage' ? [
      { text: '빌드 복사', run: () => { this.dialog = 'copy'; } }, { text: '초기화', run: () => { this.dialog = 'reset'; } },
    ] : this.dialog === 'reset' ? [{ text: '초기화', run: () => { const points = builds.reset(); this.message = `${points}점 회수`; this.selectedNode = null; this.dialog = null; } }]
      : [0, 1, 2].filter(i => i !== builds.activeIndex).map(i => ({ text: `빌드 ${i + 1}에 복사`, run: () => {
        builds.copySlot(builds.activeIndex, i); this.message = `빌드 ${i + 1}에 복사했습니다`; this.dialog = null;
      } }));
    actions.push({ text: '닫기 (Esc)', run: () => { this.dialog = null; } });
    const rects = dialogButtons(actions.length);
    actions.forEach((a, i) => this.button(rects[i], a.text, () => { a.run(); this.dirty = true; }, { depth: 303 }));
  }
}
