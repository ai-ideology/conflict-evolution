import { describe, expect, test } from "bun:test";
import {
  INSTITUTION_ENCOUNTERS,
  INSTITUTION_POLICIES,
  INSTITUTION_POPULATION,
  expectedLedger,
  stableLedger,
} from "./institution";

describe("第七关制度均值场账本", () => {
  test("四档政策固定为 K/C、资源价值和稳定鹰数", () => {
    expect(INSTITUTION_POLICIES.map((policy) => [
      policy.organizationCost,
      policy.conflictCost,
      policy.value,
      policy.stableHawkCount,
    ])).toEqual([
      [0, 100, 50, 8],
      [5, 180, 45, 4],
      [10, 320, 40, 2],
      [20, 480, 30, 1],
    ]);
  });

  test("默认账本使用8次相遇、总资源400，并且守恒", () => {
    for (const policy of INSTITUTION_POLICIES) {
      const ledger = stableLedger(policy.id);
      expect(ledger.encounters).toBe(INSTITUTION_ENCOUNTERS);
      expect(ledger.gross).toBe(400);
      expect(ledger.totalResourceBefore).toBe(ledger.totalResourceAfter);
      expect(ledger.net + ledger.organization + ledger.conflictLoss).toBe(ledger.gross);
      expect(ledger.resourceConservation).toBe(0);
    }
  });

  test("中度投入的净收益最高，重度投入不是最优", () => {
    const ledgers = INSTITUTION_POLICIES.map((policy) => stableLedger(policy.id));
    expect(ledgers.map((ledger) => Math.round(ledger.net * 100) / 100)).toEqual([
      200,
      270,
      280,
      225,
    ]);
    // 这里比较的是按公式计算的稳定比例：重度制裁的冲突虽少，但组织成本过大。
    expect(ledgers[2]!.net).toBeGreaterThan(ledgers[0]!.net);
    expect(ledgers[2]!.net).toBeGreaterThan(ledgers[1]!.net);
    expect(ledgers[2]!.net).toBeGreaterThan(ledgers[3]!.net);
  });

  test("同一初始鹰比例下，短期账本可以暂时更差", () => {
    const initialHawks = 8;
    const noOrder = expectedLedger("none", { hawkCount: initialHawks });
    const medium = expectedLedger("medium", { hawkCount: initialHawks });
    // 制裁改变的是长期比例，若仍处在8鹰的旧比例，短期付出K反而更贵。
    expect(medium.net).toBeLessThan(noOrder.net);
    expect(medium.hawkCount / INSTITUTION_POPULATION).toBe(
      noOrder.hawkCount / INSTITUTION_POPULATION,
    );
  });
});
