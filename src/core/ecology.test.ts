import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ECOLOGY_PARAMS,
  createEcologyState,
  runEcologyDay,
  type EcologyParams,
} from "./ecology";
import { createSeededRandom } from "./random";

function params(foodUnits: number): EcologyParams {
  return { ...DEFAULT_ECOLOGY_PARAMS, foodUnits };
}

describe("第五关生态日循环", () => {
  test("8、6、4份食物最多让16、12、8人参与", () => {
    for (const [foodUnits, participants] of [[8, 16], [6, 12], [4, 8]] as const) {
      const result = runEcologyDay(
        createEcologyState(),
        params(foodUnits),
        createSeededRandom(42),
      );
      expect(result.foragingSeats).toHaveLength(participants);
      expect(result.pairs).toHaveLength(foodUnits);
      expect(result.idleSeats).toHaveLength(16 - participants);
    }
  });

  test("没有足够参与者时，多余公共食物在日落过期", () => {
    const state = createEcologyState(4, 2, 150);
    const result = runEcologyDay(state, params(8), createSeededRandom(1));
    expect(result.pairs).toHaveLength(2);
    expect(result.ledger.expiredFoodUnits).toBe(6);
  });

  test("夜间淘汰同时结算，降到0也会淘汰", () => {
    const state = createEcologyState(4, 0, 25);
    const result = runEcologyDay(state, params(0), createSeededRandom(1));
    expect(result.eliminatedSeats).toEqual([0, 1, 2, 3]);
    expect(result.state.seats.every((seat) => !seat.alive)).toBe(true);
  });

  test("繁衍每天最多一个，亲代支付100、子代获得50", () => {
    const state = createEcologyState(4, 2, 250, true);
    state.seats[1]!.alive = false;
    state.seats[1]!.reserve = 0;
    state.seats[3]!.alive = false;
    state.seats[3]!.reserve = 0;
    const result = runEcologyDay(state, params(0), createSeededRandom(7));
    expect(result.birth).not.toBeNull();
    expect(result.state.seats.filter((seat) => seat.bornOnDay === 1)).toHaveLength(1);
    expect(result.birth!.childReserve).toBe(50);
    expect(result.ledger.reproductionLoss).toBe(50);
  });

  test("新生者次日才参与争夺", () => {
    const state = createEcologyState(4, 2, 250, true);
    state.seats[1]!.alive = false;
    state.seats[1]!.reserve = 0;
    const first = runEcologyDay(state, params(1), createSeededRandom(4));
    expect(first.birth).not.toBeNull();
    expect(first.foragingSeats).not.toContain(first.birth!.childSeat);
    const second = runEcologyDay(first.state, params(8), createSeededRandom(4));
    expect(second.foragingSeats).toContain(first.birth!.childSeat);
  });

  test("储备账本守恒", () => {
    const result = runEcologyDay(
      createEcologyState(16, 8, 150, true),
      params(6),
      createSeededRandom(20260921),
    );
    const ledger = result.ledger;
    expect(
      ledger.openingReserve + ledger.foodIncome - ledger.conflictReserveLoss -
      ledger.survivalConsumption - ledger.reproductionLoss,
    ).toBe(ledger.closingReserve);
  });
});
