/**
 * 第二节 · 如果大家都这么做？（群体演化 / 频率依赖）
 *
 * 圆形锦标赛（学习 ncase 的信任的进化）：
 *  - 16 个小人围成圈，当前亮线表示抽样展示的一次相遇
 *  - 点「演化一代」→ 逐个点亮每人与其余15人的配对，再比较累计收益
 *  - 一轮结束后：得分最低者换成得分最高者的帽子（复制者动态）
 *  - 到达收益打平点后，再完整演化一代；比例仍不变才确认收敛
 */

import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";
import { publish } from "../core/pubsub";
import { DEFAULT_PARAMS, roundRobinStrategyScores } from "../core/hawkDove";
import { PopulationScene, type TournamentResult } from "../ui/populationScene";
import { drawEvoChart } from "../ui/evoChart";

const COUNT = 16;
const P = DEFAULT_PARAMS; // 16 人真实循环赛 → 9 鹰 / 7 鸽

let scene: PopulationScene | null = null;
let stopChart: (() => void) | null = null;
let timers: number[] = [];

let history: number[] = [];
let generation = 0;
let analysisShown = false;
let chartDrawnThrough = 0;

function updateHUD(): void {
  const hawks = history[history.length - 1]!;
  $("#pop-generation").textContent = `第 ${generation} 代`;
  $("#pop-hawk-count").textContent = `${hawks}`;
  $("#pop-dove-count").textContent = `${COUNT - hawks}`;
  const counter = $("#pop-ratio-counter");
  counter.classList.remove("ratio-bump");
  void counter.offsetWidth;
  counter.classList.add("ratio-bump");
}

function redrawChart(): void {
  stopChart?.();
  const canvas = $("#pop-chart") as HTMLCanvasElement;
  stopChart = drawEvoChart(canvas, history, {
    generations: Math.max(12, history.length - 1),
    height: 170,
    label: `第 ${generation} 代 →`,
    maxValue: COUNT,
    valueLabel: "鹰",
    animateFromIndex: chartDrawnThrough,
  });
  chartDrawnThrough = Math.max(0, history.length - 1);
}

function setControlsEnabled(enabled: boolean): void {
  ($("#btn-evolve") as HTMLButtonElement).disabled = !enabled;
}

function isAtEquilibrium(): boolean {
  if (!scene) return false;
  const scores = roundRobinStrategyScores(scene.hawkCount(), COUNT, P);
  return Math.abs(scores.hawk - scores.dove) < 1e-9;
}

function strategyName(move: "hawk" | "dove"): string {
  return move === "hawk" ? "鹰" : "鸽";
}

function replacementText(result: TournamentResult): string {
  const low = result.scores[result.worstIdx]!;
  const high = result.scores[result.bestIdx]!;
  return `去掉一个最低分的${strategyName(result.worstKind)}（${low}分），加入一个最高分的${strategyName(result.bestKind)}（${high}分）。`;
}

function evolveOneGeneration(): void {
  if (!scene || scene.isBusy()) return;
  setControlsEnabled(false);
  $("#pop-hint").textContent = "淡线是这一代的全部配对；金线正在累计这个人与其余 15 人的收益……";

  const msPerAgent = 220;
  scene.playTournament(P, msPerAgent, (r: TournamentResult) => {
    if (r.changedIdx === null || r.changedTo === null) {
      // 这是到达打平比例后的验证代：记录这一代仍保持原比例，再宣布收敛。
      history.push(scene!.hawkCount());
      generation++;
      updateHUD();
      redrawChart();
      const tiedScore = r.scores[r.bestIdx]!;
      $("#pop-hint").textContent = `鹰和鸽都是 ${tiedScore} 分，不替换任何人。第 ${generation} 代结束，仍是 ${scene!.hawkCount()} 鹰 / ${COUNT - scene!.hawkCount()} 鸽。`;
      timers.push(window.setTimeout(settleDown, 900));
      return;
    }
    history.push(scene!.hawkCount());
    generation++;
    updateHUD();
    redrawChart();
    const reachedEquilibrium = isAtEquilibrium();
    const change = replacementText(r);
    if (reachedEquilibrium) {
      $("#pop-hint").textContent = `${change} 现在来到 9 鹰 / 7 鸽；再演化一代，验证是否稳定。`;
      $("#btn-evolve").textContent = "再验证一代 →";
    } else {
      $("#pop-hint").textContent = change;
    }

    setControlsEnabled(true);
  });
}

/** 收敛：停在最终画面，由用户决定是否进入解析页 */
function settleDown(): void {
  $("#settle-notice").style.display = "block";
  ($("#btn-evolve") as HTMLButtonElement).style.display = "none";
}

function onEvolveClick(): void {
  if (analysisShown || !scene || scene.isBusy()) return;
  evolveOneGeneration();
}

function showAnalysis(): void {
  if (analysisShown) return;
  analysisShown = true;
  $("#pop-playground").style.display = "none";
  $("#pop-analysis").style.display = "block";
  timers = revealSteps($("#pop-analysis"), 500, true);
}

registerSlide({
  id: "slide-population",
  init() {
    const canvas = $("#pop-canvas") as HTMLCanvasElement;
    scene = new PopulationScene(canvas);
    $("#btn-evolve").addEventListener("click", onEvolveClick);
    $("#btn-show-analysis").addEventListener("click", showAnalysis);
    $("#btn-to-extremes").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    history = [2];
    generation = 0;
    analysisShown = false;
    chartDrawnThrough = 0;

    $("#pop-playground").style.display = "block";
    $("#pop-analysis").style.display = "none";
    $("#settle-notice").style.display = "none";
    $("#pop-hint").textContent = "点「演化一代」，看看一代之后谁混得好。";
    const evolveBtn = $("#btn-evolve") as HTMLButtonElement;
    evolveBtn.style.display = "inline-block";
    evolveBtn.disabled = false;
    evolveBtn.textContent = "演化一代 →";
    scene?.setup(COUNT, 2);
    updateHUD();
    redrawChart();

    const el = document.getElementById("slide-population")!;
    timers = revealSteps(el, 400, true);
  },
  onLeave() {
    clearTimers(timers);
    timers = [];
    stopChart?.();
    stopChart = null;
    scene?.destroy();
  },
});
