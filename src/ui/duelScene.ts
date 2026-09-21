/**
 * 对决舞台：Canvas 场景 + 补间动画。
 * 玩家（左）与对手（右）是 ncase 风格小人，帽子颜色即本回合策略（红=争/鹰，蓝=让/鸽）。
 */

import { drawFood, drawGround, type SketchContext } from "./sketchAnimals";
import { drawPeep, drawScuffleCloud, type PeepFace } from "./sketchPeeps";
import type { Move } from "../core/hawkDove";

type Ease = (k: number) => number;
const easeOutCubic: Ease = (k) => 1 - Math.pow(1 - k, 3);
const easeInOutQuad: Ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

type Prop = "advance" | "flee";

interface PropTween {
  from: number;
  to: number;
  start: number;
  dur: number;
  ease: Ease;
}

interface Actor {
  kind: Move; // 本回合策略（决定帽子颜色）
  baseX: number; // 初始位置（画面宽度的比例）
  advance: number; // 0=原地，1=接近食物
  flee: number; // 退让位移（向外）
  face: PeepFace;
  hidden: boolean; // 打架云遮住时隐藏本体
  holdingFood: boolean;
  tweens: Partial<Record<Prop, PropTween>>;
}

export class DuelScene {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private startTime = 0;
  private player!: Actor;
  private rival!: Actor;
  private outcome = "dove-dove";
  private scuffling = false;
  private timers: number[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 2D 上下文");
    this.ctx = ctx;
    this.reset();
  }

  private freshActor(baseX: number): Actor {
    return { kind: "dove", baseX, advance: 0, flee: 0, face: "calm", hidden: false, holdingFood: false, tweens: {} };
  }

  private reset(): void {
    this.player = this.freshActor(0.16);
    this.rival = this.freshActor(0.84);
  }

  /** 双方站位等待玩家选择 */
  showIdle(): void {
    this.reset();
    this.outcome = "dove-dove";
    this.scuffling = false;
    this.startLoop();
  }

  private tweenTo(actor: Actor, prop: Prop, to: number, dur: number, ease: Ease): void {
    actor.tweens[prop] = { from: actor[prop], to, start: performance.now(), dur, ease };
  }

  private applyTweens(actor: Actor, now: number): void {
    for (const key of ["advance", "flee"] as Prop[]) {
      const tw = actor.tweens[key];
      if (!tw) continue;
      const k = Math.min(1, (now - tw.start) / tw.dur);
      actor[key] = tw.from + (tw.to - tw.from) * tw.ease(k);
      if (k >= 1) delete actor.tweens[key];
    }
  }

  private isAnimating(actor: Actor): boolean {
    return actor.tweens.advance !== undefined || actor.tweens.flee !== undefined;
  }


  /** 播放对决动画，结束后回调。鹰鹰对决会返回真实赢家。 */
  play(
    playerMove: Move,
    rivalMove: Move,
    onResolved: (winner: "player" | "rival" | null) => void,
  ): void {
    this.clearTimers();
    this.reset();
    this.player.kind = playerMove;
    this.rival.kind = rivalMove;
    this.outcome = `${playerMove}-${rivalMove}`;
    this.scuffling = false;
    this.startLoop();

    const t = (ms: number, fn: () => void) => this.timers.push(window.setTimeout(fn, ms));
    const P = this.player;
    const R = this.rival;

    switch (this.outcome) {
      case "hawk-dove":
        // 玩家强硬，对方退让 → 玩家独享食物
        t(80, () => { P.face = "angry"; R.face = "sad"; });
        t(200, () => this.tweenTo(R, "flee", 1, 500, easeOutCubic));
        t(450, () => this.tweenTo(P, "advance", 1, 750, easeInOutQuad));
        t(1250, () => { P.face = "happy"; P.holdingFood = true; });
        t(1650, () => onResolved(null));
        break;
      case "dove-hawk":
        t(80, () => { R.face = "angry"; P.face = "sad"; });
        t(200, () => this.tweenTo(P, "flee", 1, 500, easeOutCubic));
        t(450, () => this.tweenTo(R, "advance", 1, 750, easeInOutQuad));
        t(1250, () => { R.face = "happy"; R.holdingFood = true; });
        t(1650, () => onResolved(null));
        break;
      case "hawk-hawk":
        // 双方冲向中间 → 吵架云 → 产生真实赢家和输家
        const playerWins = Math.random() < 0.5;
        t(80, () => { P.face = "angry"; R.face = "angry"; });
        t(150, () => {
          this.tweenTo(P, "advance", 0.9, 450, easeInOutQuad);
          this.tweenTo(R, "advance", 0.9, 450, easeInOutQuad);
        });
        t(620, () => {
          P.hidden = true;
          R.hidden = true;
          this.scuffling = true;
        });
        t(1650, () => {
          this.scuffling = false;
          P.hidden = false;
          R.hidden = false;
          P.face = playerWins ? "happy" : "dizzy";
          R.face = playerWins ? "dizzy" : "happy";
          P.holdingFood = playerWins;
          R.holdingFood = !playerWins;
          this.tweenTo(P, "advance", 0.05, 380, easeOutCubic);
          this.tweenTo(R, "advance", 0.05, 380, easeOutCubic);
        });
        t(2150, () => onResolved(playerWins ? "player" : "rival"));
        break;
      default:
        // dove-dove：互相客气地让，最后一起分享
        t(200, () => this.tweenTo(P, "advance", 0.4, 500, easeInOutQuad));
        t(550, () => this.tweenTo(P, "advance", 0.1, 400, easeInOutQuad));
        t(750, () => this.tweenTo(R, "advance", 0.4, 500, easeInOutQuad));
        t(1100, () => this.tweenTo(R, "advance", 0.1, 400, easeInOutQuad));
        t(1350, () => {
          this.tweenTo(P, "advance", 0.55, 450, easeInOutQuad);
          this.tweenTo(R, "advance", 0.55, 450, easeInOutQuad);
        });
        t(1850, () => { P.face = "happy"; R.face = "happy"; });
        t(2200, () => onResolved(null));
        break;
    }
  }

