/**
 * 群体实验室（基础版）
 * 固定16人、固定策略、真实循环赛；只开放起点与支付参数。
 * 不接入资源库存、淘汰、繁衍或学习。
 */

import {
  roundRobinStrategyScores,
  type PayoffParams,
} from "../core/hawkDove";
import { PopulationScene, type TournamentResult } from "../ui/populationScene";
import { drawEvoChart } from "../ui/evoChart";
import { publish } from "../core/pubsub";
import { registerSlide } from "./Slide";
import { $, clearTimers, revealSteps } from "./helpers";

const COUNT = 16;
const CHART_GENERATION_LIMIT = 10;

export interface SandboxSnapshot {
  initialHawks: number;
  value: number;
  cost: number;
  generationLimit: number;
  generation: number;
  currentHawks: number;
  history: number[];
  prediction: "up" | "same" | "down" | null;
  outcome: "idle" | "stable" | "cycle" | "limit";
}

let scene: PopulationScene | null = null;
let generation = 0;
let history: number[] = [];
let prediction: "up" | "same" | "down" | null = null;
let running = false;
let finished = false;
let chartDrawnThrough = 0;
let stopChart: (() => void) | null = null;
let timers: number[] = [];
let outcome: SandboxSnapshot["outcome"] = "idle";

export function getSandboxSnapshot(): SandboxSnapshot {
  return {
    initialHawks: history[0] ?? initialHawks(),
    value: inputValue("#sandbox-value"),
    cost: inputValue("#sandbox-cost"),
    generationLimit: generationLimit(),
    generation,
    currentHawks: scene?.hawkCount() ?? initialHawks(),
    history: [...history],
    prediction,
    outcome,
  };
}

function inputValue(id: string): number {
  return Number(($(id) as HTMLInputElement).value);
}

function params(): PayoffParams {
  return {
    value: inputValue("#sandbox-value"),
    cost: inputValue("#sandbox-cost"),
  };
}

function initialHawks(): number {
  return inputValue("#sandbox-initial");
}

function generationLimit(): number {
  return inputValue("#sandbox-limit");
}

function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? "+" + rounded : String(rounded);
}

function updateControlOutputs(): void {
  const hawks = initialHawks();
  $("#sandbox-initial-output").textContent =
    hawks + " 鹰 / " + (COUNT - hawks) + " 鸽";
  $("#sandbox-value-output").textContent =
    inputValue("#sandbox-value") + " 分";
  $("#sandbox-cost-output").textContent =
    inputValue("#sandbox-cost") + " 分";
  $("#sandbox-limit-output").textContent =
    generationLimit() + " 代";
}

function updateStage(): void {
  const hawks = scene?.hawkCount() ?? initialHawks();
  const scores = roundRobinStrategyScores(hawks, COUNT, params());
  $("#sandbox-generation").textContent = "第 " + generation + " 代";
  $("#sandbox-hawk-count").textContent = String(hawks);
  $("#sandbox-dove-count").textContent = String(COUNT - hawks);
  $("#sandbox-hawk-score").textContent = formatScore(scores.hawk);
  $("#sandbox-dove-score").textContent = formatScore(scores.dove);
  $("#sandbox-fights").textContent = String((hawks * (hawks - 1)) / 2);

  const counter = $("#sandbox-ratio-counter");
  const nextValue = generation + ":" + hawks;
  if (counter.dataset.value !== nextValue) {
    counter.dataset.value = nextValue;
    counter.classList.remove("ratio-bump");
    void counter.offsetWidth;
    counter.classList.add("ratio-bump");
  }
}

function redrawChart(): void {
  stopChart?.();
  const visibleHistory = history.slice(0, CHART_GENERATION_LIMIT + 1);
  stopChart = drawEvoChart($("#sandbox-chart") as HTMLCanvasElement, visibleHistory, {
    width: 620,
    generations: CHART_GENERATION_LIMIT,
    height: 150,
    label: "鹰的数量 · 代数 →",
    maxValue: COUNT,
    valueLabel: "鹰",
    animateFromIndex: Math.min(chartDrawnThrough, CHART_GENERATION_LIMIT),
  });
  chartDrawnThrough = Math.max(0, visibleHistory.length - 1);
}

function setControlsDisabled(disabled: boolean): void {
  document.querySelectorAll<HTMLInputElement>("#slide-lab input")
    .forEach((input) => (input.disabled = disabled));
  document.querySelectorAll<HTMLButtonElement>(".sandbox-predict")
    .forEach((button) => (button.disabled = disabled));
  ($("#btn-sandbox-step") as HTMLButtonElement).disabled =
    disabled || prediction === null;
  ($("#btn-sandbox-run") as HTMLButtonElement).disabled =
    disabled || prediction === null || finished;
  ($("#btn-sandbox-reset") as HTMLButtonElement).disabled = disabled;
}

function selectPrediction(value: "up" | "same" | "down"): void {
  if (running) return;
  prediction = value;
  document.querySelectorAll<HTMLButtonElement>(".sandbox-predict")
    .forEach((button) => {
      button.classList.toggle("selected", button.dataset.predict === value);
    });
  $("#sandbox-status").textContent =
    "预测已经记下。现在亲手推进一代，或者连续观察。";
  setControlsDisabled(false);
}

