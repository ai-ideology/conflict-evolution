import { describe, expect, test } from "bun:test";
import { DEFAULT_ECOLOGY_PARAMS, createEcologyState } from "./ecology";
import {
  chooseLearnedMove,
  createLearningState,
  rememberOutcome,
  runLearningDay,
  tendencyProbability,
  type Learner,
} from "./learning";
import { createSeededRandom } from "./random";

describe("第六关学习模型", () => {
  test("旧帽子只设置初始倾向，不伪造收益记忆", () => {
    const state = createLearningState(createEcologyState(16, 8, 150, true));
    expect(state.learners.slice(0, 8).every((learner) => learner.tendency === 4)).toBe(true);
    expect(state.learners.slice(8).every((learner) => learner.tendency === 0)).toBe(true);
    expect(state.learners.every((learner) =>
      learner.hawkMemory.length === 0 && learner.doveMemory.length === 0)).toBe(true);
  });

  test("五档倾向保留少量探索概率", () => {
    expect([0, 1, 2, 3, 4].map(tendencyProbability)).toEqual([0.1, 0.3, 0.5, 0.7, 0.9]);
    const alwaysLow = { next: () => 0.05 };
    const alwaysHigh = { next: () => 0.95 };
    const learner: Learner = { seatId: 1, hawkMemory: [], doveMemory: [], tendency: 0 };
    expect(chooseLearnedMove(learner, alwaysLow)).toBe("hawk");
    expect(chooseLearnedMove(learner, alwaysHigh)).toBe("dove");
  });

  test("只记录实际选择，0收益是有效记忆，且每类最多三次", () => {
    const learner: Learner = { seatId: 1, hawkMemory: [], doveMemory: [], tendency: 4 };
    rememberOutcome(learner, "dove", 0);
    expect(learner.doveMemory).toEqual([0]);
    expect(learner.hawkMemory).toEqual([]);
    expect(learner.tendency).toBe(4);
    for (const payoff of [25, 0, 25]) rememberOutcome(learner, "dove", payoff);
    expect(learner.doveMemory).toEqual([25, 0, 25]);
  });

  test("经验差为0时保留当前倾向，不把真实0收益误当成转向", () => {
    const low: Learner = { seatId: 2, hawkMemory: [], doveMemory: [], tendency: 0 };
    rememberOutcome(low, "dove", 0);
    expect(low.tendency).toBe(0);
  });

  test("负面强硬经历降低倾向，正面强硬经历提高倾向", () => {
    const learner: Learner = { seatId: 1, hawkMemory: [], doveMemory: [], tendency: 4 };
    rememberOutcome(learner, "hawk", -100);
    expect(learner.tendency).toBe(0);
    learner.hawkMemory = [];
    learner.doveMemory = [];
    rememberOutcome(learner, "hawk", 50);
    expect(learner.tendency).toBe(4);
  });

  test("同种子学习日可复现，未参与者不产生记忆", () => {
    const initial = createLearningState(createEcologyState(16, 8, 150, true));
    const run = () => runLearningDay(
      initial,
      { ...DEFAULT_ECOLOGY_PARAMS, foodUnits: 4 },
      createSeededRandom(11),
      createSeededRandom(29),
    );
    const first = run();
    const second = run();
    expect(first).toEqual(second);
    expect(first.decisions).toHaveLength(8);
    const idleIds = first.ecology.idleSeats.map((index) => initial.ecology.seats[index]!.id);
    expect(first.state.learners
      .filter((learner) => idleIds.includes(learner.seatId))
      .every((learner) => learner.hawkMemory.length === 0 && learner.doveMemory.length === 0))
      .toBe(true);
  });

  test("新生者不继承亲代的后天记忆与学习倾向", () => {
    const ecology = createEcologyState(16, 8, 150, true);
    ecology.seats[0]!.reserve = 300;
    ecology.seats[15]!.alive = false;
    ecology.seats[15]!.reserve = 0;
    const initial = createLearningState(ecology);
    initial.learners[0]!.hawkMemory = [-100];
    initial.learners[0]!.doveMemory = [25];
    initial.learners[0]!.tendency = 0;

    const result = runLearningDay(
      initial,
      { ...DEFAULT_ECOLOGY_PARAMS, foodUnits: 0, nightlyCost: 0 },
      createSeededRandom(3),
      createSeededRandom(5),
    );
    expect(result.ecology.birth).not.toBeNull();
    const childSeat = result.ecology.birth!.childSeat;
    const child = result.state.ecology.seats[childSeat]!;
    const childLearner = result.state.learners.find((learner) => learner.seatId === child.id)!;
    expect(childLearner.hawkMemory).toEqual([]);
    expect(childLearner.doveMemory).toEqual([]);
    expect(childLearner.tendency).toBe(child.strategy === "hawk" ? 4 : 0);
  });
});
