/**
 * 固定策略实验共用的16席圆环场景。
 * 第二关用淡色关系网表示本代真实循环赛，并逐个点亮个体与其余所有人的配对；
 * 其他关卡仍可只显示当前代表性配对。演化一代后最多一人换帽。
 * 库存、空席、淘汰与出生由独立生态场景承载，不接入本组件。
 */

import type { SketchContext } from "./sketchAnimals";
import { drawPeep, HAT_COLORS, type PeepFace } from "./sketchPeeps";
import {
  playRound,
  type Move,
  type PayoffParams,
} from "../core/hawkDove";
import {
  createSeededRandom,
  shuffleWith,
  type RandomSource,
} from "../core/random";

interface Agent {
  kind: Move;
  changeAnim: number; // 变色动画 1→0
  changeTo: Move;
  highlight: boolean;
  dimmed: boolean; // 未参与当前配对时变淡
  nextBlink: number;
  blinkUntil: number;
  jitterSeed: number;
}

export interface TournamentResult {
  scores: number[];
  bestIdx: number;
  worstIdx: number;
  bestKind: Move;
  worstKind: Move;
  /** 若发生替换，返回被替换者的 index（即 worstIdx，它的帽子应换成 bestKind） */
  changedIdx: number | null;
  changedTo: Move | null;
}

const INK = "#41403e";
const LINK_ACTIVE = "#d9a441";

