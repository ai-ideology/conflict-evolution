/**
 * 第四节 · 只改变打架损失
 * 受控档位 80 / 100 / 200；每代播放16人完整循环赛并按累计收益替换一人。
 */

import {
  finiteGenerationStep,
  payoffMatrix,
  type PayoffParams,
} from "../core/hawkDove";
import { PopulationScene, type TournamentResult } from "../ui/populationScene";
import { publish } from "../core/pubsub";
import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";

const COUNT = 16;
const VALUE = 50;
const BASE_COST = 100;
const INITIAL_HAWKS = 9;
const MS_PER_AGENT = 115;
const RESULT_PAUSE_MS = 700;

interface ActiveExperiment {
  cost: number;
  worldName: string;
  resultPanel: string;
  generation: number;
}

let scene: PopulationScene | null = null;
let timers: number[] = [];
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
  $("#env-generation").textContent = label;
  $("#env-hawk-count").textContent = String(hawks);
  $("#env-dove-count").textContent = String(COUNT - hawks);
  const counter = $("#env-ratio-counter");
  const nextValue = label + ":" + hawks;
  if (counter.dataset.value !== nextValue) {
    counter.dataset.value = nextValue;
    counter.classList.remove("ratio-bump");
    void counter.offsetWidth;
    counter.classList.add("ratio-bump");
  }
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

function strategyName(move: "hawk" | "dove"): string {
  return move === "hawk" ? "鹰" : "鸽";
}

function replacementText(result: TournamentResult): string {
  if (result.changedIdx === null) {
    return `鹰和鸽都是 ${result.scores[result.bestIdx]} 分，本代不替换任何人。`;
  }
  return `去掉一个最低分的${strategyName(result.worstKind)}（${result.scores[result.worstIdx]}分），加入一个最高分的${strategyName(result.bestKind)}（${result.scores[result.bestIdx]}分）。`;
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
  $("#env-explanation").textContent =
    "正在进行本代循环赛：每个人依次与其余15人结算，完成后再比较总分。";
  $("#env-running-copy").textContent =
    "淡线是全部配对，金线是当前角色正在累计的15场收益。";

  scene.playTournament(params(experiment.cost), MS_PER_AGENT, (result) => {
    if (active !== experiment) return;
    experiment.generation++;
    const hawks = scene!.hawkCount();
    const change = replacementText(result);
    updatePopulationDisplay(
      hawks,
      "第 " + experiment.generation + " 代" +
        (result.changedIdx === null ? "（数量没变）" : ""),
    );
    $("#env-explanation").textContent = change;

    if (result.changedIdx === null) {
      $("#env-running-copy").textContent =
        "全体分数保留在人物头顶。又完整验证了一代，群体确实停在这里。";
      timers.push(window.setTimeout(() => finishExperiment(experiment), RESULT_PAUSE_MS));
      return;
    }

    const following = finiteGenerationStep(hawks, COUNT, params(experiment.cost));
    button.disabled = false;
    if (following === hawks) {
      button.textContent = "再验证一代 →";
      $("#env-running-copy").textContent =
        "全体分数已经显示；群体来到候选稳定数量，还要完整运行一代确认。";
    } else {
      button.textContent = "再演化一代 →";
      $("#env-running-copy").textContent =
        "全体分数已经显示。下一代仍会完成全部配对，并且只替换一个席位。";
    }
  });
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
      "基准世界里，食物价值 50，打架损失 100，16 人循环赛停在 9 鹰 / 7 鸽。",
    );
    timers.push(...revealSteps(document.getElementById(this.id)!, 420, true));
  },
  onLeave() {
    clearTimers(timers);
    timers = [];
    active = null;
    scene?.destroy();
  },
});
