/** 第七关 · 固定总资源下，用公共投入提高争抢代价。 */
import { discreteGenerationStep, type PayoffParams } from "../core/hawkDove";
import {
  expectedLedger,
  getInstitutionPolicy,
  stableLedger,
  type InstitutionPolicy,
  type InstitutionPolicyId,
} from "../core/institution";
import { PopulationScene } from "../ui/populationScene";
import { registerSlide } from "./Slide";
import { $, clearTimers, revealSteps } from "./helpers";

const COUNT = 16;
const INITIAL_HAWKS = 8;
const STEP_MS = 680;

let scene: PopulationScene | null = null;
let timers: number[] = [];
let stopped = false;
let currentHawks = INITIAL_HAWKS;
let currentPolicy: InstitutionPolicy = getInstitutionPolicy("none");
let generation = 0;
let verified = false;
let smallPrediction: string | null = null;
let finalGuessed = false;

function params(policy: InstitutionPolicy): PayoffParams {
  return { value: policy.value, cost: policy.conflictCost };
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function showPhase(selector: string): void {
  document.querySelectorAll<HTMLElement>("#order-playground .order-phase")
    .forEach((panel) => (panel.style.display = "none"));
  const panel = $(selector);
  panel.style.display = "block";
  panel.classList.remove("env-panel-enter");
  void panel.offsetWidth;
  panel.classList.add("env-panel-enter");
}

function markStep(step: string): void {
  document.querySelectorAll<HTMLElement>("#slide-order [data-order-step]")
    .forEach((item) => item.classList.toggle("active", item.dataset.orderStep === step));
}

function updateStage(note: string): void {
  const ledger = expectedLedger(currentPolicy, { hawkCount: currentHawks });
  $("#order-generation").textContent = "第 " + generation + " 代";
  $("#order-ratio").textContent = currentHawks + " 鹰 / " + (COUNT - currentHawks) + " 鸽";
  $("#order-gross").textContent = fmt(ledger.gross);
  $("#order-cost").textContent = fmt(ledger.organization);
  $("#order-conflict").textContent = fmt(ledger.conflictLoss);
  $("#order-net").textContent = fmt(ledger.net);
  $("#order-retained").textContent = fmt(ledger.net);
  $("#order-fund-value").textContent = fmt(ledger.organization);
  $("#order-fund-copy").textContent =
    "每份资源拿出 " + currentPolicy.organizationCost;
  $("#order-note").textContent = note;
}

function resetWorld(policyId: InstitutionPolicyId, note: string): void {
  currentPolicy = getInstitutionPolicy(policyId);
  currentHawks = INITIAL_HAWKS;
  generation = 0;
  verified = false;
  scene?.setup(COUNT, INITIAL_HAWKS, true, 20260921);
  updateStage(note);
}

function moveOne(nextHawks: number): void {
  if (!scene || nextHawks === currentHawks) return;
  const to = nextHawks > currentHawks ? "hawk" : "dove";
  const from = to === "hawk" ? "dove" : "hawk";
  const index = scene.kinds().findIndex((kind) => kind === from);
  if (index < 0) return;
  scene.spotlight(index, STEP_MS - 100);
  scene.evolveOne(index, to);
}

function openBaseline(): void {
  markStep("baseline");
  updateStage("基准世界已经稳定在 8 鹰 / 8 鸽；先把 400 点资源逐项对账。");
  showPhase("#order-baseline");
}

function prepareSmall(): void {
  resetWorld(
    "light",
    "只换上少量投入参数；群体还没有演化，所以仍是 8 鹰 / 8 鸽。",
  );
  // 重置预测：必须先猜，才能开始演化
  smallPrediction = null;
  document.querySelectorAll<HTMLElement>(".order-small-predict")
    .forEach((b) => b.classList.remove("chosen"));
  ($("#btn-order-small-next") as HTMLButtonElement).disabled = true;
  markStep("small");
  showPhase("#order-small-ready");
}

/** 7-5：回应玩家在 7-3 的预测 */
function smallEcho(): string {
  switch (smallPrediction) {
    case "win":
      return "你刚才猜「省下的更多」——猜对了：省下的冲突损耗（110）远多于组织花掉的 40。";
    case "tie":
      return "你刚才猜「刚好抵消」——实际上省下的（110）比花掉的（40）多不少。";
    case "lose":
      return "你刚才猜「组织花得更多」——这一次相反：40 换回了 110。但这不是永远成立，往下看。";
    default:
      return "";
  }
}

function smallFirstStep(): void {
  showPhase("#order-small-running");
  advanceSmall();
}

function advanceSmall(): void {
  if (!scene || scene.isBusy() || stopped) return;
  const next = discreteGenerationStep(currentHawks, COUNT, params(currentPolicy));
  if (next === currentHawks) {
    if (!verified) {
      verified = true;
      generation++;
      updateStage("又验证了一代，比例仍然没变；少量投入世界确实停在这里。");
      timers.push(window.setTimeout(() => {
        $("#order-small-echo").textContent = smallEcho();
        showPhase("#order-small-result");
      }, STEP_MS));
    }
    return;
  }
  generation++;
  moveOne(next);
  currentHawks = next;
  updateStage("这一代只改变一个席位；争抢越不划算，强硬策略的期望收益越低。");
  const button = $("#btn-order-small-generation") as HTMLButtonElement;
  const following = discreteGenerationStep(currentHawks, COUNT, params(currentPolicy));
  button.textContent = following === currentHawks ? "再验证一代 →" : "再演化一代 →";
  $("#order-small-copy").textContent =
    "第 " + generation + " 代结束：群体净收益现在是 " +
    fmt(expectedLedger(currentPolicy, { hawkCount: currentHawks }).net) + "。";
}

function prepareMedium(): void {
  resetWorld(
    "medium",
    "回到相同的 8 鹰 / 8 鸽起点；只把秩序投入改成每份 10 点。",
  );
  markStep("medium");
  showPhase("#order-medium-predict");
}

function runAutomatic(policyId: "medium" | "high", resultPhase: string): void {
  resetWorld(
    policyId,
    "从相同起点运行；每代仍然只改变一个席位。",
  );
  markStep(policyId);
  $("#order-auto-title").textContent =
    policyId === "medium" ? "中等投入正在演化" : "较高投入正在演化";
  showPhase("#order-auto-running");

  const step = () => {
    if (stopped || !scene) return;
    const next = discreteGenerationStep(currentHawks, COUNT, params(currentPolicy));
    if (next === currentHawks) {
      generation++;
      updateStage("再验证一代，比例没有变化；现在打开这一档的稳定账本。");
      timers.push(window.setTimeout(() => showPhase(resultPhase), STEP_MS));
      return;
    }
    generation++;
    moveOne(next);
    currentHawks = next;
    const ledger = expectedLedger(currentPolicy, { hawkCount: currentHawks });
    $("#order-auto-copy").textContent =
      "第 " + generation + " 代："
      + currentHawks + " 鹰 / " + (COUNT - currentHawks)
      + " 鸽，期望净收益 " + fmt(ledger.net) + "。";
    updateStage("重复过程正在压缩播放，但每一代仍只改变一个席位。");
    timers.push(window.setTimeout(step, STEP_MS));
  };
  timers.push(window.setTimeout(step, 420));
}

function showFinal(): void {
  currentPolicy = getInstitutionPolicy("medium");
  currentHawks = currentPolicy.stableHawkCount;
  generation = 0;
  scene?.setup(COUNT, currentHawks, true, 20260921);
  updateStage("四个世界的总资源始终相同；先自己判断哪一个留下最多。");
  markStep("compare");
  resetFinalQuiz();
  showPhase("#order-final");
}

/** 7-8：先让玩家选择，再翻开总账 */
function resetFinalQuiz(): void {
  finalGuessed = false;
  $("#order-final").classList.remove("is-revealed");
  document.querySelectorAll<HTMLElement>(".order-guess").forEach((b) => {
    b.classList.remove("chosen", "best");
    (b.querySelector("strong") as HTMLElement).textContent = "?";
  });
  $("#order-final-reveal").style.display = "none";
  $("#order-final-question").style.display = "";
  $("#order-final-hint").style.display = "";
}

function guessFinal(guessId: string, button: HTMLElement): void {
  if (finalGuessed) return;
  finalGuessed = true;
  $("#order-final").classList.add("is-revealed");

  // 翻开四本账（数字来自引擎，不硬编码）
  document.querySelectorAll<HTMLElement>(".order-guess").forEach((b) => {
    const id = b.dataset.guess as InstitutionPolicyId;
    const net = stableLedger(id).net;
    (b.querySelector("strong") as HTMLElement).textContent = `净收益 ${fmt(net)}`;
  });
  document.querySelector<HTMLElement>('.order-guess[data-guess="medium"]')
    ?.classList.add("best");
  button.classList.add("chosen");
  $("#order-final-question").style.display = "none";
  $("#order-final-hint").style.display = "none";

  $("#order-final-verdict").textContent =
    guessId === "medium"
      ? "没错——减少冲突最多的那一档，并不是留下最多的一档。中等投入的 280 才是最高。"
      : "看起来值得再想想：减少冲突最多的那一档，留下的却不是最多。组织本身也要花资源。";

  const reveal = $("#order-final-reveal");
  reveal.style.display = "block";
  timers.push(...revealSteps(reveal, 500, true));
}

function reset(): void {
  stopped = false;
  clearTimers(timers);
  timers = [];
  resetWorld(
    "none",
    "所有数字都是按 16 个比例席位折算的长期期望，不是一次具体抽签的保证。",
  );
  markStep("baseline");
  showPhase("#order-intro");
}

registerSlide({
  id: "slide-order",
  init() {
    scene = new PopulationScene($("#order-canvas") as HTMLCanvasElement);
    $("#btn-order-baseline").addEventListener("click", openBaseline);
    $("#btn-order-small").addEventListener("click", prepareSmall);
    $("#btn-order-small-next").addEventListener("click", smallFirstStep);
    $("#btn-order-small-generation").addEventListener("click", advanceSmall);
    $("#btn-order-medium").addEventListener("click", prepareMedium);
    document.querySelectorAll<HTMLElement>(".order-predict")
      .forEach((button) => button.addEventListener("click", () =>
        runAutomatic("medium", "#order-medium-result")));
    $("#btn-order-high").addEventListener("click", () =>
      runAutomatic("high", "#order-high-result"));
    $("#btn-order-compare").addEventListener("click", showFinal);
    $("#btn-order-replay").addEventListener("click", reset);
    document.querySelectorAll<HTMLElement>(".order-small-predict")
      .forEach((button) => button.addEventListener("click", () => {
        smallPrediction = button.dataset.predict ?? null;
        document.querySelectorAll<HTMLElement>(".order-small-predict")
          .forEach((b) => b.classList.toggle("chosen", b === button));
        ($("#btn-order-small-next") as HTMLButtonElement).disabled = false;
      }));
    document.querySelectorAll<HTMLElement>(".order-guess")
      .forEach((button) => button.addEventListener("click", () =>
        guessFinal(button.dataset.guess ?? "", button)));
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