function predictionName(value: "up" | "same" | "down"): string {
  if (value === "up") return "鹰会变多";
  if (value === "down") return "鹰会变少";
  return "鹰的数量不变";
}

function finishExperiment(reason: "stable" | "cycle" | "limit"): void {
  running = false;
  finished = true;
  outcome = reason;
  setControlsDisabled(false);
  const start = history[0]!;
  const end = history[history.length - 1]!;
  if (reason === "cycle") {
    const other = history[history.length - 2]!;
    $("#sandbox-status").textContent =
      "群体没有停在单一数量，而是在 " + other + " 鹰和 " + end +
      " 鹰之间来回摆动。这是16个有限席位下的真实结果；修改一个参数再试试看。";
    ($("#btn-sandbox-step") as HTMLButtonElement).textContent = "再演化一代";
    return;
  }
  const actual = end > start ? "up" : end < start ? "down" : "same";
  const verdict = prediction === actual ? "预测被这次实验支持。" : "这次结果和你的预测不同。";
  $("#sandbox-status").textContent =
    (reason === "stable" ? "群体已经不再变化。" : "已经达到观察代数上限。") +
    " 从 " + start + " 鹰走到 " + end + " 鹰；" +
    verdict + " 你猜的是“" + predictionName(prediction ?? "same") + "”。";
  ($("#btn-sandbox-step") as HTMLButtonElement).textContent = "再演化一代";
}

function describeReplacement(result: TournamentResult): string {
  if (result.changedIdx === null || result.changedTo === null) {
    return "两种策略的累计收益已经打平，本代没有人被替换。";
  }
  const removed = result.worstKind === "hawk" ? "鹰" : "鸽";
  const added = result.bestKind === "hawk" ? "鹰" : "鸽";
  return "去掉一个最低分的" + removed + "，加入一个最高分的" + added + "。";
}

function playOne(auto: boolean): void {
  if (!scene || scene.isBusy()) return;
  if (auto && (finished || generation >= generationLimit())) {
    if (!finished && generation >= generationLimit()) finishExperiment("limit");
    return;
  }
  if (!auto) finished = false;
  running = true;
  setControlsDisabled(true);
  $("#sandbox-status").textContent =
    "第 " + (generation + 1) + " 代正在完成全部 120 组配对……";

  scene.playTournament(params(), auto ? 38 : 80, (result) => {
    generation++;
    const hawks = scene!.hawkCount();
    history.push(hawks);
    updateStage();
    if (generation <= CHART_GENERATION_LIMIT) redrawChart();
    const stable = result.changedIdx === null;
    const cycle =
      history.length >= 3 &&
      history[history.length - 1] === history[history.length - 3] &&
      history[history.length - 1] !== history[history.length - 2];
    $("#sandbox-status").textContent = describeReplacement(result);

    const reachedAutoLimit = auto && generation >= generationLimit();
    if (stable || cycle || reachedAutoLimit) {
      finishExperiment(stable ? "stable" : cycle ? "cycle" : "limit");
      return;
    }
    if (auto) {
      timers.push(window.setTimeout(() => playOne(true), 260));
    } else {
      running = false;
      setControlsDisabled(false);
    }
  }, auto ? 450 : 800);
}

function resetExperiment(clearPrediction = true): void {
  clearTimers(timers);
  timers = [];
  running = false;
  finished = false;
  outcome = "idle";
  generation = 0;
  history = [initialHawks()];
  chartDrawnThrough = 0;
  if (clearPrediction) prediction = null;
  scene?.setup(COUNT, initialHawks(), true, 20260922);
  updateControlOutputs();
  updateStage();
  redrawChart();

  document.querySelectorAll<HTMLButtonElement>(".sandbox-predict")
    .forEach((button) => button.classList.remove("selected"));
  $("#sandbox-status").textContent =
    clearPrediction
      ? "参数已经改变。先判断鹰会变多、不变，还是变少。"
      : "世界已经回到第 0 代，可以换一个预测再试。";
  ($("#btn-sandbox-step") as HTMLButtonElement).textContent = "演化一代";
  setControlsDisabled(false);
}

registerSlide({
  id: "slide-lab",
  init() {
    scene = new PopulationScene($("#sandbox-canvas") as HTMLCanvasElement);
    document.querySelectorAll<HTMLInputElement>("#slide-lab input")
      .forEach((input) => input.addEventListener("input", () => resetExperiment(true)));
    document.querySelectorAll<HTMLButtonElement>(".sandbox-predict")
      .forEach((button) => button.addEventListener("click", () => {
        selectPrediction(button.dataset.predict as "up" | "same" | "down");
      }));
    $("#btn-sandbox-step").addEventListener("click", () => playOne(false));
    $("#btn-sandbox-run").addEventListener("click", () => playOne(true));
    $("#btn-sandbox-reset").addEventListener("click", () => resetExperiment(true));
    $("#btn-to-finale").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    resetExperiment(true);
    timers.push(...revealSteps(document.getElementById(this.id)!, 300, true));
  },
  onLeave() {
    clearTimers(timers);
    timers = [];
    stopChart?.();
    stopChart = null;
    scene?.destroy();
    running = false;
  },
});
