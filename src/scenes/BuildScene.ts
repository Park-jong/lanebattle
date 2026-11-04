import Phaser from 'phaser';
import { ALLIES } from '../data/allies';
import { getBossById } from '../data/bosses';
import { STAGES } from '../data/stages';
import { getUpgradeNode, MAX_TIER, TREE_NAMES, UPGRADE_NODES, type TreeId, type UpgradeNode } from '../data/upgrades';
import {
  allocateFailureText, BUILD_TABS, deallocateFailureText, nodeStatus, purchaseText, tabName,
  tierUnlockText, type BuildTab, type NodeStatus,
} from '../game/buildText';
import { builds, summonOrder, wallet } from '../game/session';
import { drawNightSky } from './background';
import { bossChipSpecs } from './bossChips';
import { KEY_MAP, KeyInput } from './input';
import { BUILD_LAYOUT as L, dialogButtons, HUD_FONT, nodeCells, tierLabelRect, type Rect } from './layout';
import { MenuButton } from './MenuButton';
import { HUD_STRIP, INK, PAPER } from './palette';
import { addArtImage } from '../render/CharacterRenderer';

const GOLD = 0xe0b52e;
const DEPTH = { dim: 290, panel: 295, button: 300 } as const;

/** 노드 상태별 칸 색과 글자 색 */
const STATUS_STYLE: Record<NodeStatus, { fill: number; text: string }> = {
  allocated: { fill: GOLD, text: '#2b2622' },
  available: { fill: PAPER, text: '#2b2622' },
  locked: { fill: 0x3a3f58, text: '#9aa0b8' },
  blocked: { fill: 0x6a3535, text: '#e6b0b0' },
};

type Dialog = 'reset' | 'copy' | null;

/** 빌드 화면: 업그레이드 트리, 저장 칸 3개, 초기화, 소환 순서 */
export class BuildScene extends Phaser.Scene {
  private stage = 0;
  private tab: BuildTab = 'mudang';
  private selectedNode: string | null = null;
  private selectedUnit: string | null = null;
  private dialog: Dialog = null;
  private message = '';
  private dirty = true;
  private keyInput!: KeyInput;

  // 한 번만 만드는 요소
  private slotButtons: MenuButton[] = [];
  private tabButtons: MenuButton[] = [];
  private buyButton!: MenuButton;
  private primaryButton!: MenuButton; // 찍기(+) / ◀ 앞으로
  private secondaryButton!: MenuButton; // 빼기(−) / 뒤로 ▶
  private walletText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;

  // 다시 그릴 때마다 지우고 만드는 요소
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private dynamicButtons: MenuButton[] = [];

  constructor() {
    super('Build');
  }

  /** 지도에서 고른 스테이지를 받아 두었다가 돌아갈 때 돌려준다 */
  init(data: { stage?: number }): void {
    this.stage = Math.max(0, Math.min(STAGES.length - 1, Math.floor(data.stage ?? 0) || 0));
    this.tab = 'mudang';
    this.selectedNode = null;
    this.selectedUnit = null;
    this.dialog = null;
    this.message = '';
    this.dirty = true;
    this.slotButtons = [];
    this.tabButtons = [];
    this.dynamicObjects = [];
    this.dynamicButtons = [];
  }

  create(): void {
    drawNightSky(this);
    this.add.rectangle(L.strip.x, L.strip.y, L.strip.w, L.strip.h, HUD_STRIP).setOrigin(0).setDepth(-5);
    this.add.rectangle(L.detail.x, L.detail.y, L.detail.w, L.detail.h, PAPER).setOrigin(0).setStrokeStyle(3, INK);

    this.createStrip();
    this.createTabs();
    this.createDetailControls();

    this.keyInput = new KeyInput(window, (code) => this.onKeyDown(code));
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  /** 입력 처리 중에 지우고 다시 만들지 않도록 다음 프레임에 그린다 */
  override update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.render();
  }

  // ----- 고정 요소 -----

  private button(rect: Rect, text: string, onClick: () => void, fontSize = 16): MenuButton {
    return new MenuButton(this, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, text, onClick, { fontSize });
  }

