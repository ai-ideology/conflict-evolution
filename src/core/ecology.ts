import { resolveRound, type Move, type PayoffParams } from "./hawkDove";
import { shuffleWith, type RandomSource } from "./random";

export interface EcologySeat {
  id: number;
  strategy: Move;
  reserve: number;
  alive: boolean;
  bornOnDay: number | null;
}

export interface EcologyState {
  day: number;
  seats: EcologySeat[];
  nextId: number;
  reproductionEnabled: boolean;
}

export interface EcologyParams extends PayoffParams {
  foodUnits: number;
  nightlyCost: number;
  reproductionThreshold: number;
  parentCost: number;
  childReserve: number;
}

export interface EcologyPairResult {
  seats: [number, number];
  strategies: [Move, Move];
  payoffs: [number, number];
  winner: "first" | "second" | null;
}

export interface EcologyBirth {
  parentSeat: number;
  childSeat: number;
  strategy: Move;
  childReserve: number;
}

export interface EcologyLedger {
  openingReserve: number;
  foodIncome: number;
  conflictReserveLoss: number;
  survivalConsumption: number;
  reproductionLoss: number;
  closingReserve: number;
  expiredFoodUnits: number;
}

export interface EcologyDayResult {
  state: EcologyState;
  pairs: EcologyPairResult[];
  foragingSeats: number[];
  idleSeats: number[];
  eliminatedSeats: number[];
  birth: EcologyBirth | null;
  ledger: EcologyLedger;
}

export interface EcologyBehaviorPolicy {
  chooseMove(seat: Readonly<EcologySeat>, seatIndex: number): Move;
  observe?(seat: Readonly<EcologySeat>, seatIndex: number, move: Move, payoff: number): void;
}

export const DEFAULT_ECOLOGY_PARAMS: EcologyParams = {
  value: 50,
  cost: 100,
  foodUnits: 8,
  nightlyCost: 25,
  reproductionThreshold: 200,
  parentCost: 100,
  childReserve: 50,
};

export function createEcologyState(
  populationSize = 16,
  initialHawks = 8,
  initialReserve = 150,
  reproductionEnabled = false,
): EcologyState {
  return {
    day: 0,
    nextId: populationSize,
    reproductionEnabled,
    seats: Array.from({ length: populationSize }, (_, index) => ({
      id: index,
      strategy: index < initialHawks ? "hawk" : "dove",
      reserve: initialReserve,
      alive: true,
      bornOnDay: null,
    })),
  };
}

function totalReserve(seats: EcologySeat[]): number {
  return seats.reduce((sum, seat) => sum + (seat.alive ? seat.reserve : 0), 0);
}

/**
 * 结算一个完整日循环：白天配对 → 夜间消耗 → 同时淘汰 → 最多出生一个。
 * 返回事件清单供 UI 分阶段播放；动画先后不会反过来改变逻辑结果。
 */
