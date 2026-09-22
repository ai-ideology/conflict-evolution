/**
 * 第三节 · 一个突变行为如何改变极端群体
 * 同一个圆形群体舞台，严格按“观察 → 投放 → 一代一停 → 验证”推进。
 */

import { DEFAULT_PARAMS } from "../core/hawkDove";
import { publish } from "../core/pubsub";
import { PopulationScene, type TournamentResult } from "../ui/populationScene";
import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";

const COUNT = 16;
const P = DEFAULT_PARAMS;

type World = "hawk" | "dove";

let scene: PopulationScene | null = null;
let timers: number[] = [];
let generation = 0;
let currentWorld: World = "hawk";

function showPhase(selector: string): void {
  document.querySelectorAll<HTMLElement>("#slide-extremes .extreme-phase")
    .forEach((panel) => (panel.style.display = "none"));
  const panel = $(selector);
  panel.style.display = "block";
  panel.classList.remove("env-panel-enter");
  void panel.offsetWidth;
  panel.classList.add("env-panel-enter");
}

function updateHUD(message: string): void {
  const hawks = scene?.hawkCount() ?? 0;
  updateHUDWithCount(hawks, message);
}

function updateHUDWithCount(hawks: number, message: string): void {
  $("#extreme-generation").textContent = `第 ${generation} 代`;
  $("#extreme-hawk-count").textContent = `${hawks}`;
  $("#extreme-dove-count").textContent = `${COUNT - hawks}`;
  const counter = $("#extreme-ratio-counter");
  const nextValue = `${generation}:${hawks}`;
  if (counter.dataset.value !== nextValue) {
    counter.dataset.value = nextValue;
    counter.classList.remove("ratio-bump");
    void counter.offsetWidth;
    counter.classList.add("ratio-bump");
  }
  $("#extreme-hint").textContent = message;
}

function setButtonEnabled(selector: string, enabled: boolean): void {
  ($(selector) as HTMLButtonElement).disabled = !enabled;
}

function strategyName(move: "hawk" | "dove"): string {
  return move === "hawk" ? "鹰" : "鸽";
}

function scoreChange(result: TournamentResult): string {
  if (result.changedIdx === null) {
    return `所有人都是 ${result.scores[result.bestIdx]} 分，本代不替换。`;
  }
  return `去掉一个最低分的${strategyName(result.worstKind)}（${result.scores[result.worstIdx]}分），加入一个最高分的${strategyName(result.bestKind)}（${result.scores[result.bestIdx]}分）。`;
}

function observePureWorld(world: World): void {
  if (!scene || scene.isBusy()) return;
  const button = world === "hawk" ? "#btn-extreme-hawk-round" : "#btn-extreme-dove-round";
  setButtonEnabled(button, false);
  updateHUD("正在逐个观察：每个个体会和群体中的其他人相遇……");
  scene.playTournament(P, 150, () => {
    if (world === "hawk") {
      updateHUD("每只鹰与其余15人交手：每场 -25 分，一轮累计 -375 分。");
      showPhase("#extreme-hawk-cost");
    } else {
      updateHUD("每只鸽与其余15人相遇：每场 25 分，一轮累计 375 分。");
      showPhase("#extreme-dove-benefit");
    }
  });
}

function introduce(kind: World): void {
  if (!scene || scene.isBusy()) return;
  scene.inject(kind);
  generation = 0;
  const button = kind === "dove" ? "#btn-extreme-hawk-evolve" : "#btn-extreme-dove-evolve";
  const phase = kind === "dove" ? "#extreme-hawk-evolve" : "#extreme-dove-evolve";
  updateHUDWithCount(
    kind === "dove" ? COUNT - 1 : 1,
    kind === "dove"
      ? "一只鸽出现了：它面对鹰会退让，0 分仍然比 -25 分高。"
      : "一只鹰出现了：它遇到鸽能独占 50 分，比平分食物更多。",
  );
  showPhase(phase);
  setButtonEnabled(button, false);
  timers.push(window.setTimeout(() => setButtonEnabled(button, true), 650));
}