export class PopulationScene {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private startTime = performance.now();
  private agents: Agent[] = [];
  private scores: number[] = [];
  /** 一代结算后保留所有人的分数，直到下一次演出或重置。 */
  private showAllScores = false;
  private lastBestScore = 0;
  private lastWorstScore = 0;
  /** 当前正在被「聚光」的个体（锦标赛逐个结算用） */
  private focusIdx = -1;
  /** 其他关卡当前抽样展示的配对。 */
  private activePair: [number, number] | null = null;
  /** 第二关循环赛演出：聚光者与其余所有人的配对。 */
  private activeAgainstGroup = false;
  private busy = false;
  private timers: number[] = [];
  private simulationRandom: RandomSource = createSeededRandom(20260921);

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 2D 上下文");
    this.ctx = ctx;
  }

  get size(): number {
    return this.agents.length;
  }

  isBusy(): boolean {
    return this.busy;
  }

  setup(
    count: number,
    initialHawks: number,
    shuffleKinds = true,
    seed = 20260921,
  ): void {
    this.clearTimers();
    this.simulationRandom = createSeededRandom(seed);
    this.agents = [];
    this.scores = new Array(count).fill(0);
    this.showAllScores = false;
    const kinds: Move[] = [];
    for (let i = 0; i < count; i++) kinds.push(i < initialHawks ? "hawk" : "dove");
    if (shuffleKinds) shuffleWith(kinds, this.simulationRandom);
    const t = this.now();
    for (const kind of kinds) {
      this.agents.push({
        kind,
        changeAnim: 0,
        changeTo: kind,
        highlight: false,
        dimmed: false,
        nextBlink: t + 1 + Math.random() * 4,
        blinkUntil: -1,
        jitterSeed: Math.random() * 100,
      });
    }
    this.focusIdx = -1;
    this.activePair = null;
    this.activeAgainstGroup = false;
    this.busy = false;
    this.startLoop();
  }

  kinds(): Move[] {
    return this.agents.map((a) => a.kind);
  }

  hawkCount(): number {
    return this.agents.filter((a) => a.kind === "hawk").length;
  }

  /**
 * 播放一整轮循环赛：每个个体与其余所有个体各相遇一次，
 * 逐个聚光、显示真实累计总收益，最后低收益策略被高收益策略取代。
   * @param msPerAgent 每个个体的结算时长（毫秒）
   */
  playTournament(
    p: PayoffParams,
    msPerAgent: number,
    onDone: (r: TournamentResult) => void,
    settleMs = 1400,
  ): void {
    if (this.busy) return;
    this.busy = true;
    this.scores = new Array(this.agents.length).fill(0);
    this.showAllScores = false;
    this.focusIdx = -1;
    this.activeAgainstGroup = false;

    const n = this.agents.length;
    const totals = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        totals[i]! += playRound(this.agents[i]!.kind, this.agents[j]!.kind, p)[0];
      }
    }

    // 逐个聚光：第 i 步时把第 i 只的得分累加显示
    for (let i = 0; i < n; i++) {
      this.timers.push(
        window.setTimeout(() => {
          this.focusIdx = i;
          this.activePair = null;
          this.activeAgainstGroup = true;
          for (let k = 0; k < n; k++) {
            this.agents[k]!.dimmed = k !== i;
          }
          // 累加到「进行到第 i 只为止」的部分得分（让观众看到数字在长）
          for (let k = 0; k <= i; k++) this.scores[k] = totals[k]!;
        }, i * msPerAgent),
      );
    }

    // 收尾：找出最高/最低，替换，回调
    this.timers.push(
      window.setTimeout(() => {
        let bestIdx = 0;
        let worstIdx = 0;
        for (let i = 1; i < n; i++) {
          if (totals[i]! > totals[bestIdx]!) bestIdx = i;
          if (totals[i]! < totals[worstIdx]!) worstIdx = i;
        }
        const bestKind = this.agents[bestIdx]!.kind;
        const worstKind = this.agents[worstIdx]!.kind;
        this.lastBestScore = totals[bestIdx]!;
        this.lastWorstScore = totals[worstIdx]!;
        this.showAllScores = true;

        let changedIdx: number | null = null;
        let changedTo: Move | null = null;
        if (bestKind !== worstKind) {
          changedIdx = worstIdx;
          changedTo = bestKind;
          const a = this.agents[worstIdx]!;
          a.changeTo = bestKind;
          a.changeAnim = 1;
          a.highlight = true;
          this.timers.push(
            window.setTimeout(() => (a.highlight = false), 2200),
          );
        }

        // 解除聚光/变淡
        this.focusIdx = -1;
        this.activePair = null;
        this.activeAgainstGroup = false;
        for (const a of this.agents) a.dimmed = false;

        const result: TournamentResult = {
          scores: totals,
          bestIdx,
          worstIdx,
          bestKind,
          worstKind,
          changedIdx,
          changedTo,
        };
        this.timers.push(
          window.setTimeout(() => {
            this.busy = false;
            onDone(result);
          }, settleMs),
        );
      }, n * msPerAgent + 300),
    );
  }

  /** 突变：某个体换色并短暂高亮（第三关入侵用） */
  mutate(index: number, to: Move): void {
    const a = this.agents[index];
    if (!a) return;
    a.changeTo = to;
    a.changeAnim = 1;
    a.highlight = true;
    this.timers.push(window.setTimeout(() => (a.highlight = false), 1800));
  }

  /** 向当前群体投放一个相反策略，并清掉上一轮的得分标签。 */
  inject(to: Move): number | null {
    const candidates = this.agents
      .map((agent, index) => (agent.kind !== to ? index : -1))
      .filter((index) => index >= 0);
    if (candidates.length === 0) return null;
    const index = candidates[Math.floor(this.simulationRandom.next() * candidates.length)]!;
    this.scores.fill(0);
    this.showAllScores = false;
    this.focusIdx = -1;
    this.activePair = null;
    this.activeAgainstGroup = false;
    for (const agent of this.agents) agent.dimmed = false;
    this.mutate(index, to);
    return index;
  }

  /** 指定个体换色（无高亮），第三关扩散用 */
  evolveOne(index: number, to: Move): void {
    const a = this.agents[index];
    if (!a) return;
    a.changeTo = to;
    a.changeAnim = 1;
  }

  /** 短暂聚光一个个体并点亮它与群体的关系线（分步演化演示用）。 */
  spotlight(index: number, durationMs = 520): void {
    if (!this.agents[index]) return;
    this.focusIdx = index;
    // 选择圆环对面的个体，保证当前互动线足够长，不会被相邻小人遮住。
    const opposite = (index + Math.floor(this.agents.length / 2)) % this.agents.length;
    this.activePair = [index, opposite];
    this.activeAgainstGroup = false;
    for (let i = 0; i < this.agents.length; i++) {
      this.agents[i]!.dimmed = !this.activePair.includes(i);
    }
    this.timers.push(window.setTimeout(() => {
      if (this.focusIdx !== index) return;
      this.focusIdx = -1;
      this.activePair = null;
      this.activeAgainstGroup = false;
      for (const agent of this.agents) agent.dimmed = false;
    }, durationMs));
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

  private now(): number {
    return (performance.now() - this.startTime) / 1000;
  }

  private startLoop(): void {
    if (this.raf) return;
    const loop = () => {
      this.render(this.now());
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** 大画布用圆形关系网；矮画布默认用网格，第三关可指定紧凑圆环。 */
  private positions(): Array<{ x: number; y: number }> {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const n = this.agents.length;
    const compactCircle = this.canvas.dataset.layout === "compact-circle";
    const linkedCircle = this.canvas.dataset.layout === "linked-circle";

    if (compactCircle) {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.max(30, Math.min(w / 2 - 36, h / 2 - 42));
      const out: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
        out.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      }
      return out;
    }

    if (linkedCircle) {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.max(64, Math.min(w / 2 - 60, h / 2 - 50));
      const out: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
        out.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      }
      return out;
    }

    if (h < 260) {
      const cols = Math.min(6, n);
      const rows = Math.ceil(n / cols);
      const padX = 28;
      const padY = 42;
      const usableW = Math.max(1, w - padX * 2);
      const usableH = Math.max(1, h - padY * 2);
      const out: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        out.push({
          x: padX + (cols === 1 ? usableW / 2 : (col / (cols - 1)) * usableW),
          y: padY + (rows === 1 ? usableH / 2 : (row / (rows - 1)) * usableH),
        });
      }
      return out;
    }

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 84;
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }


  private render(t: number): void {
    const { ctx, canvas } = this;
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth || 560;
      canvas.height = canvas.clientHeight || 480;
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const n = this.agents.length;
    if (n === 0) return;

    const pos = this.positions();
    const sc: SketchContext = { ctx, t };
    const focus = this.focusIdx;
    const compact = h < 260;
    const compactCircle = canvas.dataset.layout === "compact-circle";
    const linkedCircle = canvas.dataset.layout === "linked-circle";
    // 圆环较小时按相邻席位距离缩放角色，避免左右两侧沿竖直方向重叠；
    // 舞台空间充足时则恢复更醒目的尺寸。
    const neighborDistance = n > 1
      ? Math.hypot(pos[1]!.x - pos[0]!.x, pos[1]!.y - pos[0]!.y)
      : 64;
    const linkedScale = Math.min(0.58, Math.max(0.4, neighborDistance / 108));
    const peepScale = compact ? 0.43 : linkedCircle ? linkedScale : 0.62;

    const roundRobinNetwork = canvas.dataset.network === "round-robin";

    // 淡线表示本代循环赛中实际发生的全部配对。
    if (roundRobinNetwork && this.busy) {
      ctx.save();
      ctx.strokeStyle = "rgba(65,64,62,0.10)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          ctx.beginPath();
          ctx.moveTo(pos[i]!.x, pos[i]!.y);
          ctx.lineTo(pos[j]!.x, pos[j]!.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 聚光者与其余15人的实际配对一起点亮。
    if (this.activeAgainstGroup && focus >= 0) {
      const fp = pos[focus]!;
      ctx.save();
      ctx.strokeStyle = LINK_ACTIVE;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        if (i === focus) continue;
        const tp = pos[i]!;
        ctx.beginPath();
        ctx.moveTo(fp.x, fp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(217,164,65,0.18)";
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 其他关卡只显示当前代表性配对。
    if (this.activePair) {
      const [from, to] = this.activePair;
      const fp = pos[from]!;
      const tp = pos[to]!;
      ctx.save();
      ctx.strokeStyle = LINK_ACTIVE;
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      const dx = tp.x - fp.x;
      const dy = tp.y - fp.y;
      const dist = Math.hypot(dx, dy) || 1;
      ctx.beginPath();
      ctx.moveTo(fp.x + (dx / dist) * 24, fp.y + (dy / dist) * 24);
      ctx.lineTo(fp.x + (dx / dist) * (dist - 24), fp.y + (dy / dist) * (dist - 24));
      ctx.stroke();
      ctx.fillStyle = "rgba(217,164,65,0.16)";
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 每个小人
    for (let i = 0; i < n; i++) {
      const a = this.agents[i]!;
      const p = pos[i]!;

      if (a.changeAnim > 0) {
        a.changeAnim = Math.max(0, a.changeAnim - 0.035);
        if (a.changeAnim <= 0.5 && a.kind !== a.changeTo) a.kind = a.changeTo;
      }

      if (a.highlight) {
        ctx.save();
        ctx.globalAlpha = 0.28 + Math.sin(t * 8) * 0.1;
        ctx.fillStyle = HAT_COLORS[a.changeTo];
        ctx.beginPath();
        ctx.arc(p.x, p.y, compactCircle ? 23 : compact ? 28 : 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const bounce = a.changeAnim > 0 ? Math.sin(a.changeAnim * Math.PI) * 13 : 0;

      if (t >= a.nextBlink) {
        a.blinkUntil = t + 0.15;
        a.nextBlink = t + 2.5 + Math.random() * 3.5;
      }

      const face: PeepFace = i === focus ? "angry" : "calm";

      ctx.save();
      if (a.dimmed && focus >= 0 && i !== focus) ctx.globalAlpha = 0.35;
      drawPeep(sc, p.x, p.y + (compact ? 18 : 26) - bounce, peepScale, {
        dir: 1,
        hat: a.kind,
        face,
        frontFace: true,
        blinkUntil: a.blinkUntil,
      });
      ctx.restore();

      // 聚光时显示当前分数；结算后保留全体分数，供玩家自己比较。
      if ((this.busy && i === focus) || this.showAllScores) {
        ctx.save();
        const isFocus = i === focus;
        ctx.font = isFocus
          ? "bold 17px 'Xiaolai','Kaiti SC','KaiTi',serif"
          : "14px 'Xiaolai','Kaiti SC','KaiTi',serif";
        ctx.textAlign = "center";
        const scoreValue = this.scores[i]!;
        const allTied = Math.abs(this.lastBestScore - this.lastWorstScore) < 1e-9;
        ctx.fillStyle = isFocus
          ? LINK_ACTIVE
          : allTied
            ? INK
            : Math.abs(scoreValue - this.lastBestScore) < 1e-9
              ? "#2f7d4a"
              : "#c0392b";
        const score = Math.round(this.scores[i]! * 10) / 10;
        // 分数沿圆环向外排：顶部向上、两侧向外、底部向下，
        // 避免所有标签都挤在头顶并与相邻人物重叠。
        const radialX = p.x - w / 2;
        const radialY = p.y - h / 2;
        const radialLength = Math.hypot(radialX, radialY) || 1;
        const scoreOffset = linkedCircle || compactCircle ? 64 : 68;
        let scoreX = p.x + (radialX / radialLength) * scoreOffset;
        let scoreY = p.y + (radialY / radialLength) * scoreOffset;
        // 圆环顶部没有足够的向外空间时，标签改放到人物侧上方，
        // 避免被画布边界推回帽子正上方。
        if (scoreY < 30) {
          const side = radialX < 0 ? -1 : 1;
          scoreX = p.x + side * 46;
          scoreY = Math.max(24, p.y - 6);
        }
        ctx.fillText(
          `${score}`,
          Math.max(24, Math.min(w - 24, scoreX)),
          Math.max(18, Math.min(h - 8, scoreY)),
        );
        ctx.restore();
      }
    }
  }
}
