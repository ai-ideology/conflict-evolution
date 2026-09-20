/**
 * 手绘涂鸦风的 Canvas 角色绘制：鹰、鸽、食物。
 * 所有线条用「多条短折线 + 随机抖动」模拟手抖效果。
 */

export interface SketchContext {
  ctx: CanvasRenderingContext2D;
  /** 动画时钟（秒），驱动抖动 */
  t: number;
}

const INK = "#41403e";

/** 手绘直线：分成 3 段，中点带随机抖动；抖动画帧间轻微变化 */
function sketchLine(c: SketchContext, x1: number, y1: number, x2: number, y2: number): void {
  const { ctx, t } = c;
  const seed = x1 * 0.7 + y1 * 1.3 + x2 * 0.31 + y2 * 1.7;
  const jitter = (i: number) =>
    Math.sin(seed * 3.7 + i * 12.9 + Math.floor(t * 2.2) * 1.1) * 2.2;

  ctx.beginPath();
  ctx.moveTo(x1 + jitter(0) * 0.4, y1 + jitter(1) * 0.4);
  for (let i = 1; i <= 3; i++) {
    const f = i / 3;
    const x = x1 + (x2 - x1) * f + (i < 3 ? jitter(i * 2) : 0);
    const y = y1 + (y2 - y1) * f + (i < 3 ? jitter(i * 2 + 1) : 0);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** 手绘圆/椭圆：两圈不完全重合的描线 */
function sketchEllipse(
  c: SketchContext,
  x: number,
  y: number,
  rx: number,
  ry: number,
  wobble = 0.06,
): void {
  const { ctx, t } = c;
  for (let pass = 0; pass < 2; pass++) {
    const phase = pass * 1.7 + Math.floor(t * 2.2) * 0.35;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r1 = rx * (1 + Math.sin(a * 3 + phase) * wobble);
      const r2 = ry * (1 + Math.cos(a * 2 + phase * 1.3) * wobble);
      const px = x + Math.cos(a) * r1;
      const py = y + Math.sin(a) * r2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.globalAlpha = pass === 0 ? 0.85 : 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function setStroke(ctx: CanvasRenderingContext2D, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** 鹰：尖锐折角翅膀 + 怒眉。cx,cy 为中心，s 为尺寸缩放，flip 面向左 */
export function drawHawk(
  c: SketchContext,
  cx: number,
  cy: number,
  s: number,
  flip: boolean,
  flap = 0,
): void {
  const { ctx } = c;
  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  setStroke(ctx, INK, 3.2 * s);

  const wing = -18 * s - flap * 14 * s;
  // 尖锐折角翅膀（锯齿状）
  sketchLine(c, -10 * s, -4 * s, -34 * s, wing);
  sketchLine(c, -34 * s, wing, -22 * s, wing + 16 * s);
  sketchLine(c, -22 * s, wing + 16 * s, -44 * s, wing + 10 * s);
  // 身体
  sketchEllipse(c, 0, 0, 22 * s, 17 * s);
  // 尾巴（尖）
  sketchLine(c, -20 * s, 6 * s, -34 * s, 14 * s);
  sketchLine(c, -20 * s, 10 * s, -33 * s, 20 * s);
  // 尖喙
  sketchLine(c, 18 * s, -6 * s, 32 * s, -1 * s);
  sketchLine(c, 32 * s, -1 * s, 19 * s, 3 * s);
  // 怒眉 + 眼
  sketchLine(c, 4 * s, -12 * s, 14 * s, -8 * s);
  sketchEllipse(c, 9 * s, -6 * s, 2.6 * s, 2.6 * s, 0.1);
  // 爪子
  sketchLine(c, -4 * s, 15 * s, -4 * s, 24 * s);
  sketchLine(c, 6 * s, 15 * s, 6 * s, 24 * s);

  ctx.restore();
}

/** 鸽：圆润弧线翅膀 + 平眉。接口同 drawHawk */
export function drawDove(
  c: SketchContext,
  cx: number,
  cy: number,
  s: number,
  flip: boolean,
  flap = 0,
): void {
  const { ctx } = c;
  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  setStroke(ctx, INK, 3.2 * s);

  // 圆润翅膀（一段弧线）
  const wingLift = flap * 8 * s;
  ctx.beginPath();
  ctx.arc(-8 * s, -10 * s - wingLift, 18 * s, Math.PI * 0.9, Math.PI * 2.05);
  ctx.stroke();
  // 身体（比鹰更圆）
  sketchEllipse(c, 0, 2 * s, 20 * s, 19 * s);
  // 尾巴（圆扇形）
  ctx.beginPath();
  ctx.arc(-24 * s, 8 * s, 10 * s, Math.PI * 0.4, Math.PI * 1.5);
  ctx.stroke();
  // 小圆喙
  sketchLine(c, 17 * s, -6 * s, 26 * s, -4 * s);
  sketchLine(c, 26 * s, -4 * s, 18 * s, -1 * s);
  // 平眉 + 温顺大眼
  sketchLine(c, 4 * s, -11 * s, 13 * s, -11 * s);
  sketchEllipse(c, 9 * s, -6 * s, 3.2 * s, 3.2 * s, 0.08);
  // 细腿
  sketchLine(c, -4 * s, 19 * s, -4 * s, 27 * s);
  sketchLine(c, 6 * s, 19 * s, 6 * s, 27 * s);

  ctx.restore();
}

/** 食物：一丛浆果 */
export function drawFood(c: SketchContext, cx: number, cy: number, s: number): void {
  const { ctx } = c;
  ctx.save();
  ctx.translate(cx, cy);
  // 浆果
  ctx.fillStyle = "#d9a441";
  setStroke(ctx, INK, 2.4 * s);
  const berries: Array<[number, number, number]> = [
    [-8, 2, 7],
    [6, -2, 8],
    [0, 8, 6],
  ];
  for (const [bx, by, r] of berries) {
    ctx.beginPath();
    ctx.arc(bx * s, by * s, r * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // 叶子
  setStroke(ctx, "#5a8f5a", 2.6 * s);
  ctx.beginPath();
  ctx.arc(2 * s, -12 * s, 9 * s, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();
}

/** 地面涂鸦线 */
export function drawGround(c: SketchContext, w: number, y: number): void {
  const { ctx } = c;
  setStroke(ctx, "rgba(65,64,62,0.5)", 2);
  // 地面属于场景，不参与角色的呼吸抖动；固定相位可保留手绘感但不会晃动。
  sketchLine({ ctx, t: 0 }, 10, y, w - 10, y);
}