  private createStrip(): void {
    this.button(L.back, '지도로\n(Esc)', () => this.goMap(), 15);
    this.walletText = this.add.text(L.wallet.x, L.wallet.y, '', {
      fontFamily: HUD_FONT, fontSize: '16px', color: '#f3ead4', lineSpacing: 6, wordWrap: { width: L.wallet.w },
    });
    this.buyButton = this.button(L.buy, '', () => this.buy(), 15);
    L.slotTabs.forEach((rect, i) => {
      this.slotButtons.push(this.button(rect, '', () => this.selectSlot(i), 14));
    });
    this.button(L.copy, '칸 복사', () => this.openDialog('copy'), 15);
    this.button(L.reset, '초기화', () => this.openDialog('reset'), 16);
  }

  private createTabs(): void {
    BUILD_TABS.forEach((tab, i) => {
      this.tabButtons.push(this.button(L.treeTabs[i], '', () => this.selectTab(tab), 15));
    });
  }

  private createDetailControls(): void {
    this.primaryButton = this.button(L.allocate, '', () => this.onPrimary(), 18);
    this.secondaryButton = this.button(L.deallocate, '', () => this.onSecondary(), 18);
    this.messageText = this.add.text(L.message.x, L.message.y, '', {
      fontFamily: HUD_FONT, fontSize: '13px', color: '#7a2f28', wordWrap: { width: L.message.w, useAdvancedWrap: true },
    });
  }

