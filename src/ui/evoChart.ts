/**
 * 迷你演化曲线图：手绘风折线，展示鹰的比例或数量随代数的变化。
 */

export interface EvoChartOptions {
  width?: number;
  height?: number;
  generations?: number;
  /** 横轴代数标签 */
  label?: string;
  /** 预告模式：曲线画到 cutoff 处停住，末尾画一个「?」 */
  teaser?: boolean;
  /** teaser 模式下曲线画到的位置（0~1），默认 0.45 */
  cutoff?: number;
  /** 纵轴最大值；默认 1（比例模式）。 */
  maxValue?: number;
  /** 数量模式的终点单位。 */
  valueLabel?: string;
  /** 已经展示过的最后一个数据点下标；此前的折线立即显示，只动画新增部分。 */
  animateFromIndex?: number;
}

/** 绘制比例序列（0~1），带动画。返回停止函数。 */
export function drawEvoChart(
  canvas: HTMLCanvasElement,
  series: number[],
  opts: EvoChartOptions = {},
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 2D 上下文");

  const w = (canvas.width = opts.width ?? 560);
  const h = (canvas.height = opts.height ?? 220);
  const padL = 76;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const generations = opts.generations ?? series.length - 1;

  const toX = (i: number) => padL + ((w - padL - padR) * i) / generations;
  const maxValue = opts.maxValue ?? 1;
  const toY = (v: number) => padT + (h - padT - padB) * (1 - v / maxValue);
  const lastIndex = Math.max(0, series.length - 1);
  const animateFromIndex = Math.max(
    0,
    Math.min(opts.animateFromIndex ?? 0, lastIndex),
  );

  const pointAt = (i: number) => ({
    x: toX(i) + Math.sin(i * 7.3) * 1.2,
    y: toY(series[i] ?? 0) + Math.cos(i * 5.1) * 1.2,
  });

  let raf = 0;
  const start = performance.now();
  const DURATION = 1800;

  const frame = () => {
    const progress = Math.min(1, (performance.now() - start) / DURATION);
    ctx.clearRect(0, 0, w, h);

    // 坐标轴（手绘抖动线）
    ctx.strokeStyle = "#41403e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    wobblyLine(ctx, padL, padT, padL, h - padB);
    wobblyLine(ctx, padL, h - padB, w - padR, h - padB);

    // 刻度标签
    ctx.fillStyle = "#736e66";
    ctx.font = "15px 'Xiaolai','Kaiti SC','KaiTi',serif";
    ctx.textAlign = "right";
    ctx.fillText(opts.maxValue ? `${maxValue}只鹰` : "全是鹰", padL - 8, padT + 10);
    ctx.fillText(opts.maxValue ? "0只鹰" : "全是鸽", padL - 8, h - padB);
    ctx.textAlign = "center";
    ctx.fillText(opts.label ?? "时间（代数）→", (padL + w - padR) / 2, h - 8);

    // 旧折线立即保留，只让这次新增的线段从上次终点继续生长。
    const visibleEnd =
      animateFromIndex + (lastIndex - animateFromIndex) * progress;
    const wholeEnd = Math.floor(visibleEnd);
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    const first = pointAt(0);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i <= wholeEnd; i++) {
      const point = pointAt(i);
      ctx.lineTo(point.x, point.y);
    }
    if (wholeEnd < lastIndex) {
      const from = pointAt(wholeEnd);
      const to = pointAt(wholeEnd + 1);
      const segmentProgress = visibleEnd - wholeEnd;
      ctx.lineTo(
        from.x + (to.x - from.x) * segmentProgress,
        from.y + (to.y - from.y) * segmentProgress,
      );
    }
    ctx.stroke();

    // 终点标注
    if (progress >= 1) {
      const lastV = series[series.length - 1] ?? 0;
      ctx.fillStyle = "#c0392b";
      ctx.font = "18px 'Ma Shan Zheng','Kaiti SC','KaiTi',serif";
      ctx.textAlign = "left";
      const endLabel = opts.maxValue
        ? `${Math.round(lastV)}只${opts.valueLabel ?? ""}`
        : `鹰约 ${Math.round(lastV * 100)}%`;
      ctx.fillText(endLabel, toX(series.length - 1) - 54, toY(lastV) - 12);
    }

    if (progress < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(raf);
}

function wobblyLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const segs = 8;
  for (let i = 1; i <= segs; i++) {
    const f = i / segs;
    const wob = i === segs ? 0 : Math.sin(i * 13.7) * 1.5;
    ctx.lineTo(x1 + (x2 - x1) * f + wob, y1 + (y2 - y1) * f + wob * 0.6);
  }
  ctx.stroke();
}
