/**
 * 手绘小人（peep）绘制器 —— 风格致敬 ncase《信任的进化》：
 * 圆形大头、豆豆眼、短线四肢；鹰=红帽，鸽=蓝帽。
 */

import type { SketchContext } from "./sketchAnimals";
import { drawFood } from "./sketchAnimals";

export type HatColor = "hawk" | "dove";

export const HAT_COLORS: Record<HatColor, string> = {
  hawk: "#c0392b",
  dove: "#3b7dbd",
};

export type PeepFace = "calm" | "angry" | "happy" | "sad" | "dizzy";

export interface PeepPose {
  dir: 1 | -1;
  face?: PeepFace;
  hat: HatColor;
  armsUp?: boolean;
  holdingFood?: boolean;
  walkPhase?: number | null;
  frontFace?: boolean;
  /** 在该时刻（秒）之前保持闭眼（眨眼） */
  blinkUntil?: number;
}

const INK = "#41403e";
const SKIN = "#fffdf7";

function j(seed: number, t: number): number {
  return Math.sin(seed * 3.7 + Math.floor(t * 2.2) * 1.1) * 1.8;
}

function sline(c: SketchContext, x1: number, y1: number, x2: number, y2: number): void {
  const { ctx } = c;
  // 直来直去：四肢等短线条保持笔直，不做抖动
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** 轻微抖动的手绘线（用于需要「手画感」的地方，如帽子轮廓） */
function wline(c: SketchContext, x1: number, y1: number, x2: number, y2: number): void {
  const { ctx, t } = c;
  const seed = x1 * 0.7 + y1 * 1.3 + x2 * 0.31 + y2 * 1.7;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const mx = (x1 + x2) / 2 + j(seed, t) * 0.8;
  const my = (y1 + y2) / 2 + j(seed + 9.7, t) * 0.8;
  ctx.lineTo(mx, my);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function sellipse(
  c: SketchContext,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill?: string,
): void {
  const { ctx, t } = c;
  for (let pass = 0; pass < 2; pass++) {
    const phase = pass * 1.7 + Math.floor(t * 2.2) * 0.35;
    ctx.beginPath();
    for (let i = 0; i <= 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const px = x + Math.cos(a) * rx * (1 + Math.sin(a * 3 + phase) * 0.05);
      const py = y + Math.sin(a) * ry * (1 + Math.cos(a * 2 + phase * 1.3) * 0.05);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    if (pass === 0 && fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.globalAlpha = pass === 0 ? 0.9 : 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function setInk(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/* ---------- 五官 ---------- */

function drawFace(
  c: SketchContext,
  lookX: number,
  headY: number,
  s: number,
  face: PeepFace,
  eyesClosed = false,
): void {
  const { ctx } = c;
  ctx.save();
  ctx.translate(lookX, headY);
  setInk(ctx, 2.6 * s);

  // 眨眼覆盖：任何表情下都可以眯成两条缝
  if (eyesClosed && face !== "dizzy" && face !== "happy") {
    sline(c, -11 * s, -2 * s, -5 * s, -2 * s);
    sline(c, 5 * s, -2 * s, 11 * s, -2 * s);
    ctx.beginPath();
    ctx.arc(0, 4 * s, 6 * s, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.restore();
    return;
  }

  switch (face) {
    case "dizzy": {
      for (const ex of [-8 * s, 8 * s]) {
        sline(c, ex - 3.5 * s, -6 * s, ex + 3.5 * s, 1 * s);
        sline(c, ex + 3.5 * s, -6 * s, ex - 3.5 * s, 1 * s);
      }
      ctx.beginPath();
      ctx.moveTo(-6 * s, 9 * s);
      ctx.quadraticCurveTo(-3 * s, 6 * s, 0, 9 * s);
      ctx.quadraticCurveTo(3 * s, 12 * s, 6 * s, 9 * s);
      ctx.stroke();
      break;
    }
    case "angry": {
      dot(ctx, -8 * s, -2 * s, 2.6 * s);
      dot(ctx, 8 * s, -2 * s, 2.6 * s);
      sline(c, -13 * s, -11 * s, -4 * s, -7 * s);
      sline(c, 13 * s, -11 * s, 4 * s, -7 * s);
      sline(c, -5 * s, 10 * s, 5 * s, 10 * s);
      break;
    }
    case "happy": {
      for (const ex of [-8 * s, 8 * s]) {
        ctx.beginPath();
        ctx.arc(ex, -2 * s, 4.5 * s, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 5 * s, 7 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    }
    case "sad": {
      dot(ctx, -8 * s, -2 * s, 2.4 * s);
      dot(ctx, 8 * s, -2 * s, 2.4 * s);
      sline(c, -13 * s, -6 * s, -4 * s, -10 * s);
      sline(c, 13 * s, -6 * s, 4 * s, -10 * s);
      ctx.beginPath();
      ctx.arc(0, 13 * s, 5 * s, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    }
    default: {
      dot(ctx, -8 * s, -2 * s, 2.6 * s);
      dot(ctx, 8 * s, -2 * s, 2.6 * s);
      ctx.beginPath();
      ctx.arc(0, 4 * s, 6 * s, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();
}


/* ---------- 小人 ---------- */

/**
 * 绘制一个小人。cx 为水平中心，groundY 为脚底 y 坐标，s 为缩放。
 * s=1 时：头半径 24，整体高约 110。
 */
export function drawPeep(
  c: SketchContext,
  cx: number,
  groundY: number,
  s: number,
  pose: PeepPose,
): void {
  const { ctx } = c;
  const face = pose.face ?? "calm";
  const walking = pose.walkPhase != null;
  const phase = pose.walkPhase ?? 0;

  ctx.save();
  ctx.translate(cx, groundY);
  setInk(ctx, 3 * s);

  const bodyY = -34 * s;

  // 腿（走路时左右交替）
  const legSwing = walking ? Math.sin(phase) * 7 * s : 0;
  sline(c, -5 * s, bodyY + 12 * s, -5 * s - legSwing, 0);
  sline(c, 5 * s, bodyY + 12 * s, 5 * s + legSwing, 0);

  // 身体
  sellipse(c, 0, bodyY, 13 * s, 16 * s, SKIN);

  // 手臂
  const armSwing = walking ? Math.sin(phase) * 5 * s : 0;
  if (pose.holdingFood) {
    sline(c, -9 * s, bodyY - 2 * s, pose.dir * 16 * s, bodyY + 2 * s);
    sline(c, 9 * s, bodyY + 2 * s, pose.dir * 16 * s, bodyY + 4 * s);
    drawFood({ ctx, t: c.t }, pose.dir * 22 * s, bodyY - 2 * s, 0.55);
  } else if (pose.armsUp) {
    sline(c, -10 * s, bodyY - 4 * s, -20 * s, bodyY - 22 * s);
    sline(c, 10 * s, bodyY - 4 * s, 20 * s, bodyY - 22 * s);
  } else {
    sline(c, -11 * s, bodyY - 2 * s, -15 * s - armSwing, bodyY + 12 * s);
    sline(c, 11 * s, bodyY - 2 * s, 15 * s + armSwing, bodyY + 12 * s);
  }

  // 头
  const headY = bodyY - 34 * s;
  const headR = 24 * s;
  sellipse(c, 0, headY, headR, headR, SKIN);

  // 帽子（平顶桶帽，红=鹰 / 蓝=鸽，绒球垂在朝向侧）
  drawHat(c, headY - headR, s, pose.hat, pose.dir);

  // 五官（侧脸时向朝向偏移）
  const lookX = pose.frontFace ? 0 : pose.dir * 6 * s;
  const eyesClosed = pose.blinkUntil !== undefined && c.t < pose.blinkUntil;
  drawFace(c, lookX, headY, s, face, eyesClosed);

  ctx.restore();
}

/* ---------- 帽子（平顶桶帽 + 垂在旁边的小绒球） ---------- */

function drawHat(
  c: SketchContext,
  hatBaseY: number,
  s: number,
  color: HatColor,
  dir: 1 | -1,
): void {
  const { ctx } = c;
  const fill = HAT_COLORS[color];
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6 * s;
  ctx.lineJoin = "round";

  // 桶身：上窄下宽的梯形，平顶
  const topY = hatBaseY - 26 * s;
  ctx.beginPath();
  ctx.moveTo(-17 * s, hatBaseY);
  ctx.lineTo(-13 * s, topY);
  ctx.lineTo(13 * s, topY);
  ctx.lineTo(17 * s, hatBaseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 帽檐底线（微微手绘抖动）
  wline(c, -21 * s, hatBaseY + 1 * s, 21 * s, hatBaseY + 1 * s);

  // 小绒球：从帽顶角垂一根线，末端一个毛球
  const bx = dir * 20 * s;
  const by = hatBaseY - 16 * s;
  sline(c, dir * 12 * s, topY + 2 * s, bx, by);
  ctx.fillStyle = fill;
  dot(ctx, bx + dir * 2 * s, by - 2 * s, 4.5 * s);
  ctx.beginPath();
  ctx.arc(bx + dir * 2 * s, by - 2 * s, 4.5 * s, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}


/* ---------- 吵架云（hawk vs hawk 专用） ---------- */

/** 一团抖动的小圆组成的「打架云」，中心 cx,cy */
export function drawScuffleCloud(c: SketchContext, cx: number, cy: number, s: number): void {
  const { ctx, t } = c;
  ctx.save();
  ctx.strokeStyle = "rgba(65,64,62,0.75)";
  ctx.lineWidth = 2.4 * s;
  const puffs: Array<[number, number, number]> = [
    [-26, 4, 15],
    [-8, -10, 17],
    [14, -6, 16],
    [28, 8, 13],
    [2, 12, 15],
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [px, py, pr] = puffs[i]!;
    const wob = Math.sin(t * 9 + i * 2.1) * 2.5;
    ctx.beginPath();
    ctx.arc(cx + (px + wob) * s, cy + (py - wob) * s, pr * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  const limb = Math.sin(t * 7) > 0 ? 1 : -1;
  sline(c, cx - 30 * s * limb, cy - 14 * s, cx - 44 * s * limb, cy - 22 * s);
  ctx.fillStyle = INK;
  dot(ctx, cx - 46 * s * limb, cy - 23 * s, 4 * s);
  ctx.restore();
}

