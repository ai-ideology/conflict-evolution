import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PARAMS,
  essHawkRatio,
  hawkFitness,
  doveFitness,
  payoffMatrix,
  playRound,
  resolveRound,
  discreteGenerationStep,
  nearestEquilibriumCount,
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

  test("单次鹰鹰相遇有真实赢家和输家", () => {
    expect(resolveRound("hawk", "hawk", p, true)).toEqual({
      payoffs: [50, -100],
      winner: "self",
    });
    expect(resolveRound("hawk", "hawk", p, false)).toEqual({
      payoffs: [-100, 50],
      winner: "other",
    });
  });

  test("矩阵结构", () => {
    const m = payoffMatrix(p);
    expect(m.hh).toBe(-25);
    expect(m.hd).toBe(50);
    expect(m.dh).toBe(0);
    expect(m.dd).toBe(25);
  });
});

describe("16 人教学演化", () => {
  test("每代只改变一个席位并在 8/8 停止", () => {
    expect(discreteGenerationStep(2, 16, p)).toBe(3);
    expect(discreteGenerationStep(7, 16, p)).toBe(8);
    expect(discreteGenerationStep(8, 16, p)).toBe(8);
    expect(discreteGenerationStep(9, 16, p)).toBe(8);
  });

  test("受控冲突代价映射到清晰人数", () => {
    expect(nearestEquilibriumCount(16, { value: 50, cost: 80 })).toBe(10);
    expect(nearestEquilibriumCount(16, { value: 50, cost: 100 })).toBe(8);
    expect(nearestEquilibriumCount(16, { value: 50, cost: 200 })).toBe(4);
  });

  test("三条教学路径都逐席位走到稳定点", () => {
    const trace = (start: number, params: { value: number; cost: number }) => {
      const values = [start];
      for (let i = 0; i < 20; i++) {
        const next = discreteGenerationStep(values.at(-1)!, 16, params);
        values.push(next);
        if (next === values.at(-2)) break;
      }
      return values;
    };

    expect(trace(2, p)).toEqual([2, 3, 4, 5, 6, 7, 8, 8]);
    expect(trace(8, { value: 50, cost: 80 })).toEqual([8, 9, 10, 10]);
    expect(trace(8, { value: 50, cost: 200 })).toEqual([8, 7, 6, 5, 4, 4]);
  });

  test("任意一代最多改变一个席位", () => {
    for (const cost of [80, 100, 200]) {
      for (let hawks = 0; hawks <= 16; hawks++) {
        const next = discreteGenerationStep(hawks, 16, { value: 50, cost });
        expect(Math.abs(next - hawks)).toBeLessThanOrEqual(1);
      }
    }
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
