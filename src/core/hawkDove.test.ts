import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PARAMS,
  essHawkRatio,
  hawkFitness,
  doveFitness,
  payoffMatrix,
  playRound,
  replicatorStep,
  simulateGenerations,
} from "./hawkDove";

const p = DEFAULT_PARAMS; // V=50, C=100

describe("支付矩阵", () => {
  test("四种对局收益", () => {
    expect(playRound("hawk", "hawk", p)).toEqual([-25, -25]);
    expect(playRound("hawk", "dove", p)).toEqual([50, 0]);
    expect(playRound("dove", "hawk", p)).toEqual([0, 50]);
    expect(playRound("dove", "dove", p)).toEqual([25, 25]);
  });

  test("矩阵结构", () => {
    const m = payoffMatrix(p);
    expect(m.hh).toBe(-25);
    expect(m.hd).toBe(50);
    expect(m.dh).toBe(0);
    expect(m.dd).toBe(25);
  });
});

describe("期望收益与频率依赖", () => {
  test("鹰很少时，鹰比鸽赚", () => {
    const pop = { hawkRatio: 0.05 };
    expect(hawkFitness(pop, p)).toBeGreaterThan(doveFitness(pop, p));
  });

  test("鹰很多时，鸽比鹰赚", () => {
    const pop = { hawkRatio: 0.95 };
    expect(doveFitness(pop, p)).toBeGreaterThan(hawkFitness(pop, p));
  });

  test("均衡点两侧收益交叉", () => {
    const ess = essHawkRatio(p); // 0.5
    expect(ess).toBeCloseTo(0.5);
    expect(hawkFitness({ hawkRatio: ess }, p)).toBeCloseTo(
      doveFitness({ hawkRatio: ess }, p),
    );
    const below = { hawkRatio: ess - 0.01 };
    const above = { hawkRatio: ess + 0.01 };
    expect(hawkFitness(below, p)).toBeGreaterThan(doveFitness(below, p));
    expect(hawkFitness(above, p)).toBeLessThan(doveFitness(above, p));
  });
});

describe("ESS 与复制者动态", () => {
  test("V >= C 时纯鹰是 ESS", () => {
    expect(essHawkRatio({ value: 120, cost: 100 })).toBe(1);
    expect(essHawkRatio({ value: 100, cost: 100 })).toBe(1);
  });

  test("V < C 时混合均衡为 V/C", () => {
    expect(essHawkRatio({ value: 30, cost: 100 })).toBeCloseTo(0.3);
  });

  test("复制者动态向 ESS 收敛", () => {
    const series = simulateGenerations(0.1, p, 200, 0.3);
    const last = series[series.length - 1]!;
    expect(Math.abs(last - essHawkRatio(p))).toBeLessThan(0.02);
  });

  test("高初始比例同样收敛到 ESS", () => {
    const series = simulateGenerations(0.9, p, 200, 0.3);
    const last = series[series.length - 1]!;
    expect(Math.abs(last - essHawkRatio(p))).toBeLessThan(0.02);
  });

  test("纯策略群体不会自发变化", () => {
    expect(replicatorStep({ hawkRatio: 0 }, p).hawkRatio).toBe(0);
    expect(replicatorStep({ hawkRatio: 1 }, p).hawkRatio).toBe(1);
  });

  test("比例始终在 0~1 内", () => {
    const series = simulateGenerations(0.5, { value: 50, cost: 55 }, 50, 0.8);
    for (const v of series) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