  private startLoop(): void {
    if (this.raf) return;
    this.startTime = performance.now();
    const loop = () => {
      const now = performance.now();
      this.applyTweens(this.player, now);
      this.applyTweens(this.rival, now);
      this.render((now - this.startTime) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clearTimers();
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }


  private render(t: number): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const sc: SketchContext = { ctx, t };
    const groundY = h - 40;
    drawGround(sc, w, groundY);

    // 食物在中间（被独吞或打架时消失）
    const foodX = w / 2;
    const foodTaken =
      this.player.holdingFood || this.rival.holdingFood || this.scuffling;
    if (!foodTaken) drawFood(sc, foodX, groundY - 6, 1.15);

    // 吵架云遮住双方
    if (this.scuffling) {
      drawScuffleCloud(sc, foodX, groundY - 52, 1.25);
    }

    // 眨眼调度：各自独立地随机眨一下眼
    this.maybeBlink(this.player, t);
    this.maybeBlink(this.rival, t);

    this.drawActor(sc, this.player, 1, foodX, groundY, w, t);
    this.drawActor(sc, this.rival, -1, foodX, groundY, w, t);
  }

  private nextBlink = new WeakMap<Actor, number>();
  private blinkUntil = new WeakMap<Actor, number>();

  /** 每 2.5~5.5 秒眨一次眼（持续 0.15s），表情非 calm 时不眨 */
  private maybeBlink(actor: Actor, t: number): void {
    if (actor.face !== "calm" || actor.hidden) return;
    if (this.nextBlink.get(actor) === undefined) {
      this.nextBlink.set(actor, t + 1.5 + Math.random() * 3);
      return;
    }
    if (t >= this.nextBlink.get(actor)!) {
      this.blinkUntil.set(actor, t + 0.15);
      this.nextBlink.set(actor, t + 2.5 + Math.random() * 3);
    }
  }

  private drawActor(
    sc: SketchContext,
    actor: Actor,
    dir: 1 | -1,
    foodX: number,
    groundY: number,
    w: number,
    t: number,
  ): void {
    if (actor.hidden) return;

    let x = actor.baseX * w + (foodX - actor.baseX * w) * actor.advance * 0.85;
    x -= dir * actor.flee * 100; // 退让向外
    // 退让时也要把完整角色留在画布内（帽子绒球是最外侧部件）。
    x = Math.min(w - 58, Math.max(58, x));

    const walking = this.isAnimating(actor);
    const walkPhase = walking ? t * 11 : null;

    drawPeep(sc, x, groundY, 0.82, {
      dir,
      hat: actor.kind,
      face: actor.face,
      walkPhase,
      holdingFood: actor.holdingFood,
      blinkUntil: this.blinkUntil.get(actor),
    });
  }
}
