/** 第五节 · 资源不足：库存、淘汰与繁衍形成历史。 */
import {
  DEFAULT_ECOLOGY_PARAMS,
  createEcologyState,
  runEcologyDay,
  type EcologyDayResult,
  type EcologyState,
} from "../core/ecology";
import { createSeededRandom, type RandomSource } from "../core/random";
import { publish } from "../core/pubsub";
import { EcologyScene } from "../ui/ecologyScene";
import { registerSlide } from "./Slide";
import { $, clearTimers, revealSteps } from "./helpers";

const SEED = 20260921;
const FULL_FOOD = 8;
const SCARCE_FOOD = 6;

let scene: EcologyScene | null = null;
let state: EcologyState = createEcologyState();
let random: RandomSource = createSeededRandom(SEED);
let pending: EcologyDayResult | null = null;
let timers: number[] = [];
let stopped = false;

interface ComparisonSummary {
  foodUnits: number;
  alive: number;
  reserve: number;
  fights: number;
}

const comparison = new Map<number, ComparisonSummary>();

function params(foodUnits: number) {
  return { ...DEFAULT_ECOLOGY_PARAMS, foodUnits };
}

function livingCount(): number {
  return state.seats.filter((seat) => seat.alive).length;
}

function totalReserve(): number {
  return state.seats.reduce((sum, seat) => sum + (seat.alive ? seat.reserve : 0), 0);
}

function updateHud(note: string): void {
  $("#eco-day").textContent = `第 ${state.day} 天`;
  $("#eco-alive").textContent = `存活 ${livingCount()} / 16`;
  $("#eco-reserve").textContent = `总储备 ${Math.round(totalReserve())}`;
  $("#eco-note").textContent = note;
}

function showPhase(selector: string): void {
  document.querySelectorAll<HTMLElement>("#eco-playground .eco-phase")
    .forEach((panel) => (panel.style.display = "none"));
  const panel = $(selector);
  panel.style.display = "block";
  panel.classList.remove("env-panel-enter");
  void panel.offsetWidth;
  panel.classList.add("env-panel-enter");
}

function setCyclePhase(phase: "day" | "night" | "selection" | "birth"): void {
  document.querySelectorAll<HTMLElement>("#eco-cycle span")
    .forEach((item) => item.classList.toggle("active", item.dataset.phase === phase));
}

function beginDay(foodUnits: number, donePhase: string, speed = 330): void {
  if (!scene || scene.isBusy()) return;
  pending = runEcologyDay(state, params(foodUnits), random);
  scene.setFoodUnits(foodUnits);
  setCyclePhase("day");
  showPhase("#eco-running");
  $("#eco-running-title").textContent = `白天：${foodUnits} 份食物，${pending.pairs.length} 组配对`;
  $("#eco-running-copy").textContent = pending.idleSeats.length > 0
    ? `${pending.idleSeats.length} 人今天没有觅食机会。当前配对会依次亮起。`
    : "今天每个人都有一次觅食机会。当前配对会依次亮起。";
  scene.playForaging(pending, speed, () => {
    showPhase(donePhase);
    setCyclePhase("night");
  });
}

function finishNight(
  nextPhase: string,
  onCommitted?: (completed: EcologyDayResult) => void,
): void {
  if (!pending || !scene || scene.isBusy()) return;
  const completed = pending;
  pending = null;
  setCyclePhase("night");
  $("#eco-running-title").textContent = "夜晚：每个人同时消耗 25 点储备";
  $("#eco-running-copy").textContent = "先统一扣除，再统一确定淘汰；动画先后不会改变结果。";
  showPhase("#eco-running");
  scene.playNight(completed, () => {
    setCyclePhase("selection");
    scene!.playElimination(completed, () => {
      setCyclePhase(completed.birth ? "birth" : "selection");
      scene!.playBirth(completed, () => {
        state = completed.state;
        scene!.showState(state, 0);
        if (completed.birth) {
          scene!.spotlightRelation(completed.birth.parentSeat, completed.birth.childSeat);
        }
        updateHud(
          completed.eliminatedSeats.length > 0
            ? `夜间统一结算：${completed.eliminatedSeats.length} 人储备耗尽。`
            : "夜间每位幸存者消耗 25 点储备；今天无人离场。",
        );
        showPhase(nextPhase);
        onCommitted?.(completed);
      });
    });
  });
}

