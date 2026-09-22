/**
 * 第六节 · 当个体开始学习
 *
 * 这一节把“学习”拆成一个可以看懂的实验：先跑完固定策略的基线，
 * 再摘掉永久的鹰鸽帽子，近看一个人的记忆，最后让整群人逐日学习。
 * 页面结构仍然是静态 HTML；本控制器只负责阶段、模拟和动画。
 */
import {
  DEFAULT_ECOLOGY_PARAMS,
  createEcologyState,
  runEcologyDay,
  type EcologyDayResult,
  type EcologyParams,
  type EcologyState,
} from "../core/ecology";
import {
  createLearningState,
  rememberOutcome,
  runLearningDay,
  tendencyProbability,
  type Learner,
  type LearningDayResult,
  type LearningState,
} from "../core/learning";
import { createSeededRandom, type RandomSource } from "../core/random";
import { EcologyScene } from "../ui/ecologyScene";
import { publish } from "../core/pubsub";
import { registerSlide } from "./Slide";
import { clearTimers, revealSteps } from "./helpers";

const POPULATION = 16;
const INITIAL_HAWKS = 8;
const INITIAL_RESERVE = 150;
const FOOD_UNITS = 6;
const EXPERIMENT_DAYS = 3;

// 这两个种子只用于让教学演示可重放。结论的文字明确限定为本次轨迹。
const ECOLOGY_SEED = 7;
const BEHAVIOR_SEED = 37;

interface RunSummary {
  actions: number;
  hawkActions: number;
  fights: number;
  days: number;
  alive: number;
  reserve: number;
}

const emptySummary = (): RunSummary => ({
  actions: 0,
  hawkActions: 0,
  fights: 0,
  days: 0,
  alive: POPULATION,
  reserve: POPULATION * INITIAL_RESERVE,
});

let scene: EcologyScene | null = null;
let timers: number[] = [];
let stopped = false;
let pendingFixed: EcologyDayResult | null = null;
let pendingLearning: LearningDayResult | null = null;
let fixedState: EcologyState = createEcologyState(
  POPULATION,
  INITIAL_HAWKS,
  INITIAL_RESERVE,
  true,
);
let learningState: LearningState = createLearningState(fixedState);
let fixedRandom: RandomSource = createSeededRandom(ECOLOGY_SEED);
let learningEcologyRandom: RandomSource = createSeededRandom(ECOLOGY_SEED);
let learningBehaviorRandom: RandomSource = createSeededRandom(BEHAVIOR_SEED);
let fixedSummary = emptySummary();
let learningSummary = emptySummary();
let demoLearner: Learner | null = null;

function params(): EcologyParams {
  return { ...DEFAULT_ECOLOGY_PARAMS, foodUnits: FOOD_UNITS };
}

