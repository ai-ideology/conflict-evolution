/**
 * 鹰鸽博弈核心引擎 —— 与 UI 完全解耦。
 *
 * 经典模型（Maynard Smith, 1973）：
 *   V = 资源价值，C = 冲突代价
 *   鹰 vs 鹰：胜者得 V，败者付出 C，期望 (V - C) / 2
 *   鹰 vs 鸽：鹰独得 V，鸽得 0
 *   鸽 vs 鸽：一方退让，期望 V / 2
 */

export type Move = "hawk" | "dove";

export interface PayoffParams {
  /** 资源价值 V */
  value: number;
  /** 冲突代价 C */
  cost: number;
}

export const DEFAULT_PARAMS: PayoffParams = { value: 50, cost: 100 };

/** 双方收益 [自己, 对手] */
export function playRound(self: Move, other: Move, p: PayoffParams): [number, number] {
  if (self === "hawk" && other === "hawk") {
    const s = (p.value - p.cost) / 2;
    return [s, s];
  }
  if (self === "hawk" && other === "dove") return [p.value, 0];
  if (self === "dove" && other === "hawk") return [0, p.value];
  return [p.value / 2, p.value / 2];
}

/** 自己一方在四种对局下的收益矩阵（行=自己，列=对手） */
export function payoffMatrix(p: PayoffParams): { hh: number; hd: number; dh: number; dd: number } {
  return {
    hh: (p.value - p.cost) / 2,
    hd: p.value,
    dh: 0,
    dd: p.value / 2,
  };
}

export interface Population {
  /** 鹰的比例，0~1 */
  hawkRatio: number;
}

/** 鹰在群体中的期望收益 */
export function hawkFitness(pop: Population, p: PayoffParams): number {
  const m = payoffMatrix(p);
  return pop.hawkRatio * m.hh + (1 - pop.hawkRatio) * m.hd;
}

/** 鸽在群体中的期望收益 */
export function doveFitness(pop: Population, p: PayoffParams): number {
  const m = payoffMatrix(p);
  return pop.hawkRatio * m.dh + (1 - pop.hawkRatio) * m.dd;
}

/**
 * 演化稳定状态（ESS）下鹰的比例。
 * V >= C 时纯鹰是 ESS；V < C 时混合均衡 p* = V / C。
 */
export function essHawkRatio(p: PayoffParams): number {
  if (p.cost <= 0) return 1;
  return Math.min(1, p.value / p.cost);
}

/**
 * 复制者动态（离散步进）：表现好于群体平均的策略，比例上升。
 * step 控制每代变化幅度。
 */
export function replicatorStep(pop: Population, p: PayoffParams, step = 0.5): Population {
  const h = pop.hawkRatio;
  if (h <= 0 || h >= 1) {
    // 纯策略群体在复制者动态下不会自发产生另一种策略
    return { hawkRatio: h };
  }
  const fh = hawkFitness(pop, p);
  const fd = doveFitness(pop, p);
  const avg = h * fh + (1 - h) * fd;
  if (avg === 0) return { hawkRatio: h };
  const next = h + step * h * (fh - avg) / Math.abs(avg);
  return { hawkRatio: clamp01(next) };
}

/** 从初始比例跑 n 代，返回每代比例序列（含初始值，长度 n+1） */
export function simulateGenerations(
  initialRatio: number,
  p: PayoffParams,
  generations: number,
  step = 0.5,
): number[] {
  const series: number[] = [clamp01(initialRatio)];
  let pop: Population = { hawkRatio: series[0]! };
  for (let i = 0; i < generations; i++) {
    pop = replicatorStep(pop, p, step);
    series.push(pop.hawkRatio);
  }
  return series;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