  // ----- 그리기 -----

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.dynamicObjects.push(obj);
    return obj;
  }

  private clearDynamic(): void {
    for (const o of this.dynamicObjects) o.destroy();
    for (const b of this.dynamicButtons) b.destroy();
    this.dynamicObjects = [];
    this.dynamicButtons = [];
  }

  private render(): void {
    this.clearDynamic();
    this.renderStrip();
    this.renderBossRow();
    this.renderTabs();
    if (this.tab === 'order') this.renderOrderTab();
    else this.renderTreeTab(this.tab);
    this.messageText.setText(this.message);
    if (this.dialog) this.renderDialog(this.dialog);
  }

  private renderStrip(): void {
    this.walletText.setText(`신명 ${builds.availableSinmyeong()} / ${wallet.totalSinmyeong()}\n엽전 ${wallet.yeopjeon}`);
    const price = wallet.nextPrice();
    this.buyButton.setText(price === null ? '신명 구매\n(최대)' : `신명 구매\n(엽전 ${price})`);
    this.slotButtons.forEach((btn, i) => {
      const active = i === builds.activeIndex;
      btn.setText(`칸 ${i + 1}\n${active ? '사용 중' : `${builds.getSlot(i).spent()}점`}`);
      btn.setFill(active ? GOLD : PAPER);
    });
  }

  private renderBossRow(): void {
    const def = STAGES[this.stage];
    const style = { fontFamily: HUD_FONT, fontSize: '15px', fontStyle: 'bold', color: '#f3ead4' };
    if (!def.bossId) {
      this.track(this.add.text(L.boss.x, L.boss.y + 4, `${def.code} ${def.name}  (일반 스테이지)`, { ...style, fontStyle: 'normal', color: '#9aa5c0' }));
      return;
    }
    const boss = getBossById(def.bossId);
    const title = this.track(this.add.text(L.boss.x, L.boss.y + 4, `${def.code} 보스  ${boss.name}`, { ...style, color: '#ff8a7a' }));
    let x = L.boss.x + title.width + 12;
    for (const chip of bossChipSpecs(boss)) {
      const t = this.track(this.add.text(x, L.boss.y + 3, chip.text, {
        fontFamily: HUD_FONT, fontSize: '13px', color: chip.color, backgroundColor: chip.background, padding: { x: 6, y: 2 },
      }));
      x += t.width + 6;
    }
  }

  private renderTabs(): void {
    BUILD_TABS.forEach((tab, i) => {
      const btn = this.tabButtons[i];
      const sub = tab === 'order' ? '버튼 순서' : `쓴 신명 ${builds.current.spentIn(tab)}`;
      btn.setText(`${tabName(tab)}\n${sub}`);
      btn.setFill(tab === this.tab ? GOLD : PAPER);
    });
  }

  /** 칸 하나: 사각형 + 글자. 누르면 onClick */
  private drawCell(
    rect: Rect,
    text: string,
    look: { fill: number; text: string; alpha: number; selected: boolean },
    onClick: () => void,
    subject?: string,
  ): void {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const bg = this.track(this.add.rectangle(cx, cy, rect.w, rect.h, look.fill, look.alpha));
    bg.setStrokeStyle(look.selected ? 4 : 2, look.selected ? 0xffffff : INK);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    const portrait = subject ? addArtImage(this, subject, 'icon', rect.x + 25, cy, 40, 40) : undefined;
    if (portrait) this.track(portrait.setAlpha(look.alpha));
    this.track(
      this.add.text(cx + (portrait ? 20 : 0), cy, text, {
        fontFamily: HUD_FONT, fontSize: '12px', fontStyle: 'bold', color: look.text, align: 'center',
        wordWrap: { width: rect.w - (portrait ? 48 : 8), useAdvancedWrap: true },
      }).setOrigin(0.5).setAlpha(look.alpha),
    );
  }

  private renderTreeTab(tree: TreeId): void {
    const build = builds.current;
    const available = builds.availableSinmyeong();
    if (tree !== 'yogoe') {
      for (let tier = 1; tier <= MAX_TIER; tier++) {
        const r = tierLabelRect(tier);
        const unlocked = build.isTierUnlocked(tree, tier);
        const note = unlocked ? '해금됨' : (tierUnlockText(tier) ?? '');
        this.track(
          this.add.text(r.x, r.y + r.h / 2, `${tier}단\n${note}`, {
            fontFamily: HUD_FONT, fontSize: '12px', color: unlocked ? '#f3ead4' : '#8a90a8',
            wordWrap: { width: r.w - 4, useAdvancedWrap: true },
          }).setOrigin(0, 0.5),
        );
      }
    }
    for (const { nodeId, rect } of nodeCells(tree)) {
      const node = getUpgradeNode(nodeId)!;
      const status = nodeStatus(build, node, build.canAllocate(nodeId, available));
      const tierOpen = build.isTierUnlocked(tree, node.tier);
      const title = tree === 'yogoe' && node.tier === 1 ? unitNameOf(node) : node.name;
      this.drawCell(
        rect,
        `${title}\nLv ${build.getLevel(nodeId)}/${node.maxLevel}`,
        { ...STATUS_STYLE[status], alpha: tierOpen ? 1 : 0.55, selected: nodeId === this.selectedNode },
        () => {
          this.selectedNode = nodeId;
          this.message = ''; // 옛 결과 문구 지움
          this.dirty = true;
        },
      );
    }
    this.renderNodeDetail(this.selectedNode ? getUpgradeNode(this.selectedNode) : undefined);
  }

  private renderNodeDetail(node: UpgradeNode | undefined): void {
    const build = builds.current;
    this.primaryButton.setText('찍기 (+)');
    this.secondaryButton.setText('빼기 (−)');
    if (!node) {
      this.track(this.detailText('칸을 눌러 자세히 보세요.', '#6b5a3a'));
      this.primaryButton.setEnabled(false);
      this.secondaryButton.setEnabled(false);
      return;
    }
    const where =
      node.tree === 'yogoe' ? `${unitNameOf(node)}  ${'①②③'[node.tier - 1]}` : `${TREE_NAMES[node.tree]}  ${node.tier}단`;
    const info = this.track(
      this.detailText(
        `${node.name}\n${where}\n\n${node.description}\n\n레벨 ${build.getLevel(node.id)}/${node.maxLevel}\n레벨당 비용 ${node.costPerLevel}`,
        '#2b2622',
      ),
    );
    const add = builds.canAllocate(node.id);
    const remove = builds.canDeallocate(node.id);
    const lines: string[] = [];
    if (!add.ok) {
      lines.push(allocateFailureText(add.reason, node, { build, available: builds.availableSinmyeong(), allNodes: UPGRADE_NODES }));
    }
    const removeText = build.getLevel(node.id) > 0 ? deallocateFailureText(remove) : null;
    if (removeText) lines.push(removeText);
    if (lines.length > 0) {
      this.track(
        this.add.text(L.detailText.x, info.y + info.height + 10, lines.join('\n'), {
          fontFamily: HUD_FONT, fontSize: '13px', color: '#b3302a', wordWrap: { width: L.detailText.w, useAdvancedWrap: true },
        }),
      );
    }
    this.primaryButton.setEnabled(add.ok);
    this.secondaryButton.setEnabled(remove.ok);
  }

  private detailText(text: string, color: string): Phaser.GameObjects.Text {
    return this.add.text(L.detailText.x, L.detailText.y, text, {
      fontFamily: HUD_FONT, fontSize: '14px', color, lineSpacing: 3, wordWrap: { width: L.detailText.w, useAdvancedWrap: true },
    });
  }

  // ----- 소환 순서 -----

  private renderOrderTab(): void {
    const order = summonOrder.order;
    order.forEach((unitId, i) => {
      const ally = ALLIES.find((a) => a.id === unitId)!;
      const picked = unitId === this.selectedUnit;
      this.drawCell(
        L.orderCells[i],
        `${(i + 1) % 10}번\n${ally.name}`,
        { ...STATUS_STYLE[picked ? 'allocated' : 'available'], alpha: 1, selected: picked },
        () => {
          this.selectedUnit = unitId;
          this.message = '';
          this.dirty = true;
        },
        `ally:${unitId}`,
      );
    });
    this.dynamicButtons.push(
      this.button(L.orderReset, '기본 순서', () => {
        summonOrder.reset();
        this.message = '소환 순서를 기본으로 되돌렸습니다';
        this.dirty = true;
      }, 16),
    );
    this.track(
      this.add.text(L.orderHint.x, L.orderHint.y, '유닛을 고르고 "앞으로/뒤로"로 옮깁니다.\n전투의 소환 버튼과 1~0 키가 이 순서를 따릅니다.', {
        fontFamily: HUD_FONT, fontSize: '14px', color: '#9aa5c0', lineSpacing: 4,
      }),
    );

    this.primaryButton.setText('◀ 앞으로');
    this.secondaryButton.setText('뒤로 ▶');
    const index = this.selectedUnit ? order.indexOf(this.selectedUnit) : -1;
    if (index < 0) {
      this.track(this.detailText('유닛 칸을 눌러 고르세요.', '#6b5a3a'));
      this.primaryButton.setEnabled(false);
      this.secondaryButton.setEnabled(false);
      return;
    }
    const ally = ALLIES.find((a) => a.id === this.selectedUnit)!;
    const key = (index + 1) % 10;
    this.track(this.detailText(`${ally.name}\n\n지금 ${key}번 (키 ${key})\n\n${ally.ability}`, '#2b2622'));
    const portrait = addArtImage(this, `ally:${ally.id}`, 'preview', L.detailText.x + L.detailText.w / 2, 332, 110, 110);
    if (portrait) this.track(portrait);
    this.primaryButton.setEnabled(index > 0);
    this.secondaryButton.setEnabled(index < order.length - 1);
  }

  // ----- 확인창 -----

  private renderDialog(kind: Exclude<Dialog, null>): void {
    const P = L.dialogPanel;
    const dim = this.track(this.add.rectangle(0, 0, 960, 540, 0x000000, 0.65).setOrigin(0).setDepth(DEPTH.dim));
    dim.setInteractive(); // 뒤쪽 버튼이 눌리지 않게 막는다
    this.track(this.add.rectangle(P.x, P.y, P.w, P.h, PAPER).setOrigin(0).setStrokeStyle(3, INK).setDepth(DEPTH.panel));
    const active = builds.activeIndex;
    const body =
      kind === 'reset'
        ? '현재 칸을 초기화할까요?\n신명은 모두 돌아옵니다'
        : `칸 ${active + 1}을 어느 칸으로 복사할까요?\n(고른 칸의 빌드는 덮어써집니다)`;
    this.track(
      this.add.text(P.x + P.w / 2, P.y + 40, body, {
        fontFamily: HUD_FONT, fontSize: '20px', fontStyle: 'bold', color: '#2b2622', align: 'center', lineSpacing: 8,
      }).setOrigin(0.5, 0).setDepth(DEPTH.panel + 1),
    );
    const choices: { text: string; run: () => void }[] =
      kind === 'reset'
        ? [{ text: '초기화', run: () => this.confirmReset() }]
        : Array.from({ length: builds.slotCount }, (_, i) => i)
            .filter((i) => i !== active)
            .map((i) => ({ text: `칸 ${i + 1}로`, run: () => this.confirmCopy(i) }));
    const rects = dialogButtons(choices.length + 1);
    [...choices, { text: '취소', run: () => this.closeDialog() }].forEach((c, i) => {
      this.dynamicButtons.push(this.button(rects[i], c.text, c.run, 18).setDepth(DEPTH.button));
    });
  }

  // ----- 동작 -----

  private selectTab(tab: BuildTab): void {
    this.tab = tab;
    this.selectedNode = null;
    this.selectedUnit = null;
    this.message = '';
    this.dirty = true;
  }

  private selectSlot(index: number): void {
    builds.selectSlot(index);
    this.message = `칸 ${index + 1}을 사용합니다`;
    this.dirty = true;
  }

  private buy(): void {
    this.message = purchaseText(wallet.buySinmyeong());
    this.dirty = true;
  }

  /** 트리 탭: 찍기(+). 소환 순서 탭: ◀ 앞으로 */
  private onPrimary(): void {
    if (this.tab === 'order') {
      this.moveSelectedUnit(-1);
      return;
    }
    const node = this.selectedNode ? getUpgradeNode(this.selectedNode) : undefined;
    if (!node) return;
    const result = builds.allocate(node.id);
    this.message = result.ok
      ? `"${node.name}" 레벨 ${builds.current.getLevel(node.id)}/${node.maxLevel}`
      : allocateFailureText(result.reason, node, {
          build: builds.current, available: builds.availableSinmyeong(), allNodes: UPGRADE_NODES,
        });
    this.dirty = true;
  }

  /** 트리 탭: 빼기(−). 소환 순서 탭: 뒤로 ▶ */
  private onSecondary(): void {
    if (this.tab === 'order') {
      this.moveSelectedUnit(1);
      return;
    }
    const node = this.selectedNode ? getUpgradeNode(this.selectedNode) : undefined;
    if (!node) return;
    const result = builds.deallocate(node.id);
    this.message = result.ok
      ? `"${node.name}" 레벨 ${builds.current.getLevel(node.id)}/${node.maxLevel}`
      : (deallocateFailureText(result) ?? '');
    this.dirty = true;
  }

  private moveSelectedUnit(delta: number): void {
    if (this.selectedUnit) summonOrder.move(this.selectedUnit, delta);
    this.dirty = true;
  }

  private openDialog(kind: Exclude<Dialog, null>): void {
    this.dialog = kind;
    this.dirty = true;
  }

  private closeDialog(): void {
    this.dialog = null;
    this.dirty = true;
  }

  private confirmReset(): void {
    const refunded = builds.reset();
    this.message = refunded > 0 ? `신명 ${refunded}이(가) 돌아왔습니다` : '이미 비어 있습니다';
    this.selectedNode = null;
    this.closeDialog();
  }

  private confirmCopy(to: number): void {
    builds.copySlot(builds.activeIndex, to);
    this.message = `칸 ${builds.activeIndex + 1}의 빌드를 칸 ${to + 1}로 복사했습니다`;
    this.closeDialog();
  }

  private goMap(): void {
    this.scene.start('Map', { stage: this.stage });
  }

  private onKeyDown(code: string): void {
    if (code !== KEY_MAP.back) return;
    if (this.dialog) this.closeDialog();
    else this.goMap();
  }
}

/** 요괴 노드가 속한 유닛 이름 */
function unitNameOf(node: UpgradeNode): string {
  const unit = ALLIES.find((a) => node.id.startsWith(a.id));
  return unit ? unit.name : node.name;
}
