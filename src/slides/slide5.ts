/**
 * 第四关 · 换一个世界
 * 每次点击只改变参数或推进一代；结论必须由玩家逐代走到。
 */

import { essHawkRatio, payoffMatrix } from "../core/hawkDove";
import { PopulationScene } from "../ui/populationScene";
import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";

const COUNT = 12;
const DEFAULT_VALUE = 50;
const DEFAULT_COST = 100;
const STEP_ANIMATION_MS = 620;

interface Experiment {
  value: number;
  cost: number;
  worldName: string;
  prompt: string;
  resultPanel?: string;
  sandbox?: boolean;
}

interface ActiveExperiment extends Experiment {
  targetHawks: number;
  generation: number;
}

let scene: PopulationScene | null = null;
let timers: number[] = [];
let displayedHawks = 6;
let active: ActiveExperiment | null = null;

function valueInput(): HTMLInputElement {
  return $("#env-value") as HTMLInputElement;
}

function costInput(): HTMLInputElement {
  return $("#env-cost") as HTMLInputElement;
}

function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function payoffText(value: number, cost: number): string {
  return `(${value} - ${cost}) ÷ 2 = ${formatScore(payoffMatrix({ value, cost }).hh)}`;
}

function updateParameterDisplay(value: number, cost: number): void {
  $("#env-value-output").textContent = `${value}`;
  $("#env-cost-output").textContent = `${cost}`;
  $("#env-hh-payoff").textContent = payoffText(value, cost);
}

function updatePopulationDisplay(hawks: number, label: string): void {
  displayedHawks = hawks;
  $("#env-generation").textContent = `${label} · ${hawks} 鹰 / ${COUNT - hawks} 鸽`;
  $("#env-bar-hawk").style.width = `${(hawks / COUNT) * 100}%`;
}