function startIntro(): void {
  updateHud("每个人带着 150 点初始储备；白天所得与损失都会留到明天。 ");
  showPhase("#eco-full-day");
}

function finishFullNight(): void {
  finishNight("#eco-reduce-food");
}

function reduceFood(): void {
  scene?.setFoodUnits(SCARCE_FOOD);
  updateHud("食物从 8 份减少到 6 份；群体尚未运行，比例和储备都没有偷跑。 ");
  showPhase("#eco-scarce-ready");
}

function finishFirstScarceNight(): void {
  finishNight("#eco-observe-more", () => {
    $("#eco-observe-copy").textContent =
      "第一天稀缺生活结束了。有人开始进入危险区，但暂时还没有空席。";
  });
}

function fastForwardUntilElimination(): void {
  if (!scene || scene.isBusy()) return;
  showPhase("#eco-running");
  const runNext = () => {
    if (stopped || !scene) return;
    pending = runEcologyDay(state, params(SCARCE_FOOD), random);
    scene.setFoodUnits(SCARCE_FOOD);
    setCyclePhase("day");
    $("#eco-running-title").textContent = `第 ${pending.state.day} 天：继续生活`;
    $("#eco-running-copy").textContent = "普通日常会连续播放；一旦出现首次淘汰就自动停下。";
    scene.playForaging(pending, 150, () => {
      finishNight("#eco-running", (completed) => {
        if (completed.eliminatedSeats.length > 0) {
          $("#eco-eliminated-count").textContent = String(completed.eliminatedSeats.length);
          showPhase("#eco-first-elimination");
          return;
        }
        timers.push(window.setTimeout(runNext, 420));
      });
    });
  };
  runNext();
}

/** 回到同一稀缺实验起点，并消耗同一段“充足日”随机序列。 */
function resetScarcityBaseline(reproductionEnabled: boolean): void {
  random = createSeededRandom(SEED);
  const initial = createEcologyState(16, 8, 150, reproductionEnabled);
  const fullDay = runEcologyDay(initial, params(FULL_FOOD), random);
  state = {
    ...fullDay.state,
    reproductionEnabled,
    seats: fullDay.state.seats.map((seat) => ({ ...seat })),
  };
  pending = null;
  scene?.showState(state, SCARCE_FOOD);
}

function installReproduction(): void {
  resetScarcityBaseline(true);
  updateHud("实验已倒带到相同起点，并重置为同一个随机种子；现在只安装繁衍规则。 ");
  setCyclePhase("birth");
  showPhase("#eco-reproduction-rule");
}

function fastForwardUntilBirth(): void {
  if (!scene || scene.isBusy()) return;
  showPhase("#eco-running");
  const runNext = () => {
    if (stopped || !scene) return;
    pending = runEcologyDay(state, params(SCARCE_FOOD), random);
    scene.setFoodUnits(SCARCE_FOOD);
    setCyclePhase("day");
    $("#eco-running-title").textContent = `第 ${pending.state.day} 天：繁衍规则已开启`;
    $("#eco-running-copy").textContent = "仍按白天、夜晚、淘汰、繁衍的顺序运行；第一次出生时暂停。";
    scene.playForaging(pending, 130, () => {
      finishNight("#eco-running", (completed) => {
        if (completed.birth) {
          $("#eco-parent-seat").textContent = String(completed.birth.parentSeat + 1);
          $("#eco-child-seat").textContent = String(completed.birth.childSeat + 1);
          showPhase("#eco-first-birth");
          return;
        }
        timers.push(window.setTimeout(runNext, 360));
      });
    });
  };
  runNext();
}

function openComparison(): void {
  comparison.clear();
  showPhase("#eco-compare-8");
  updateHud("接下来三个世界都从相同的16人、相同储备和相同随机种子开始。 ");
}

