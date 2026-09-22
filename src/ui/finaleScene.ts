import { drawPeep, HAT_COLORS } from './sketchPeeps';

export type FinaleBeat = 'rewind' | 'ripple' | 'layers' | 'note' | 'hats';
export type FinaleLayer = 'payoff' | 'resources' | 'learning' | 'rules';
type Hat = 'hawk' | 'dove' | null;
type PeepContext = Parameters<typeof drawPeep>[0];

const LAYERS: Array<{ key: FinaleLayer; label: string }> = [
  { key: 'payoff', label: '收益与冲突代价' },
  { key: 'resources', label: '资源与生存压力' },
  { key: 'learning', label: '记忆与学习' },
  { key: 'rules', label: '组织与规则' },
];

const INK = '#494640';
const MUTED = '#8c877d';
const PAPER = '#faf8f1';
const GOLD = '#d7a63d';

/** Canvas-rendered closing scene for the five-beat finale. */
export class FinaleScene {
  private readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private rafId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private running = false;
  private destroyed = false;
  private width = 620;
  private height = 520;
  private beat: FinaleBeat = 'rewind';
  private beatStartedAt = 0;
  private rippleStartedAt = -1;
  private activeLayer: FinaleLayer | null = null;
  private rewindStep = 0;
  private selectedPeep = 4;
  private hats: Hat[] = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 'dove' : 'hawk'));

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  setup(): void {
    if (this.running) return;
    this.destroyed = false;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;
    this.hats = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 'dove' : 'hawk'));
    this.selectedPeep = 4;
    this.rippleStartedAt = -1;
    this.activeLayer = null;
    this.rewindStep = 0;
    this.running = true;
    this.beatStartedAt = this.now();
    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    } else {
      window.addEventListener('resize', this.resize);
    }
    this.rafId = requestAnimationFrame(this.frame);
  }

  setBeat(beat: FinaleBeat): void {
    if (this.destroyed) return;
    this.beat = beat;
    this.beatStartedAt = this.now();
  }

  setRewind(step: number): void {
    this.rewindStep = Math.max(0, Math.min(5, Math.round(step)));
  }

  triggerRipple(): void {
    if (this.destroyed) return;
    this.selectedPeep = (this.selectedPeep + 5) % this.hats.length;
    const current = this.hats[this.selectedPeep];
    this.hats[this.selectedPeep] = current === 'hawk' ? 'dove' : 'hawk';
    this.rippleStartedAt = this.now();
  }

  setLayer(layer: FinaleLayer): void {
    if (this.destroyed) return;
    this.activeLayer = layer;
  }

  removeHat(index: number): void {
    if (this.destroyed || !Number.isInteger(index) || index < 0 || index >= this.hats.length) return;
    this.hats[index] = null;
  }

  removeNearestHat(x: number, y: number): number {
    const cx = this.width / 2;
    const cy = this.height * 0.52;
    const radius = Math.min(this.width, this.height) * 0.245;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.hats.length; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / this.hats.length;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      const distance = Math.hypot(px - x, py - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    }
    this.removeHat(nearest);
    return nearest;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.resize);
  }

  private readonly resize = (): void => {
    if (!this.ctx || this.destroyed) return;
    this.width = Math.max(1, Math.round(this.canvas.clientWidth || 620));
    this.height = Math.max(1, Math.round(this.canvas.clientHeight || 520));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  };

  private readonly frame = (timestamp: number): void => {
    if (!this.running || this.destroyed || !this.ctx) return;
    this.render(timestamp);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private render(timestamp: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = timestamp || this.now();
    const t = now / 1000;
    const elapsed = Math.max(0, (now - this.beatStartedAt) / 1000);
    const w = this.width;
    const h = this.height;
    const unit = Math.min(w / 620, h / 520);
    const cx = w / 2;
    const cy = h * 0.52;
    const peepRadius = Math.min(w, h) * 0.245;
    const peepScale = Math.max(0.36, unit * 0.58);

    ctx.clearRect(0, 0, w, h);
    this.drawPaperGrain(ctx, w, h, t);
    this.drawHeading(ctx, w, unit);

    switch (this.beat) {
      case 'rewind':
        this.drawRewind(ctx, cx, cy, peepRadius, peepScale, t, elapsed, unit);
        break;
      case 'ripple':
        this.drawCrowd(ctx, cx, cy, peepRadius, peepScale, t, 1);
        this.drawRipple(ctx, cx, cy, peepRadius, now, unit);
        this.drawBeatCaption(ctx, w, h, '一次选择，会在群体里留下回声。', unit);
        break;
      case 'layers':
        this.drawLayers(ctx, cx, cy, peepRadius, peepScale, t, unit, w, h);
        break;
      case 'note':
        this.drawCrowd(ctx, cx, cy, peepRadius, peepScale, t, 0.2);
        this.drawNote(ctx, cx, cy, unit, w, h);
        break;
      case 'hats':
        this.drawCrowd(ctx, cx, cy, peepRadius, peepScale, t, 1);
        this.drawHatsCaption(ctx, w, h, unit);
        break;
    }
  }

  private drawPaperGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(115, 107, 91, 0.055)';
    ctx.lineWidth = 1;
    const drift = Math.sin(t * 0.14) * 2;
    for (let y = 34; y < h; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y + drift);
      ctx.lineTo(w, y + drift);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHeading(ctx: CanvasRenderingContext2D, w: number, unit: number): void {
    const title: Record<FinaleBeat, string> = {
      rewind: '回到最初的一次相遇',
      ripple: '一次选择如何扩散',
      layers: '把镜头拉到整个系统',
      note: '签收这次实验的结果',
      hats: '摘下帽子，重新看见彼此',
    };
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.max(17, 21 * unit)}px "Microsoft YaHei", "Noto Serif SC", serif`;
    ctx.fillText(title[this.beat], w / 2, Math.max(24, 34 * unit));
    ctx.restore();
  }

  private drawRewind(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    scale: number,
    t: number,
    elapsed: number,
    unit: number,
  ): void {
    const fade = Math.max(this.rewindStep / 5, this.ease((elapsed - 0.65) / 1.35) * 0.18);
    this.drawCrowd(ctx, cx, cy, radius, scale, t, fade * 0.84);

    ctx.save();
    ctx.globalAlpha = 1 - fade * 0.4;
    const context: PeepContext = { ctx, t };
    const pairScale = Math.max(0.45, scale * 1.02);
    drawPeep(context, cx - 39 * unit, cy + 22 * unit, pairScale, {
      dir: 1,
      face: 'calm',
      hat: 'dove',
      frontFace: true,
      holdingFood: true,
    });
    drawPeep(context, cx + 39 * unit, cy + 22 * unit, pairScale, {
      dir: -1,
      face: 'calm',
      hat: 'hawk',
      frontFace: true,
      holdingFood: true,
    });
    this.drawSharedFood(ctx, cx, cy + 38 * unit, unit);
    ctx.restore();

    this.drawBeatCaption(ctx, this.width, this.height, '同一个行为，放进不同的群体与环境，会得到不同结果。', unit);
  }

  private drawSharedFood(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#e5b85e';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, 1.5 * unit);
    ctx.beginPath();
    ctx.ellipse(0, 0, 15 * unit, 6 * unit, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12 * unit, 4 * unit);
    ctx.quadraticCurveTo(0, 12 * unit, 12 * unit, 4 * unit);
    ctx.stroke();
    ctx.fillStyle = '#b8793e';
    for (const [dx, dy] of [[-5, -1], [2, -3], [7, 0]] as Array<[number, number]>) {
      ctx.beginPath();
      ctx.arc(dx * unit, dy * unit, 1.6 * unit, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCrowd(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    scale: number,
    t: number,
    alpha: number,
  ): void {
    if (alpha <= 0.005) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.strokeStyle = 'rgba(73, 70, 64, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    const context: PeepContext = { ctx, t };
    for (let i = 0; i < this.hats.length; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / this.hats.length;
      const x = cx + Math.cos(angle) * radius;
      const groundY = cy + Math.sin(angle) * radius;
      const selected = this.beat === 'ripple' && i === this.selectedPeep;
      if (selected) this.drawSelectedHalo(ctx, x, groundY - 24 * scale, scale);
      drawPeep(context, x, groundY, scale, {
        dir: Math.cos(angle) >= 0 ? 1 : -1,
        face: selected ? 'happy' : 'calm',
        hat: this.hats[i],
        frontFace: true,
      });
    }
    ctx.restore();
  }

  private drawSelectedHalo(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(215, 166, 61, 0.82)';
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.beginPath();
    ctx.ellipse(x, y, 20 * scale, 27 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawRipple(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, now: number, unit: number): void {
    if (this.rippleStartedAt < 0) return;
    const age = Math.max(0, (now - this.rippleStartedAt) / 1000);
    if (age > 2.3) return;
    const peepAngle = -Math.PI / 2 + (Math.PI * 2 * this.selectedPeep) / this.hats.length;
    const x = cx + Math.cos(peepAngle) * radius;
    const y = cy + Math.sin(peepAngle) * radius - 28 * unit;
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.2, 2 * unit);
    for (let ring = 0; ring < 3; ring += 1) {
      const progress = (age * 0.72 + ring / 3) % 1;
      const r = progress * Math.min(this.width, this.height) * 0.46;
      ctx.globalAlpha = (1 - progress) * 0.42;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLayers(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    scale: number,
    t: number,
    unit: number,
    w: number,
    h: number,
  ): void {
    const maxR = Math.min(w, h) * 0.455;
    const layerGap = Math.max(8, (maxR - radius - 12 * unit) / 4);
    ctx.save();
    for (let i = 0; i < LAYERS.length; i += 1) {
      const item = LAYERS[i]!;
      const isActive = this.activeLayer === item.key;
      const r = radius + 12 * unit + layerGap * (i + 1);
      ctx.strokeStyle = isActive ? 'rgba(215, 166, 61, 0.96)' : 'rgba(73, 70, 64, 0.18)';
      ctx.lineWidth = isActive ? Math.max(2, 2.6 * unit) : Math.max(1, 1.2 * unit);
      ctx.setLineDash(isActive ? [] : [5 * unit, 6 * unit]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (isActive) this.drawLayerLabel(ctx, cx, cy, r, item.label, unit);
    }
    ctx.setLineDash([]);
    ctx.restore();

    this.drawCrowd(ctx, cx, cy, radius, scale, t, 0.94);
    const prompt = this.activeLayer
      ? `想改变群体结果，也可以改变「${LAYERS.find((item) => item.key === this.activeLayer)?.label}」。`
      : '选择一层，看看改变可以从哪里开始。';
    this.drawBeatCaption(ctx, w, h, prompt, unit);
  }

  private drawLayerLabel(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, label: string, unit: number): void {
    const x = cx;
    const y = cy - radius;
    ctx.save();
    ctx.font = `600 ${Math.max(13, 14 * unit)}px "Microsoft YaHei", "Noto Serif SC", serif`;
    const width = ctx.measureText(label).width + 18 * unit;
    const height = 25 * unit;
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, 1.3 * unit);
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, 4 * unit);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  private drawNote(ctx: CanvasRenderingContext2D, cx: number, cy: number, unit: number, w: number, h: number): void {
    const cardW = Math.min(w * 0.74, 430 * unit);
    const cardH = Math.min(h * 0.49, 218 * unit);
    const x = cx - cardW / 2;
    const y = cy - cardH / 2 + 4 * unit;
    ctx.save();
    ctx.shadowColor = 'rgba(67, 61, 52, 0.16)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 5 * unit;
    ctx.shadowOffsetY = 6 * unit;
    ctx.fillStyle = '#fffdf7';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, 1.8 * unit);
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 2 * unit);
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${Math.max(12, 13 * unit)}px "Microsoft YaHei", "Noto Serif SC", serif`;
    ctx.fillText('本次观察记录', x + 22 * unit, y + 28 * unit);
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.max(16, 19 * unit)}px "Microsoft YaHei", "Noto Serif SC", serif`;
    ctx.fillText('结果来自一组具体条件。', x + 22 * unit, y + 72 * unit);
    ctx.font = `400 ${Math.max(13, 15 * unit)}px "Microsoft YaHei", "Noto Serif SC", serif`;
    ctx.fillStyle = '#716c62';
    ctx.fillText('收益、资源、学习与规则共同影响了群体。', x + 22 * unit, y + 112 * unit);
    ctx.fillText('模型帮助我们观察关系，不给出唯一答案。', x + 22 * unit, y + 144 * unit);
    ctx.strokeStyle = 'rgba(73, 70, 64, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 22 * unit, y + cardH - 31 * unit);
    ctx.lineTo(x + cardW - 22 * unit, y + cardH - 31 * unit);
    ctx.stroke();
    ctx.fillStyle = '#a7a095';
    ctx.font = `400 ${Math.max(11, 12 * unit)}px "Microsoft YaHei", "Noto Serif SC", serif`;
    ctx.fillText('固定人数 · 简化收益 · 有限规则', x + 22 * unit, y + cardH - 15 * unit);
    ctx.restore();
  }

  private drawHatsCaption(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number): void {
    const removed = this.hats.filter((hat) => hat === null).length;
    const allRemoved = removed === this.hats.length;
    this.drawBeatCaption(
      ctx,
      w,
      h,
      allRemoved
        ? '鹰与鸽是行为，不是两种人。'
        : removed > 0
          ? '帽子可以摘下；人在新的环境里，也能重新选择。'
          : '试着摘下几顶帽子，看看帽子下面是谁。',
      unit,
    );
  }

  private drawBeatCaption(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, unit: number): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#716d65';
    ctx.font = `400 ${Math.max(13, 15 * unit)}px "Microsoft YaHei", "Noto Serif SC", serif`;
    ctx.fillText(text, w / 2, h - Math.max(24, 30 * unit), Math.max(200, w - 30 * unit));
    ctx.restore();
  }

  private ease(value: number): number {
    const x = Math.max(0, Math.min(1, value));
    return x * x * (3 - 2 * x);
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}
