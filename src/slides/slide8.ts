/** 第七节 · 固定总资源下，用公共投入提高争抢代价。 */
import { finiteGenerationStep, type PayoffParams } from "../core/hawkDove";
import {
  expectedLedger,
  getInstitutionPolicy,
  stableLedger,
  type InstitutionPolicy,
  type InstitutionPolicyId,
} from "../core/institution";
import { PopulationScene, type TournamentResult } from "../ui/populationScene";
import { registerSlide } from "./Slide";
import { $, clearTimers, revealSteps } from "./helpers";

const COUNT = 16;
const INITIAL_HAWKS = 9;
const MANUAL_MS_PER_AGENT = 100;
const AUTO_MS_PER_AGENT = 55;
const AUTO_SETTLE_MS = 550;
const BETWEEN_GENERATIONS_MS = 700;

let scene: PopulationScene | null = null;
let timers: number[] = [];
let stopped = false;
let currentHawks = INITIAL_HAWKS;
let currentPolicy: InstitutionPolicy = getInstitutionPolicy("none");
let generation = 0;
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
  const stable =
    finiteGenerationStep(currentHawks, COUNT, params(currentPolicy)) === currentHawks;
  $("#order-generation").textContent = "第 " + generation + " 代";
  $("#order-ratio").textContent = currentHawks + " 鹰 / " + (COUNT - currentHawks) + " 鸽";
  $("#order-gross").textContent = fmt(ledger.gross);
  $("#order-cost").textContent = fmt(ledger.organization);
  $("#order-conflict").textContent = fmt(ledger.conflictLoss);
  $("#order-net").textContent = fmt(ledger.net);
  $("#order-net-label").textContent = stable ? "稳定净收益" : "当前短期净收益";
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
  scene?.setup(COUNT, INITIAL_HAWKS, true, 20260921);
  updateStage(note);
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

function openBaseline(): void {
  markStep("baseline");
  updateStage("基准世界已经稳定在 9 鹰 / 7 鸽；先把 400 点资源逐项对账。");
  showPhase("#order-baseline");
}

function prepareSmall(): void {
  resetWorld(
    "light",
    "只换上少量投入参数；群体还没有演化，所以仍是 9 鹰 / 7 鸽。",
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
      return "你刚才猜「省下的更多」——猜对了：省下的冲突损耗（120）远多于组织花掉的 40。";
    case "tie":
      return "你刚才猜「刚好抵消」——实际上省下的（120）比花掉的（40）多不少。";
    case "lose":
      return "你刚才猜「组织花得更多」——这一次相反：40 换回了 120。但这不是永远成立，往下看。";
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
  const button = $("#btn-order-small-generation") as HTMLButtonElement;
  button.disabled = true;
  $("#order-small-copy").textContent =
    "正在完成本代循环赛：每个人依次与其余15人结算。";

  scene.playTournament(params(currentPolicy), MANUAL_MS_PER_AGENT, (result) => {
    if (stopped) return;
    generation++;
    currentHawks = scene!.hawkCount();
    const change = replacementText(result);
    const ledger = expectedLedger(currentPolicy, { hawkCount: currentHawks });
    updateStage(
      change + " 当前人数下的短期账面净收益是 " + fmt(ledger.net) + "。",
    );

    if (result.changedIdx === null) {
      $("#order-small-copy").textContent =
        change + " 全体分数保留在人物头顶，少量投入世界确认稳定。";
      timers.push(window.setTimeout(() => {
        $("#order-small-echo").textContent = smallEcho();
        showPhase("#order-small-result");
      }, BETWEEN_GENERATIONS_MS));
      return;
    }

    const following = finiteGenerationStep(currentHawks, COUNT, params(currentPolicy));
    button.textContent = following === currentHawks ? "再验证一代 →" : "再演化一代 →";
    button.disabled = false;
    $("#order-small-copy").textContent =
      change + " 当前人数下的短期净收益是 " + fmt(ledger.net) + "。";
  }, 900);
}

function prepareMedium(): void {
  resetWorld(
    "medium",
    "回到相同的 9 鹰 / 7 鸽起点；只把秩序投入改成每份 10 点。",
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
    if (stopped || !scene || scene.isBusy()) return;
    $("#order-auto-copy").textContent =
      "第 " + (generation + 1) + " 代正在完成全部配对……";
    scene.playTournament(params(currentPolicy), AUTO_MS_PER_AGENT, (result) => {
      if (stopped) return;
      generation++;
      currentHawks = scene!.hawkCount();
      const change = replacementText(result);
      const ledger = expectedLedger(currentPolicy, { hawkCount: currentHawks });
      $("#order-auto-copy").textContent =
        "第 " + generation + " 代："
        + currentHawks + " 鹰 / " + (COUNT - currentHawks)
        + " 鸽。" + change + " 当前短期净收益 " + fmt(ledger.net) + "。";
      updateStage(
        change + " 数字是当前人数下的短期账面；稳定后再打开最终账本。",
      );

      if (result.changedIdx === null) {
        timers.push(window.setTimeout(() => showPhase(resultPhase), BETWEEN_GENERATIONS_MS));
        return;
      }
      timers.push(window.setTimeout(step, BETWEEN_GENERATIONS_MS));
    }, AUTO_SETTLE_MS);
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
      ? "没错——减少冲突最多的那一档，并不是留下最多的一档。中等投入的 256 才是最高。"
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
    "策略分数来自16人完整循环赛；资源账本按这16人中无放回抽取双方的概率计算。",
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