function runComparisonWorld(foodUnits: number, resultPhase: string): void {
  if (!scene || scene.isBusy()) return;
  random = createSeededRandom(SEED);
  state = createEcologyState(16, 8, 150, true);
  pending = null;
  scene.showState(state, foodUnits);
  showPhase("#eco-running");
  let day = 0;
  let fights = 0;

  const runNext = () => {
    if (stopped || !scene) return;
    if (day >= 8) {
      const summary: ComparisonSummary = {
        foodUnits,
        alive: livingCount(),
        reserve: Math.round(totalReserve()),
        fights,
      };
      comparison.set(foodUnits, summary);
      $("#eco-result-" + foodUnits + "-alive").textContent = String(summary.alive);
      $("#eco-result-" + foodUnits + "-reserve").textContent = String(summary.reserve);
      $("#eco-result-" + foodUnits + "-fights").textContent = String(summary.fights);
      updateHud(`同一初始状态下，${foodUnits} 份食物的 8 天实验完成。`);
      showPhase(resultPhase);
      return;
    }

    const result = runEcologyDay(state, params(foodUnits), random);
    fights += result.pairs.filter((pair) =>
      pair.strategies[0] === "hawk" && pair.strategies[1] === "hawk").length;
    $("#eco-running-title").textContent = `${foodUnits} 份食物 · 第 ${day + 1} / 8 天`;
    $("#eco-running-copy").textContent = "这是对照实验的连续观察；每个世界都使用相同起点和随机种子。";
    setCyclePhase("day");
    scene.setFoodUnits(foodUnits);
    scene.playForaging(result, 45, () => {
      state = result.state;
      day++;
      scene!.showState(state, 0);
      updateHud(`第 ${day} 天结束：存活 ${livingCount()} 人。`);
      timers.push(window.setTimeout(runNext, 180));
    });
  };
  runNext();
}

function showComparisonConclusion(): void {
  for (const foodUnits of [8, 6, 4]) {
    const result = comparison.get(foodUnits);
    if (!result) return;
    $("#eco-final-" + foodUnits).textContent =
      `${result.alive} 人存活 · 总储备 ${result.reserve} · ${result.fights} 次鹰鹰冲突`;
  }
  showPhase("#eco-comparison-final");
}

function reset(): void {
  stopped = false;
  clearTimers(timers);
  timers = [];
  random = createSeededRandom(SEED);
  state = createEcologyState(16, 8, 150, false);
  pending = null;
  scene?.showState(state, 0);
  updateHud("以前每代会重新计算；从这里开始，每个人都有会累积的生存储备。 ");
  setCyclePhase("day");
  showPhase("#eco-intro");
}

registerSlide({
  id: "slide-ecology",
  init() {
    scene = new EcologyScene($("#eco-canvas") as HTMLCanvasElement);
    $("#btn-eco-start").addEventListener("click", startIntro);
    $("#btn-eco-full-day").addEventListener("click", () => beginDay(FULL_FOOD, "#eco-full-day-done"));
    $("#btn-eco-full-night").addEventListener("click", finishFullNight);
    $("#btn-eco-reduce").addEventListener("click", reduceFood);
    $("#btn-eco-scarce-day").addEventListener("click", () => beginDay(SCARCE_FOOD, "#eco-scarce-day-done"));
    $("#btn-eco-scarce-night").addEventListener("click", finishFirstScarceNight);
    $("#btn-eco-observe").addEventListener("click", fastForwardUntilElimination);
    $("#btn-eco-enable-birth").addEventListener("click", installReproduction);
    $("#btn-eco-run-birth").addEventListener("click", fastForwardUntilBirth);
    $("#btn-eco-compare").addEventListener("click", openComparison);
    $("#btn-eco-run-8").addEventListener("click", () => runComparisonWorld(8, "#eco-compare-8-result"));
    $("#btn-eco-run-6").addEventListener("click", () => runComparisonWorld(6, "#eco-compare-6-result"));
    $("#btn-eco-run-4").addEventListener("click", () => runComparisonWorld(4, "#eco-compare-4-result"));
    $("#btn-eco-show-comparison").addEventListener("click", showComparisonConclusion);
    $("#btn-to-learning").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    reset();
    timers.push(...revealSteps(document.getElementById(this.id)!, 360, true));
  },
  onLeave() {
    stopped = true;
    clearTimers(timers);
    timers = [];
    scene?.destroy();
  },
});
