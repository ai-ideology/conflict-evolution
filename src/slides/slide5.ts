/**
 * 第四关 · 只改变打架损失
 * 受控档位 80 / 100 / 200；每代统一调用核心离散演化规则。
 */

import {
  discreteGenerationStep,
  payoffMatrix,
  type PayoffParams,
} from "../core/hawkDove";
import { PopulationScene } from "../ui/populationScene";
import { publish } from "../core/pubsub";
import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";

const COUNT = 16;
const VALUE = 50;
const BASE_COST = 100;
const INITIAL_HAWKS = 8;
const STEP_ANIMATION_MS = 620;

interface ActiveExperiment {
  cost: number;
  worldName: string;
  resultPanel: string;
  generation: number;
}

let scene: PopulationScene | null = null;
let timers: number[] = [];
let displayedHawks = INITIAL_HAWKS;
let active: ActiveExperiment | null = null;

function params(cost: number): PayoffParams {
  return { value: VALUE, cost };
}

function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return rounded > 0 ? "+" + rounded : String(rounded);
}

function updateParameterDisplay(cost: number): void {
  $("#env-value-output").textContent = String(VALUE);
  $("#env-cost-output").textContent = String(cost);
  const hh = payoffMatrix(params(cost)).hh;
  $("#env-hh-payoff").textContent =
    "(" + VALUE + " - " + cost + ") ÷ 2 = " + formatScore(hh);
}

function updatePopulationDisplay(hawks: number, label: string): void {
  displayedHawks = hawks;
  $("#env-generation").textContent =
    label + " · " + hawks + " 鹰 / " + (COUNT - hawks) + " 鸽";
  $("#env-bar-hawk").style.width = String((hawks / COUNT) * 100) + "%";
}

function resetPopulation(cost: number, name: string, hint: string): void {
  scene?.setup(COUNT, INITIAL_HAWKS, true);
  updateParameterDisplay(cost);
  updatePopulationDisplay(INITIAL_HAWKS, "第 0 代");
  $("#env-world-name").textContent = name;
  $("#env-explanation").textContent = hint;
}

function showPhase(selector: string): void {
  document.querySelectorAll<HTMLElement>("#env-playground .env-phase")
    .forEach((panel) => (panel.style.display = "none"));
  const panel = $(selector);
  panel.style.display = "block";
  panel.classList.remove("env-panel-enter");
  void panel.offsetWidth;
  panel.classList.add("env-panel-enter");
}

function moveOne(nextHawks: number): void {
  if (!scene || nextHawks === displayedHawks) return;
  const to = nextHawks > displayedHawks ? "hawk" : "dove";
  const from = to === "hawk" ? "dove" : "hawk";
  const candidates = scene.kinds()
    .map((kind, index) => (kind === from ? index : -1))
    .filter((index) => index >= 0);
  const index = candidates[0];
  if (index === undefined) return;
  scene.spotlight(index, STEP_ANIMATION_MS - 80);
  scene.evolveOne(index, to);
}

function prepareExperiment(cost: number, worldName: string, resultPanel: string): void {
  active = { cost, worldName, resultPanel, generation: 0 };
  resetPopulation(
    cost,
    worldName,
    "食物仍值 " + VALUE + " 分，打架损失改为 " + cost + " 分。参数变了，群体还没有动。",
  );
  $("#env-running-title").textContent = worldName;
  $("#env-running-copy").textContent = "先预测鹰会变多还是变少，再亲手推进一代。";
  const button = $("#btn-env-next-generation") as HTMLButtonElement;
  button.textContent = "演化一代 →";
  button.disabled = false;
  showPhase("#env-step-running");
}

function finishExperiment(done: ActiveExperiment): void {
  active = null;
  $("#env-world-name").textContent = "这个世界验证完成";
  showPhase(done.resultPanel);
}

function advanceGeneration(): void {
  if (!active || !scene || scene.isBusy()) return;
  const experiment = active;
  const button = $("#btn-env-next-generation") as HTMLButtonElement;
  button.disabled = true;
  experiment.generation++;

  const nextHawks = discreteGenerationStep(
    displayedHawks,
    COUNT,
    params(experiment.cost),
  );

  if (nextHawks === displayedHawks) {
    updatePopulationDisplay(
      displayedHawks,
      "第 " + experiment.generation + " 代（比例没变）",
    );
    $("#env-explanation").textContent =
      "又完整验证了一代，比例仍然没变。现在才能确认这个教学模型停在了这里。";
    timers.push(window.setTimeout(() => finishExperiment(experiment), STEP_ANIMATION_MS));
    return;
  }

  moveOne(nextHawks);
  $("#env-explanation").textContent =
    "这一代只发生一件事：一名低收益策略转向了高收益策略。";

  timers.push(window.setTimeout(() => {
    if (active !== experiment) return;
    updatePopulationDisplay(nextHawks, "第 " + experiment.generation + " 代");
    const following = discreteGenerationStep(nextHawks, COUNT, params(experiment.cost));
    button.disabled = false;
    if (following === nextHawks) {
      button.textContent = "再验证一代 →";
      $("#env-running-copy").textContent =
        "两种策略的期望收益已经打平，但还要再运行一代才能确认。";
    } else {
      button.textContent = "再演化一代 →";
      $("#env-running-copy").textContent =
        "群体还没停下来。下一代仍然只会改变一个席位。";
    }
  }, STEP_ANIMATION_MS));
}

function showConclusion(): void {
  active = null;
  resetPopulation(
    BASE_COST,
    "三个世界的结果",
    "只改变打架损失，群体就停在不同的比例。",
  );
  showPhase("#env-sandbox");
}

function resetPanels(): void {
  document.querySelectorAll<HTMLElement>("#env-playground .env-phase")
    .forEach((panel) => (panel.style.display = "none"));
  $("#env-step-cost-high").style.display = "block";
}

registerSlide({
  id: "slide-env-teaser",
  init() {
    scene = new PopulationScene($("#env-canvas") as HTMLCanvasElement);
    $("#btn-env-cost-high").addEventListener("click", () =>
      prepareExperiment(200, "冲突变得更惨", "#env-result-cost-high"));
    $("#btn-env-cost-low").addEventListener("click", () =>
      prepareExperiment(80, "冲突变得较便宜", "#env-result-cost-low"));
    $("#btn-env-next-generation").addEventListener("click", advanceGeneration);
    $("#btn-env-start-value").addEventListener("click", showConclusion);
    $("#btn-replay-all").addEventListener("click", () => {
      window.location.hash = "#0";
      window.location.reload();
    });
    $("#btn-to-scarcity").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    clearTimers(timers);
    timers = [];
    active = null;
    resetPanels();
    resetPopulation(
      BASE_COST,
      "原来的世界",
      "基准世界里，食物价值 50，打架损失 100，群体停在 8 鹰 / 8 鸽。",
    );
    $("#env-generation").textContent = "现在 · 8 鹰 / 8 鸽";
    timers.push(...revealSteps(document.getElementById(this.id)!, 420, true));
  },
  onLeave() {
    clearTimers(timers);
    timers = [];
    active = null;
    scene?.destroy();
  },
});
