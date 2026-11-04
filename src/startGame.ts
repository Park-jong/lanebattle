import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { MapScene } from './scenes/MapScene';
import { BuildScene } from './scenes/BuildScene';
import { SettingsScene } from './scenes/SettingsScene';
import { BattleScene } from './scenes/BattleScene';
import { GAME_HEIGHT, GAME_WIDTH } from './scenes/layout';
import { ORIENTATION_KEY, OrientationWatcher } from './orientation';

/** 게임을 만들고 화면 방향·제스처 처리를 연결한다 (index.html과 test.html이 함께 쓴다) */
export function startGame(): Phaser.Game {
  // 물리 엔진 없음. Boot -> Title -> Map -> Battle -> Map (설정은 오버레이)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1b1d26',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // 멀티터치: 이동 버튼을 누른 채 다른 버튼을 누를 수 있게 포인터를 늘린다
    input: { activePointers: 4 },
    scene: [BootScene, TitleScene, MapScene, BattleScene, BuildScene, SettingsScene],
  });

  // 세로 화면 안내: 방향이 바뀔 때마다 안내 층을 켜고 끈다. 전투 씬은 같은 객체로 자동 일시정지한다
  const notice = document.getElementById('rotate-notice');
  const orientation = new OrientationWatcher(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const showNotice = (portrait: boolean) => {
    if (notice) notice.style.display = portrait ? 'flex' : 'none';
  };
  orientation.subscribe(showNotice);
  showNotice(orientation.isPortrait);
  game.registry.set(ORIENTATION_KEY, orientation);
  window.addEventListener('resize', () => orientation.refresh());
  window.addEventListener('orientationchange', () => orientation.refresh());

  // 길게 누름 메뉴, 두 손가락 확대(iOS)를 막는다
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(name, (e) => e.preventDefault());
  }
  return game;
}
