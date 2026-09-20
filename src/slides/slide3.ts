/**
 * 第二关 · 如果大家都这么做？（群体演化 / 频率依赖）
 *
 * 圆形锦标赛（学习 ncase 的信任的进化）：
 *  - 12 个小人围成圈，两两灰色连线表示每代要两两对局
 *  - 点「演化一代」→ 每个个体轮流被聚光（金色辐射线），累计其与所有人对局的总分
 *  - 一轮结束后：得分最低者换成得分最高者的帽子（复制者动态）
 *  - 到达收益打平点后，再完整演化一代；比例仍不变才确认收敛
 */

import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";
import { publish } from "../core/pubsub";
import { DEFAULT_PARAMS, doveFitness, hawkFitness } from "../core/hawkDove";
import { PopulationScene, type TournamentResult } from "../ui/populationScene";
import { drawEvoChart } from "../ui/evoChart";

const COUNT = 12;
const P = DEFAULT_PARAMS; // V=50 C=100 → 平衡点 50%

let scene: PopulationScene | null = null;
let stopChart: (() => void) | null = null;
let timers: number[] = [];

let history: number[] = [];
let generation = 0;
let analysisShown = false;

function updateHUD(): void {
  const hawks = history[history.length - 1]!;
  $("#gen-count").textContent = `${generation}`;
  $("#pop-ratio").textContent = `${hawks} 鹰 / ${COUNT - hawks} 鸽`;
  $("#pop-bar-hawk").style.width = `${(hawks / COUNT) * 100}%`;
}

function redrawChart(): void {
  stopChart?.();
  const canvas = $("#pop-chart") as HTMLCanvasElement;
  const series = history.map((h) => h / COUNT);
  stopChart = drawEvoChart(canvas, series, {
    generations: Math.max(12, history.length - 1),
    height: 170,
    label: `第 ${generation} 代 →`,
  });
}

function setControlsEnabled(enabled: boolean): void {
  ($("#btn-evolve") as HTMLButtonElement).disabled = !enabled;
}

function isAtEquilibrium(): boolean {
  if (!scene) return false;
  const pop = { hawkRatio: scene.hawkCount() / COUNT };
  return Math.abs(hawkFitness(pop, P) - doveFitness(pop, P)) < 1e-9;
}

function evolveOneGeneration(): void {
  if (!scene || scene.isBusy()) return;
  setControlsEnabled(false);
  $("#pop-hint").textContent = "正在按当前群体比例计算每种策略的长期收益……";

  const msPerAgent = 220;
  scene.playTournament(P, msPerAgent, (r: TournamentResult) => {
    if (r.changedIdx === null || r.changedTo === null) {
      // 这是到达打平比例后的验证代：记录这一代仍保持原比例，再宣布收敛。
      history.push(scene!.hawkCount());
      generation++;
      updateHUD();
      redrawChart();
      $("#pop-hint").textContent = `第 ${generation} 代结束，仍然是 ${scene!.hawkCount()} 鹰 / ${COUNT - scene!.hawkCount()} 鸽。`;
      timers.push(window.setTimeout(settleDown, 900));
      return;
    }
    history.push(scene!.hawkCount());
    generation++;
    updateHUD();
    redrawChart();
    const reachedEquilibrium = isAtEquilibrium();
    if (reachedEquilibrium) {
      $("#pop-hint").textContent = "现在鹰和鸽的收益打平了。再演化一代，看看比例会不会改变。";
      $("#btn-evolve").textContent = "再验证一代 →";
    } else {
      $("#pop-hint").textContent = "低收益策略中的一个个体，换上了高收益策略的帽子。";
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
