import {
  runEcologyDay,
  type EcologyDayResult,
  type EcologyParams,
  type EcologyState,
} from "./ecology";
import type { Move } from "./hawkDove";
import type { RandomSource } from "./random";

export interface Learner {
  seatId: number;
  hawkMemory: number[];
  doveMemory: number[];
  /** 五档强硬倾向：0..4 对应 10%、30%、50%、70%、90%。 */
  tendency: 0 | 1 | 2 | 3 | 4;
}

export interface LearningState {
  ecology: EcologyState;
  learners: Learner[];
}

export interface LearningDecision {
  seatIndex: number;
  seatId: number;
  move: Move;
  payoff: number;
  tendencyBefore: number;
  tendencyAfter: number;
}

export interface LearningDayResult {
  state: LearningState;
  ecology: EcologyDayResult;
  decisions: LearningDecision[];
  hawkActions: number;
  fights: number;
  changedLearners: number[];
}

const PROBABILITIES = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

export function createLearningState(ecology: EcologyState): LearningState {
  return {
    ecology: {
      ...ecology,
      seats: ecology.seats.map((seat) => ({ ...seat })),
    },
    learners: ecology.seats.map((seat) => ({
      seatId: seat.id,
      hawkMemory: [],
      doveMemory: [],
      tendency: seat.strategy === "hawk" ? 4 : 0,
    })),
  };
}

export function tendencyProbability(tendency: number): number {
  const index = Math.max(0, Math.min(4, Math.round(tendency)));
  return PROBABILITIES[index]!;
}

export function chooseLearnedMove(learner: Learner, random: RandomSource): Move {
  return random.next() < tendencyProbability(learner.tendency) ? "hawk" : "dove";
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function tendencyFromMemory(learner: Learner): 0 | 1 | 2 | 3 | 4 {
  if (learner.hawkMemory.length === 0 && learner.doveMemory.length === 0) {
    return learner.tendency;
  }
  const difference = average(learner.hawkMemory) - average(learner.doveMemory);
  if (difference === 0) return learner.tendency;
  if (difference <= -50) return 0;
  if (difference < -10) return 1;
  if (difference <= 10) return 2;
  if (difference < 50) return 3;
  return 4;
}

export function rememberOutcome(learner: Learner, move: Move, payoff: number): void {
  const memory = move === "hawk" ? learner.hawkMemory : learner.doveMemory;
  memory.push(payoff);
  if (memory.length > 3) memory.shift();
  learner.tendency = tendencyFromMemory(learner);
}

export function runLearningDay(
  current: LearningState,
  params: EcologyParams,
  ecologyRandom: RandomSource,
  behaviorRandom: RandomSource,
): LearningDayResult {
  const learners = current.learners.map((learner) => ({
    ...learner,
    hawkMemory: [...learner.hawkMemory],
    doveMemory: [...learner.doveMemory],
  }));
  const byId = new Map(learners.map((learner) => [learner.seatId, learner]));
  const pending = new Map<number, { move: Move; before: number }>();
  const decisions: LearningDecision[] = [];

  const ecology = runEcologyDay(current.ecology, params, ecologyRandom, {
    chooseMove(seat, seatIndex) {
      const learner = byId.get(seat.id);
      if (!learner) return seat.strategy;
      const move = chooseLearnedMove(learner, behaviorRandom);
      pending.set(seatIndex, { move, before: learner.tendency });
      return move;
    },
    observe(seat, seatIndex, move, payoff) {
      const learner = byId.get(seat.id);
      if (!learner) return;
      const before = pending.get(seatIndex)?.before ?? learner.tendency;
      rememberOutcome(learner, move, payoff);
      decisions.push({
        seatIndex,
        seatId: seat.id,
        move,
        payoff,
        tendencyBefore: before,
        tendencyAfter: learner.tendency,
      });
    },
  });

  if (ecology.birth) {
    const child = ecology.state.seats[ecology.birth.childSeat]!;
    learners.push({
      seatId: child.id,
      hawkMemory: [],
      doveMemory: [],
      // 后代继承原始策略起点，但不继承亲代后天学到的记忆与倾向。
      tendency: child.strategy === "hawk" ? 4 : 0,
    });
  }

  const livingIds = new Set(
    ecology.state.seats.filter((seat) => seat.alive).map((seat) => seat.id),
  );
  const nextLearners = learners.filter((learner) => livingIds.has(learner.seatId));
  const changedLearners = [...new Set(decisions
    .filter((decision) => decision.tendencyAfter !== decision.tendencyBefore)
    .map((decision) => decision.seatIndex))];

  return {
    state: { ecology: ecology.state, learners: nextLearners },
    ecology,
    decisions,
    hawkActions: decisions.filter((decision) => decision.move === "hawk").length,
    fights: ecology.pairs.filter((pair) =>
      pair.strategies[0] === "hawk" && pair.strategies[1] === "hawk").length,
    changedLearners,
  };
}
