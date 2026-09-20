/**
 * 迷你演化曲线图：手绘风折线，展示鹰的比例随代数的变化。
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
  const toY = (v: number) => padT + (h - padT - padB) * (1 - v);

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
    ctx.fillText("全是鹰", padL - 8, padT + 10);
    ctx.fillText("全是鸽", padL - 8, h - padB);
    ctx.textAlign = "center";
    ctx.fillText(opts.label ?? "时间（代数）→", (padL + w - padR) / 2, h - 8);

    // 演化曲线
    const n = Math.max(2, Math.floor(series.length * progress));
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(series[i] ?? 0);
      // 轻微抖动模拟手绘
      const jx = Math.sin(i * 7.3) * 1.2;
      const jy = Math.cos(i * 5.1) * 1.2;
      if (i === 0) ctx.moveTo(x + jx, y + jy);
      else ctx.lineTo(x + jx, y + jy);
    }
    ctx.stroke();

    // 终点标注
    if (progress >= 1) {
      const lastV = series[series.length - 1] ?? 0;
      ctx.fillStyle = "#c0392b";
      ctx.font = "18px 'Ma Shan Zheng','Kaiti SC','KaiTi',serif";
      ctx.textAlign = "left";
      ctx.fillText(`鹰约 ${Math.round(lastV * 100)}%`, toX(series.length - 1) - 70, toY(lastV) - 12);
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
