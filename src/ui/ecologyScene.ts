import type {
  EcologyDayResult,
  EcologySeat,
  EcologyState,
} from "../core/ecology";
import { drawFood, type SketchContext } from "./sketchAnimals";
import { drawPeep } from "./sketchPeeps";
import type { Learner, LearningState } from "../core/learning";
import type { Move } from "../core/hawkDove";

const INK = "#41403e";
const GOLD = "#d9a441";
const DANGER = "#c0392b";

/** 第五关专用舞台：库存、空席、当前配对与日夜事件。 */
export class EcologyScene {
  private ctx: CanvasRenderingContext2D;
  private seats: EcologySeat[] = [];
  private foodUnits = 0;
  private activePair: [number, number] | null = null;
  private focusSeat: number | null = null;
  private learningMode = false;
  private learners = new Map<number, Learner>();
  private temporaryMoves = new Map<number, Move>();
  private busy = false;
  private timers: number[] = [];
  private raf = 0;
  private startedAt = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建生态舞台");
    this.ctx = ctx;
  }

  isBusy(): boolean {
    return this.busy;
  }

  showState(state: EcologyState, foodUnits = this.foodUnits): void {
    this.clearTimers();
    this.seats = state.seats.map((seat) => ({ ...seat }));
    this.foodUnits = foodUnits;
    this.activePair = null;
    this.focusSeat = null;
    this.learningMode = false;
    this.learners.clear();
    this.temporaryMoves.clear();
    this.busy = false;
    this.startLoop();
  }

  showLearningState(state: LearningState, foodUnits = this.foodUnits): void {
    this.showState(state.ecology, foodUnits);
    this.learningMode = true;
    this.learners = new Map(state.learners.map((learner) => [learner.seatId, {
      ...learner,
      hawkMemory: [...learner.hawkMemory],
      doveMemory: [...learner.doveMemory],
    }]));
  }

  updateLearners(learners: Learner[]): void {
    this.learningMode = true;
    this.learners = new Map(learners.map((learner) => [learner.seatId, {
      ...learner,
      hawkMemory: [...learner.hawkMemory],
      doveMemory: [...learner.doveMemory],
    }]));
  }

  spotlightSeat(index: number | null): void {
    this.focusSeat = index;
  }

  setFoodUnits(foodUnits: number): void {
    this.foodUnits = foodUnits;
  }

  spotlightRelation(firstSeat: number, secondSeat: number, durationMs = 1800): void {
    this.activePair = [firstSeat, secondSeat];
    this.timers.push(window.setTimeout(() => {
      if (this.activePair?.[0] === firstSeat && this.activePair[1] === secondSeat) {
        this.activePair = null;
      }
    }, durationMs));
  }

  /** 只播放白天结算；夜间、淘汰与出生由下一次用户动作触发。 */
  playForaging(
    result: EcologyDayResult,
    msPerPair: number,
    onDone: () => void,
  ): void {
    if (this.busy) return;
    this.clearTimers();
    this.busy = true;
    result.pairs.forEach((pair, pairIndex) => {
      this.timers.push(window.setTimeout(() => {
        this.activePair = pair.seats;
        this.focusSeat = null;
        if (this.learningMode) {
          this.temporaryMoves.clear();
          this.temporaryMoves.set(pair.seats[0], pair.strategies[0]);
          this.temporaryMoves.set(pair.seats[1], pair.strategies[1]);
        }
      }, pairIndex * msPerPair));
      this.timers.push(window.setTimeout(() => {
        const first = this.seats[pair.seats[0]];
        const second = this.seats[pair.seats[1]];
        if (first) first.reserve = Math.max(0, first.reserve + pair.payoffs[0]);
        if (second) second.reserve = Math.max(0, second.reserve + pair.payoffs[1]);
      }, pairIndex * msPerPair + Math.floor(msPerPair * 0.55)));
    });
    this.timers.push(window.setTimeout(() => {
      this.activePair = null;
      this.temporaryMoves.clear();
      this.busy = false;
      onDone();
    }, result.pairs.length * msPerPair + 180));
  }

  playNight(result: EcologyDayResult, onDone: () => void): void {
    if (this.busy) return;
    this.busy = true;
    this.foodUnits = 0;
    this.activePair = null;
    this.timers.push(window.setTimeout(() => {
      for (const seat of this.seats) {
        if (!seat.alive) continue;
        seat.reserve = Math.max(0, seat.reserve - 25);
      }
    }, 260));
    this.timers.push(window.setTimeout(() => {
      this.busy = false;
      onDone();
    }, result.eliminatedSeats.length > 0 ? 850 : 650));
  }

  playElimination(result: EcologyDayResult, onDone: () => void): void {
    if (result.eliminatedSeats.length === 0) {
      onDone();
      return;
    }
    this.busy = true;
    for (const index of result.eliminatedSeats) {
      const seat = this.seats[index];
      if (seat) seat.reserve = 0;
    }
    this.timers.push(window.setTimeout(() => {
      for (const index of result.eliminatedSeats) {
        const seat = this.seats[index];
        if (seat) seat.alive = false;
      }
    }, 650));
    this.timers.push(window.setTimeout(() => {
      this.busy = false;
      onDone();
    }, 1150));
  }

  playBirth(result: EcologyDayResult, onDone: () => void): void {
    if (!result.birth) {
      onDone();
      return;
    }
    this.busy = true;
    const { parentSeat, childSeat } = result.birth;
    const finalParent = result.state.seats[parentSeat];
    const finalChild = result.state.seats[childSeat];
    if (finalParent) this.seats[parentSeat] = { ...finalParent };
    this.activePair = [parentSeat, childSeat];
    this.timers.push(window.setTimeout(() => {
      if (finalChild) this.seats[childSeat] = { ...finalChild };
    }, 600));
    this.timers.push(window.setTimeout(() => {
      this.busy = false;
      onDone();
    }, 1450));
  }

  destroy(): void {
    this.clearTimers();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  private startLoop(): void {
    if (this.raf) return;
    const loop = () => {
      this.render((performance.now() - this.startedAt) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private positions(width: number, height: number): Array<{ x: number; y: number }> {
    const cx = width / 2;
    const cy = height / 2 + 2;
    const radiusX = Math.min(width * 0.37, 245);
    const radiusY = Math.min(height * 0.36, 145);
    return this.seats.map((_, index) => {
      const angle = -Math.PI / 2 + (index / this.seats.length) * Math.PI * 2;
      return {
        x: cx + Math.cos(angle) * radiusX,
        y: cy + Math.sin(angle) * radiusY,
      };
    });
  }

  private render(t: number): void {
    const { canvas, ctx } = this;
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth || 680;
      canvas.height = canvas.clientHeight || 390;
    }
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (this.seats.length === 0) return;
    const positions = this.positions(width, height);
    const sketch: SketchContext = { ctx, t };

    if (this.activePair) {
      const first = positions[this.activePair[0]]!;
      const second = positions[this.activePair[1]]!;
      ctx.save();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(second.x, second.y);
      ctx.stroke();
      ctx.restore();
    }

    const foodColumns = Math.min(4, Math.max(1, this.foodUnits));
    for (let i = 0; i < this.foodUnits; i++) {
      const col = i % foodColumns;
      const row = Math.floor(i / foodColumns);
      const x = width / 2 + (col - (foodColumns - 1) / 2) * 42;
      const y = height / 2 - 18 + row * 42;
      drawFood(sketch, x, y, 0.45);
    }

    for (let index = 0; index < this.seats.length; index++) {
      const seat = this.seats[index]!;
      const point = positions[index]!;
      const focused = this.activePair?.includes(index) ?? false;
      const individuallyFocused = this.focusSeat === index;
      const dimmed = (this.activePair !== null && !focused) ||
        (this.focusSeat !== null && !individuallyFocused);
      ctx.save();
      if (dimmed) ctx.globalAlpha = 0.3;
      if (!seat.alive) {
        ctx.strokeStyle = "rgba(65,64,62,0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(point.x, point.y + 5, 23, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(65,64,62,0.55)";
        ctx.font = "14px 'Xiaolai','KaiTi',serif";
        ctx.textAlign = "center";
        ctx.fillText("空席", point.x, point.y + 10);
        ctx.restore();
        continue;
      }

      if (seat.reserve <= 0) {
        ctx.filter = "grayscale(1)";
        ctx.globalAlpha *= 0.55;
      }
      if (individuallyFocused) {
        ctx.fillStyle = "rgba(217,164,65,0.2)";
        ctx.beginPath();
        ctx.arc(point.x, point.y + 4, 34, 0, Math.PI * 2);
        ctx.fill();
      }
      const visibleMove = this.learningMode
        ? (this.temporaryMoves.get(index) ?? null)
        : seat.strategy;
      drawPeep(sketch, point.x, point.y + 24, 0.5, {
        dir: 1,
        hat: visibleMove,
        face: seat.reserve <= 50 ? "sad" : focused ? "angry" : "calm",
        frontFace: true,
      });
      ctx.filter = "none";

      const ratio = Math.max(0, Math.min(1, seat.reserve / 250));
      ctx.fillStyle = "rgba(65,64,62,0.14)";
      ctx.fillRect(point.x - 17, point.y + 35, 34, 5);
      ctx.fillStyle = seat.reserve <= 50 ? DANGER : ratio < 0.5 ? GOLD : "#5a8f5a";
      ctx.fillRect(point.x - 17, point.y + 35, 34 * ratio, 5);

      if (this.learningMode) {
        const learner = this.learners.get(seat.id);
        const filled = (learner?.tendency ?? 2) + 1;
        for (let level = 0; level < 5; level++) {
          ctx.beginPath();
          ctx.arc(point.x - 12 + level * 6, point.y + 46, 2.1, 0, Math.PI * 2);
          ctx.fillStyle = level < filled ? DANGER : "rgba(65,64,62,0.18)";
          ctx.fill();
        }
      }

      if (focused) {
        ctx.font = "bold 15px 'Xiaolai','KaiTi',serif";
        ctx.fillStyle = seat.reserve <= 50 ? DANGER : INK;
        ctx.textAlign = "center";
        ctx.fillText(String(Math.round(seat.reserve)), point.x, point.y - 54);
      }
      ctx.restore();
    }
  }
}