function evolveOneGeneration(world: World): void {
  if (!scene || scene.isBusy()) return;
  const button = world === "hawk" ? "#btn-extreme-hawk-evolve" : "#btn-extreme-dove-evolve";
  const title = world === "hawk" ? "#extreme-hawk-evolve-title" : "#extreme-dove-evolve-title";
  const copy = world === "hawk" ? "#extreme-hawk-evolve-copy" : "#extreme-dove-evolve-copy";
  setButtonEnabled(button, false);
  $(copy).textContent = "这一代正在结算。先看清谁的关系线亮起、谁换了帽子……";

  scene.playTournament(P, 135, (result) => {
    generation++;
    const hawks = scene!.hawkCount();
    updateHUD(
      result.changedIdx === null
        ? `${scoreChange(result)} 又过了一代，仍然是 ${hawks} 鹰 / ${COUNT - hawks} 鸽。`
        : `${scoreChange(result)} 现在是 ${hawks} 鹰 / ${COUNT - hawks} 鸽。`,
    );

    if (result.changedIdx === null) {
      if (world === "hawk") showPhase("#extreme-hawk-result");
      else showPhase("#extreme-final");
      return;
    }

    if (hawks === 9) {
      $(title).textContent = "鹰和鸽的收益打平了。";
      $(copy).textContent = "但一次打平还不能证明稳定。再演化一代，看看比例会不会改变。";
      ($(button) as HTMLButtonElement).textContent = "再验证一代 →";
    } else {
      const growing = world === "hawk" ? "鸽" : "鹰";
      $(title).textContent = `${growing}又多了一只。`;
      $(copy).textContent = "群体还没停下来。由你决定什么时候进入下一代。";
      ($(button) as HTMLButtonElement).textContent = "再演化一代 →";
    }
    setButtonEnabled(button, true);
  });
}

function switchToDoveWorld(): void {
  currentWorld = "dove";
  generation = 0;
  scene?.setup(COUNT, 0, false);
  $("#extreme-world-name").textContent = "一个全是鸽的世界";
  updateHUD("没有鹰，也没有打架。这个和平世界会一直稳定吗？");
  showPhase("#extreme-dove-intro");
}

function reset(): void {
  currentWorld = "hawk";
  generation = 0;
  scene?.setup(COUNT, COUNT, false);
  $("#extreme-world-name").textContent = "一个全是鹰的世界";
  updateHUD("先看看：当每个人都选择强硬，会发生什么？");
  showPhase("#extreme-hawk-intro");
  ([$("#btn-extreme-hawk-round"), $("#btn-extreme-dove-round"), $("#btn-extreme-hawk-evolve"), $("#btn-extreme-dove-evolve")] as HTMLButtonElement[])
    .forEach((button) => {
      button.disabled = false;
      if (button.id.includes("evolve")) button.textContent = "演化一代 →";
    });
}

registerSlide({
  id: "slide-extremes",
  init() {
    scene = new PopulationScene($("#extreme-canvas") as HTMLCanvasElement);
    $("#btn-extreme-hawk-round").addEventListener("click", () => observePureWorld("hawk"));
    $("#btn-extreme-add-dove").addEventListener("click", () => introduce("dove"));
    $("#btn-extreme-hawk-evolve").addEventListener("click", () => evolveOneGeneration("hawk"));
    $("#btn-extreme-switch-dove").addEventListener("click", switchToDoveWorld);
    $("#btn-extreme-dove-round").addEventListener("click", () => observePureWorld("dove"));
    $("#btn-extreme-add-hawk").addEventListener("click", () => introduce("hawk"));
    $("#btn-extreme-dove-evolve").addEventListener("click", () => evolveOneGeneration("dove"));
    $("#btn-to-env").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    clearTimers(timers);
    timers = [];
    reset();
    timers.push(...revealSteps(document.getElementById(this.id)!, 380, true));
  },
  onLeave() {
    clearTimers(timers);
    timers = [];
    scene?.destroy();
  },
});