function resetPopulation(value: number, cost: number, name: string, hint: string): void {
  scene?.setup(COUNT, 6, true);
  updateParameterDisplay(value, cost);
  updatePopulationDisplay(6, "第 0 代");
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

function moveOneToward(targetHawks: number): void {
  if (!scene || targetHawks === displayedHawks) return;
  const to = targetHawks > displayedHawks ? "hawk" : "dove";
  const from = to === "hawk" ? "dove" : "hawk";
  const candidates = scene.kinds()
    .map((kind, index) => (kind === from ? index : -1))
    .filter((index) => index >= 0);
  const index = candidates[Math.floor(Math.random() * candidates.length)];
  if (index === undefined) return;
  scene.spotlight(index, STEP_ANIMATION_MS - 80);
  scene.evolveOne(index, to);
}

function stepButton(): HTMLButtonElement {
  return $(active?.sandbox ? "#btn-env-run-sandbox" : "#btn-env-next-generation") as HTMLButtonElement;
}

function setSandboxLocked(locked: boolean): void {
  valueInput().disabled = locked;
  costInput().disabled = locked;
  ($("#btn-env-reset-sandbox") as HTMLButtonElement).disabled = locked;
}

function prepareExperiment(experiment: Experiment): void {
  const targetHawks = Math.round(essHawkRatio(experiment) * COUNT);
  active = { ...experiment, targetHawks, generation: 0 };
  resetPopulation(experiment.value, experiment.cost, experiment.worldName, experiment.prompt);

  if (experiment.sandbox) {
    setSandboxLocked(true);
    $("#env-sandbox-preview").textContent = "参数已经改变，但群体还没动。点击“演化一代”观察第一步。";
    const button = $("#btn-env-run-sandbox") as HTMLButtonElement;
    button.textContent = "演化一代 →";
  } else {
    $("#env-running-title").textContent = experiment.worldName;
    $("#env-running-copy").textContent = `${experiment.prompt} 参数已经改变，群体仍是 6 鹰 / 6 鸽。`;
    ($("#btn-env-next-generation") as HTMLButtonElement).textContent = "演化一代 →";
    showPhase("#env-step-running");
  }
}

function describeSandbox(value: number, cost: number, hawks: number): string {
  if (value >= cost) {
    return `稳定结果：${hawks} 鹰 / ${COUNT - hawks} 鸽。资源价值不低于冲突代价，强硬策略占满了群体。`;
  }
  return `稳定结果：${hawks} 鹰 / ${COUNT - hawks} 鸽。食物越接近冲突代价，鹰通常越多；差距越大，鸽通常越多。`;
}

function finishExperiment(done: ActiveExperiment): void {
  active = null;
  $("#env-world-name").textContent = "群体稳定了";
  if (done.sandbox) {
    setSandboxLocked(false);
    $("#env-sandbox-preview").textContent = describeSandbox(done.value, done.cost, displayedHawks);
    ($("#btn-env-run-sandbox") as HTMLButtonElement).textContent = "用这组参数重新开始 →";
  } else if (done.resultPanel) {
    showPhase(done.resultPanel);
  }
}

function advanceGeneration(): void {
  if (!active || !scene) return;
  const experiment = active;
  const button = stepButton();
  button.disabled = true;
  experiment.generation++;

  if (displayedHawks === experiment.targetHawks) {
    updatePopulationDisplay(displayedHawks, `第 ${experiment.generation} 代（比例没变）`);
    $("#env-explanation").textContent = "又演化了一代，比例仍然没变。现在才能确认：群体稳定了。";
    timers.push(window.setTimeout(() => finishExperiment(experiment), STEP_ANIMATION_MS));
    return;
  }

  const nextHawks = displayedHawks + (displayedHawks < experiment.targetHawks ? 1 : -1);
  moveOneToward(nextHawks);
  updatePopulationDisplay(nextHawks, `第 ${experiment.generation} 代`);
  $("#env-explanation").textContent = "这一代只发生一件事：一名低收益策略换了帽子。";

  timers.push(window.setTimeout(() => {
    if (active !== experiment) return;
    button.disabled = false;
    if (displayedHawks === experiment.targetHawks) {
      button.textContent = "再验证一代 →";
      if (!experiment.sandbox) {
        $("#env-running-copy").textContent = "收益已经打平，但先别急着下结论。再走一代，看看比例会不会改变。";
      }
    } else {
      button.textContent = "再演化一代 →";
      if (!experiment.sandbox) {
        $("#env-running-copy").textContent = "群体还没停下来。下一代是否继续，由你决定。";
      }
    }
  }, STEP_ANIMATION_MS));
}

function startValueExperiment(): void {
  active = null;
  resetPopulation(DEFAULT_VALUE, DEFAULT_COST, "回到原来的世界", "打架损失恢复到 100 分。接下来只改变食物价值。");
  showPhase("#env-step-value-high");
}

function updateSandboxPreview(): void {
  if (active?.sandbox) return;
  const value = Number(valueInput().value);
  const cost = Number(costInput().value);
  $("#env-value-slider-output").textContent = `${value}`;
  $("#env-cost-slider-output").textContent = `${cost}`;
  $("#env-sandbox-preview").textContent =
    `两只鹰相遇时，平均每只得到 ${formatScore(payoffMatrix({ value, cost }).hh)} 分。群体还没有变化。`;
}

function openSandbox(): void {
  active = null;
  valueInput().value = `${DEFAULT_VALUE}`;
  costInput().value = `${DEFAULT_COST}`;
  updateSandboxPreview();
  resetPopulation(DEFAULT_VALUE, DEFAULT_COST, "等待你的新世界", "先调参数作出猜想，再提交这组参数。");
  ($("#btn-env-run-sandbox") as HTMLButtonElement).textContent = "运行这个世界 →";
  showPhase("#env-sandbox");
}

function runSandbox(): void {
  if (active?.sandbox) {
    advanceGeneration();
    return;
  }
  prepareExperiment({
    value: Number(valueInput().value),
    cost: Number(costInput().value),
    worldName: "你创造的世界",
    prompt: "从相同的 6 鹰 / 6 鸽开始。",
    sandbox: true,
  });
}

function resetSandboxInputs(): void {
  valueInput().value = `${DEFAULT_VALUE}`;
  costInput().value = `${DEFAULT_COST}`;
  updateSandboxPreview();
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
    $("#btn-env-cost-high").addEventListener("click", () => prepareExperiment({
      value: 50, cost: 150, worldName: "冲突变得更昂贵",
      prompt: "食物仍值 50 分，打架损失提高到 150 分。", resultPanel: "#env-result-cost-high",
    }));
    $("#btn-env-cost-low").addEventListener("click", () => prepareExperiment({
      value: 50, cost: 50, worldName: "冲突变得更便宜",
      prompt: "食物仍值 50 分，打架损失降低到 50 分。", resultPanel: "#env-result-cost-low",
    }));
    $("#btn-env-next-generation").addEventListener("click", advanceGeneration);
    $("#btn-env-start-value").addEventListener("click", startValueExperiment);
    $("#btn-env-value-high").addEventListener("click", () => prepareExperiment({
      value: 80, cost: 100, worldName: "食物变得更珍贵",
      prompt: "打架损失仍是 100 分，食物价值提高到 80 分。", resultPanel: "#env-result-value-high",
    }));
    $("#btn-env-value-low").addEventListener("click", () => prepareExperiment({
      value: 20, cost: 100, worldName: "食物变得没那么珍贵",
      prompt: "打架损失仍是 100 分，食物价值降低到 20 分。", resultPanel: "#env-result-value-low",
    }));
    $("#btn-env-open-sandbox").addEventListener("click", openSandbox);
    $("#btn-env-run-sandbox").addEventListener("click", runSandbox);
    $("#btn-env-reset-sandbox").addEventListener("click", resetSandboxInputs);
    valueInput().addEventListener("input", updateSandboxPreview);
    costInput().addEventListener("input", updateSandboxPreview);
    $("#btn-replay-all").addEventListener("click", () => {
      window.location.hash = "#0";
      window.location.reload();
    });
  },
  onEnter() {
    clearTimers(timers);
    timers = [];
    active = null;
    resetPanels();
    setSandboxLocked(false);
    resetPopulation(DEFAULT_VALUE, DEFAULT_COST, "原来的世界", "上一关里，这个群体最终停在了一半鹰、一半鸽。");
    $("#env-generation").textContent = "现在 · 6 鹰 / 6 鸽";
    timers.push(...revealSteps(document.getElementById(this.id)!, 420, true));
  },
  onLeave() {
    clearTimers(timers);
    timers = [];
    active = null;
    scene?.destroy();
  },
});