function query(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

function text(selector: string, value: string): void {
  const element = query(selector);
  if (element) element.textContent = value;
}

function button(selector: string): HTMLButtonElement | null {
  const element = query(selector);
  return element instanceof HTMLButtonElement ? element : null;
}

function bind(selector: string, handler: () => void): void {
  query(selector)?.addEventListener("click", handler);
}

function setButton(selector: string, label: string, disabled = false): void {
  const element = button(selector);
  if (!element) return;
  element.textContent = label;
  element.disabled = disabled;
}

function showPhase(selector: string): void {
  document.querySelectorAll<HTMLElement>("#slide-learning .learn-phase")
    .forEach((panel) => (panel.style.display = "none"));
  const panel = query(selector);
  if (!panel) return;
  panel.style.display = "block";
  panel.classList.remove("env-panel-enter");
  void panel.offsetWidth;
  panel.classList.add("env-panel-enter");
}

function markStep(step: string): void {
  document.querySelectorAll<HTMLElement>("#slide-learning [data-learning-step]")
    .forEach((item) => item.classList.toggle("active", item.dataset.learningStep === step));
}

function livingCount(state: EcologyState): number {
  return state.seats.filter((seat) => seat.alive).length;
}

function reserveTotal(state: EcologyState): number {
  return Math.round(state.seats.reduce(
    (sum, seat) => sum + (seat.alive ? seat.reserve : 0),
    0,
  ));
}

function updateHud(state: EcologyState, summary: RunSummary, note: string): void {
  text("#learning-day", `第 ${state.day} 天`);
  text("#learning-alive", `存活 ${livingCount(state)} / ${POPULATION}`);
  text("#learning-reserve", `总储备 ${reserveTotal(state)}`);
  text(
    "#learning-actions",
    `强硬行动 ${summary.hawkActions} / ${summary.actions}`,
  );
  text("#learning-note", note);
}

function resetToInitial(preserveFixedSummary = false): void {
  fixedState = createEcologyState(
    POPULATION,
    INITIAL_HAWKS,
    INITIAL_RESERVE,
    true,
  );
  learningState = createLearningState(fixedState);
  fixedRandom = createSeededRandom(ECOLOGY_SEED);
  learningEcologyRandom = createSeededRandom(ECOLOGY_SEED);
  learningBehaviorRandom = createSeededRandom(BEHAVIOR_SEED);
  pendingFixed = null;
  pendingLearning = null;
  if (!preserveFixedSummary) fixedSummary = emptySummary();
  learningSummary = emptySummary();
  demoLearner = null;
  scene?.showState(fixedState, FOOD_UNITS);
  updateHud(fixedState, fixedSummary, "同一群体、同一食物、同一初始储备；先建立固定策略的基线。 ");
}

function playCompleteDay(
  result: EcologyDayResult,
  done: () => void,
): void {
  if (!scene) return;
  scene.playForaging(result, 170, () => {
    scene?.playNight(result, () => {
      scene?.playElimination(result, () => {
        scene?.playBirth(result, done);
      });
    });
  });
}

function summarizeFixed(result: EcologyDayResult): void {
  fixedSummary.actions += result.pairs.length * 2;
  fixedSummary.hawkActions += result.pairs.reduce(
    (sum, pair) => sum + pair.strategies.filter((move) => move === "hawk").length,
    0,
  );
  fixedSummary.fights += result.pairs.filter((pair) =>
    pair.strategies[0] === "hawk" && pair.strategies[1] === "hawk").length;
  fixedSummary.days += 1;
  fixedSummary.alive = livingCount(result.state);
  fixedSummary.reserve = reserveTotal(result.state);
}

function fixedDay(): void {
  if (!scene || stopped || scene.isBusy() || fixedSummary.days >= EXPERIMENT_DAYS) return;
  const result = runEcologyDay(fixedState, params(), fixedRandom);
  pendingFixed = result;
  setButton("#btn-learning-fixed-day", "播放中…", true);
  text(
    "#learn-baseline-copy",
    `第 ${result.state.day} 天：固定帽子不变，但每个人仍要面对新的配对。`,
  );
  scene.setFoodUnits(FOOD_UNITS);
  playCompleteDay(result, () => {
    if (stopped || pendingFixed !== result) return;
    pendingFixed = null;
    fixedState = result.state;
    summarizeFixed(result);
    scene?.showState(fixedState, FOOD_UNITS);
    updateHud(
      fixedState,
      fixedSummary,
      `第 ${fixedSummary.days} / ${EXPERIMENT_DAYS} 天结束：固定策略没有从经历中改变。`,
    );
    if (fixedSummary.days >= EXPERIMENT_DAYS) {
      text("#learn-baseline-result-copy", "基线跑完了：这是“每个人永远戴着原来的帽子”的结果。 ");
      text("#learn-baseline-result-stat", formatSummary(fixedSummary));
      showPhase("#learn-baseline-result");
      markStep("remove-hats");
    } else {
      setButton("#btn-learning-fixed-day", `继续播放第 ${fixedSummary.days + 1} 天 →`, false);
    }
  });
}

function formatSummary(summary: RunSummary): string {
  const rate = summary.actions === 0 ? 0 : Math.round(summary.hawkActions / summary.actions * 100);
  return `${summary.days} 天 · 强硬行动 ${rate}% · 鹰鹰冲突 ${summary.fights} 次 · ` +
    `${summary.alive} 人存活 · 总储备 ${summary.reserve}`;
}

function removeHats(): void {
  // 这里是认知上的倒带：基线已经记下，正式学习实验从完全相同的起点开始。
  resetToInitial(true);
  scene?.showLearningState(learningState, FOOD_UNITS);
  markStep("person");
  text("#learn-hats-copy", "帽子摘下来了。现在颜色不再是永久身份；每个人只保留自己的经历。 ");
  showPhase("#learn-person");
}

function startPersonDemo(): void {
  if (!learningState.learners[0]) return;
  demoLearner = {
    ...learningState.learners[0],
    hawkMemory: [...learningState.learners[0].hawkMemory],
    doveMemory: [...learningState.learners[0].doveMemory],
  };
  scene?.spotlightSeat(0);
  scene?.updateLearners([demoLearner, ...learningState.learners.slice(1)]);
  text("#learn-person-memory-copy", "记忆还是空的：旧帽子只给了他一个初始倾向。 ");
  text("#learn-person-before", `行动倾向：${Math.round(tendencyProbability(demoLearner.tendency) * 100)}% 强硬`);
  setButton("#btn-learning-person-conflict", "让他经历一次强硬冲突 →", false);
  showPhase("#learn-person-memory");
}

function personConflict(): void {
  if (!demoLearner) return;
  const before = demoLearner.tendency;
  // 这是一个局部特写：只展示“记住一次真实的负收益”，不计入后面的群体 A/B 实验。
  rememberOutcome(demoLearner, "hawk", DEFAULT_ECOLOGY_PARAMS.value - DEFAULT_ECOLOGY_PARAMS.cost);
  scene?.updateLearners([demoLearner, ...learningState.learners.slice(1)]);
  text("#learn-person-memory-copy", `他记住了这次真实结果：强硬行动得到 ${demoLearner.hawkMemory.at(-1)} 分。`);
  text("#learn-person-before", `${before + 1} 格 → ${demoLearner.tendency + 1} 格强硬倾向`);
  text("#learn-person-after", `下一次他仍可能强硬，但概率已经从 ${Math.round(tendencyProbability(before) * 100)}% 降到 ${Math.round(tendencyProbability(demoLearner.tendency) * 100)}%。`);
  showPhase("#learn-person-result");
  markStep("group");
}

function startGroupLearning(): void {
  resetToInitial(true);
  learningState = createLearningState(fixedState);
  scene?.showLearningState(learningState, FOOD_UNITS);
  scene?.spotlightSeat(null);
  markStep("group");
  text("#learn-group-copy", "现在把同一条学习规则交给 16 个人；每次只播放完整的一天。 ");
  setButton("#btn-learning-group-day", "播放第 1 天 →", false);
  showPhase("#learn-group");
  updateHud(learningState.ecology, learningSummary, "群体学习实验开始：临时行动帽子只在配对时出现。 ");
}

function summarizeLearning(result: LearningDayResult): void {
  learningSummary.actions += result.decisions.length;
  learningSummary.hawkActions += result.hawkActions;
  learningSummary.fights += result.fights;
  learningSummary.days += 1;
  learningSummary.alive = livingCount(result.state.ecology);
  learningSummary.reserve = reserveTotal(result.state.ecology);
}

function learningDay(): void {
  if (!scene || stopped || scene.isBusy() || learningSummary.days >= EXPERIMENT_DAYS) return;
  scene.updateLearners(learningState.learners);
  const result = runLearningDay(
    learningState,
    params(),
    learningEcologyRandom,
    learningBehaviorRandom,
  );
  pendingLearning = result;
  setButton("#btn-learning-group-day", "播放中…", true);
  text(
    "#learn-group-copy",
    `第 ${result.state.ecology.day} 天：配对时看行动，夜晚后再看记忆如何改变。`,
  );
  scene.setFoodUnits(FOOD_UNITS);
  scene.playForaging(result.ecology, 170, () => {
    scene?.playNight(result.ecology, () => {
      scene?.playElimination(result.ecology, () => {
        scene?.playBirth(result.ecology, () => {
          if (stopped || pendingLearning !== result) return;
          pendingLearning = null;
          learningState = result.state;
          summarizeLearning(result);
          scene?.showLearningState(learningState, FOOD_UNITS);
          scene?.updateLearners(learningState.learners);
          const changed = result.changedLearners.length;
          updateHud(
            learningState.ecology,
            learningSummary,
            `第 ${learningSummary.days} 天结束：${changed} 个人根据经历调整了强硬倾向。`,
          );
          if (learningSummary.days >= EXPERIMENT_DAYS) {
            text("#learn-group-result-copy", "学习实验也跑完了。先看这一条可重放轨迹，再比较两个世界。 ");
            text("#learn-group-result-stat", formatSummary(learningSummary));
            showPhase("#learn-group-result");
            markStep("compare");
          } else {
            setButton("#btn-learning-group-day", `继续播放第 ${learningSummary.days + 1} 天 →`, false);
          }
        });
      });
    });
  });
}

function showFinalComparison(): void {
  text("#learn-final-fixed", formatSummary(fixedSummary));
  text("#learn-final-learning", formatSummary(learningSummary));
  const fixedRate = fixedSummary.actions === 0 ? 0 : Math.round(fixedSummary.hawkActions / fixedSummary.actions * 100);
  const learningRate = learningSummary.actions === 0 ? 0 : Math.round(learningSummary.hawkActions / learningSummary.actions * 100);
  text(
    "#learn-final-copy",
    `在这条相同起点、相同种子的 ${EXPERIMENT_DAYS} 天轨迹里，强硬行动从 ${fixedRate}% 变为 ${learningRate}%，` +
      `鹰鹰冲突从 ${fixedSummary.fights} 次变为 ${learningSummary.fights} 次。` +
      "这说明负面经历可以让行动倾向改变；它不是任何环境下都必然合作的保证。",
  );
  scene?.showLearningState(learningState, FOOD_UNITS);
  scene?.spotlightSeat(null);
  showPhase("#learn-final");
  markStep("compare");
  updateHud(learningState.ecology, learningSummary, "两个世界都结束了；现在比较行动、冲突和群体状态。 ");
}

function reset(): void {
  stopped = false;
  clearTimers(timers);
  timers = [];
  resetToInitial();
  showPhase("#learn-intro");
  markStep("baseline");
}

registerSlide({
  id: "slide-learning",
  init() {
    scene = new EcologyScene(query("#learning-canvas") as HTMLCanvasElement);
    bind("#btn-learning-start", () => {
      markStep("baseline");
      setButton("#btn-learning-fixed-day", "播放第 1 天 →", false);
      showPhase("#learn-baseline");
    });
    bind("#btn-learning-fixed-day", fixedDay);
    bind("#btn-learning-remove-hats", removeHats);
    bind("#btn-learning-person", startPersonDemo);
    bind("#btn-learning-person-conflict", personConflict);
    bind("#btn-learning-person-continue", startGroupLearning);
    bind("#btn-learning-group-day", learningDay);
    bind("#btn-learning-show-final", showFinalComparison);
    bind("#btn-learning-replay", reset);
    bind("#btn-to-order", () => publish("slideshow/next"));
  },
  onEnter() {
    reset();
    timers.push(...revealSteps(document.getElementById(this.id)!, 360, true));
  },
  onLeave() {
    stopped = true;
    clearTimers(timers);
    timers = [];
    pendingFixed = null;
    pendingLearning = null;
    scene?.destroy();
  },
});
