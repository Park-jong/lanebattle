import { Base, Fighter, type Body, type Projectile } from '../battle/entities';
import { HERO } from '../data/hero';
import { BATTLEFIELD, GROUND_Y } from '../scenes/layout';
import { UNIT_DISPLAY_SCALES } from './unitSizes';

/** 화면에서만 쓰는 앞뒤 배치. 개체가 이동하거나 배열 순서가 바뀌어도 발 위치를 유지한다. */
export class BattlefieldProjection {
  private readonly rows = new WeakMap<Body, number>();
  private readonly nextRow = { ally: 0, enemy: 2 };
  private readonly launches = new WeakMap<Projectile, { x: number; y: number }>();

  constructor(private readonly lift: (body: Body) => number = () => 0,
    private readonly visualSize: (body: Body) => { height: number; top: number; width?: number } | undefined = () => undefined) {}

  ground(body: Body): number {
    if (body.kind === 'base') return GROUND_Y - 8;
    if (body.kind === 'hero') return GROUND_Y + 12;
    if (body.isBoss) return GROUND_Y;
    let row = this.rows.get(body);
    if (row === undefined) {
      const offsets = BATTLEFIELD.rows;
      row = offsets[this.nextRow[body.team]++ % offsets.length];
      this.rows.set(body, row);
    }
    return GROUND_Y + row;
  }

  height(body: Body): number {
    const visual = this.visualSize(body);
    if (visual) return visual.height * this.scale(body);
    if (body instanceof Fighter) return body.stats.height * body.sizeScale * this.scale(body);
    return body instanceof Base ? body.height : HERO.height * this.scale(body);
  }

  scale(body: Body): number {
    if (body.kind === 'base') return 1;
    if (body.kind === 'hero') return BATTLEFIELD.heroScale;
    if (body.isBoss) return BATTLEFIELD.bossScale;
    return body instanceof Fighter
      ? UNIT_DISPLAY_SCALES[body.team][body.defId] ?? BATTLEFIELD.unitScale
      : BATTLEFIELD.unitScale;
  }

  width(body: Body): number {
    const visual = this.visualSize(body);
    if (visual?.width) return visual.width * this.scale(body);
    if (body instanceof Fighter) return body.stats.width * body.sizeScale * this.scale(body);
    return body instanceof Base ? body.width : HERO.width * this.scale(body);
  }

  elevation(body: Body): number { return body.flying ? this.lift(body) : 0; }
  top(body: Body): number {
    const visual = this.visualSize(body);
    return this.ground(body) - (visual ? visual.top * this.scale(body) : this.height(body)) - this.elevation(body);
  }

  /** 발이 앞에 있는 캐릭터가 뒤쪽 캐릭터를 가린다. 비행 높이는 정렬 기준에서 제외한다. */
  depth(body: Body): number { return 20 + (this.ground(body) - BATTLEFIELD.backY) * 0.1; }

  /** 발사 위치는 고정하고 현재 표적의 몸통까지 화면상의 궤적을 연결한다. */
  projectile(p: Projectile): { x: number; y: number; angle: number } {
    let launch = this.launches.get(p);
    if (!launch) {
      const shooter = p.payload.attacker;
      launch = { x: p.x, y: shooter ? this.ground(shooter) - this.elevation(shooter) - this.height(shooter) * 0.55 : GROUND_Y - 24 };
      this.launches.set(p, launch);
    }
    const targetY = this.ground(p.target) - this.elevation(p.target) - this.height(p.target) * 0.55;
    const dx = p.target.x - launch.x;
    const t = Math.abs(dx) < 0.001 ? 1 : Math.max(0, Math.min(1, (p.x - launch.x) / dx));
    return { x: p.x, y: launch.y + (targetY - launch.y) * t,
      angle: Math.atan2(targetY - launch.y, Math.abs(dx)) * (dx < 0 ? -1 : 1) };
  }
}