export function runEcologyDay(
  current: EcologyState,
  params: EcologyParams,
  random: RandomSource,
  behavior?: EcologyBehaviorPolicy,
): EcologyDayResult {
  const nextDay = current.day + 1;
  const seats = current.seats.map((seat) => ({ ...seat }));
  const openingReserve = totalReserve(seats);
  const living = seats
    .map((seat, index) => (seat.alive ? index : -1))
    .filter((index) => index >= 0);
  shuffleWith(living, random);

  const participantLimit = Math.min(living.length, params.foodUnits * 2);
  const participantCount = participantLimit - (participantLimit % 2);
  const foragingSeats = living.slice(0, participantCount);
  const idleSeats = living.slice(participantCount);
  const pairs: EcologyPairResult[] = [];
  let foodIncome = 0;
  let conflictReserveLoss = 0;

  for (let i = 0; i < foragingSeats.length; i += 2) {
    const firstIndex = foragingSeats[i]!;
    const secondIndex = foragingSeats[i + 1]!;
    const first = seats[firstIndex]!;
    const second = seats[secondIndex]!;
    const firstMove = behavior?.chooseMove(first, firstIndex) ?? first.strategy;
    const secondMove = behavior?.chooseMove(second, secondIndex) ?? second.strategy;
    const resolved = resolveRound(
      firstMove,
      secondMove,
      params,
      random.next() < 0.5,
    );

    const reservesBefore: [number, number] = [first.reserve, second.reserve];
    first.reserve = Math.max(0, first.reserve + resolved.payoffs[0]);
    second.reserve = Math.max(0, second.reserve + resolved.payoffs[1]);
    foodIncome += Math.max(0, resolved.payoffs[0]) + Math.max(0, resolved.payoffs[1]);
    conflictReserveLoss +=
      Math.max(0, reservesBefore[0] - first.reserve) +
      Math.max(0, reservesBefore[1] - second.reserve);
    behavior?.observe?.(first, firstIndex, firstMove, resolved.payoffs[0]);
    behavior?.observe?.(second, secondIndex, secondMove, resolved.payoffs[1]);

    pairs.push({
      seats: [firstIndex, secondIndex],
      strategies: [firstMove, secondMove],
      payoffs: resolved.payoffs,
      winner: resolved.winner === "self"
        ? "first"
        : resolved.winner === "other"
          ? "second"
          : null,
    });
  }

  let survivalConsumption = 0;
  const eliminatedSeats: number[] = [];
  for (const index of living) {
    const seat = seats[index]!;
    const paid = Math.min(seat.reserve, params.nightlyCost);
    seat.reserve -= paid;
    survivalConsumption += paid;
    if (paid < params.nightlyCost || seat.reserve <= 0) eliminatedSeats.push(index);
  }
  eliminatedSeats.sort((a, b) => a - b);

  // 同一天的淘汰先统一确定，再一起写入，避免动画顺序影响后续资格。
  for (const index of eliminatedSeats) {
    const seat = seats[index]!;
    seat.alive = false;
    seat.reserve = 0;
  }

  let birth: EcologyBirth | null = null;
  let reproductionLoss = 0;
  let nextId = current.nextId;
  if (current.reproductionEnabled) {
    const emptySeats = seats
      .map((seat, index) => (!seat.alive ? index : -1))
      .filter((index) => index >= 0);
    const eligibleParents = seats
      .map((seat, index) => (
        seat.alive && seat.reserve >= params.reproductionThreshold ? index : -1
      ))
      .filter((index) => index >= 0);
    shuffleWith(eligibleParents, random);
    eligibleParents.sort((a, b) => seats[b]!.reserve - seats[a]!.reserve);

    const parentIndex = eligibleParents[0];
    const childIndex = emptySeats[0];
    if (parentIndex !== undefined && childIndex !== undefined) {
      const parent = seats[parentIndex]!;
      parent.reserve -= params.parentCost;
      seats[childIndex] = {
        id: nextId++,
        strategy: parent.strategy,
        reserve: params.childReserve,
        alive: true,
        bornOnDay: nextDay,
      };
      reproductionLoss = params.parentCost - params.childReserve;
      birth = {
        parentSeat: parentIndex,
        childSeat: childIndex,
        strategy: parent.strategy,
        childReserve: params.childReserve,
      };
    }
  }

  const state: EcologyState = {
    day: nextDay,
    seats,
    nextId,
    reproductionEnabled: current.reproductionEnabled,
  };
  const closingReserve = totalReserve(seats);
  return {
    state,
    pairs,
    foragingSeats,
    idleSeats,
    eliminatedSeats,
    birth,
    ledger: {
      openingReserve,
      foodIncome,
      conflictReserveLoss,
      survivalConsumption,
      reproductionLoss,
      closingReserve,
      expiredFoodUnits: Math.max(0, params.foodUnits - pairs.length),
    },
  };
}
