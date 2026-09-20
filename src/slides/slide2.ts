/**
 * 第 2 屏（第一关主体）：你会争，还是让？
 *
 * 流程：
 *  1. 玩家在「争 / 让」之间选择（对手性格从温和逐渐变强硬）
 *  2. Canvas 演绎对决动画，结算收益
 *  3. 玩满 4 回合 → 揭示支付矩阵 → 留下群体问题进入第二关
 */

import { registerSlide } from "./Slide";
import { $, floatScore, fmtScore } from "./helpers";
import { publish } from "../core/pubsub";
import {
  DEFAULT_PARAMS,
  payoffMatrix,
  playRound,
  type Move,
} from "../core/hawkDove";
import { DuelScene } from "../ui/duelScene";

interface RoundScript {
  rivalMove: Move;
  /** 结算后的旁白，{move} 会被替换 */
  remark: string;
}

/** 剧本：对手从温和到强硬，确保玩家体验到三种对局 */
const SCRIPT: RoundScript[] = [
  { rivalMove: "dove", remark: "对方退让了。" },
  { rivalMove: "dove", remark: "对方又退让了。" },
  { rivalMove: "hawk", remark: "对方似乎……越来越强硬了？" },
  { rivalMove: "hawk", remark: "这一次，对方丝毫没有退让的意思。" },
];

const TOTAL_ROUNDS = SCRIPT.length;

let scene: DuelScene | null = null;
let round = 0;
let playerTotal = 0;
let rivalTotal = 0;
let hawkPlays = 0;
let busy = false;
let firstHawkEncounter = false;

function rivalRemark(playerMove: Move, r: RoundScript): string {
  if (r.rivalMove === "hawk" && playerMove === "hawk") {
    return r.remark + " 你们都扑了上去——打起来了！";
  }
  if (r.rivalMove === "hawk" && playerMove === "dove") {
    return r.remark + " 它独吞了食物。";
  }
  if (r.rivalMove === "dove" && playerMove === "hawk") {
    return r.remark + " 你独占了食物。";
  }
  return r.remark + " 你们平分了食物。";
}

function setButtonsEnabled(enabled: boolean): void {
  ($("#btn-fight") as HTMLButtonElement).disabled = !enabled;
  ($("#btn-yield") as HTMLButtonElement).disabled = !enabled;
}

function updateScoreboard(): void {
  $("#score-you").textContent = `${playerTotal}`;
  $("#score-rival").textContent = `${rivalTotal}`;
  $("#round-indicator").textContent = `第 ${Math.min(round + 1, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS} 回合`;
}

function choose(move: Move): void {
  if (busy || round >= TOTAL_ROUNDS || !scene) return;
  busy = true;
  setButtonsEnabled(false);
  $("#round-remark").textContent = "……";

  const script = SCRIPT[round]!;
  if (script.rivalMove === "hawk" && !firstHawkEncounter) firstHawkEncounter = true;
  if (move === "hawk") hawkPlays++;

  scene.play(move, script.rivalMove, () => {
    const [mine, theirs] = playRound(move, script.rivalMove, DEFAULT_PARAMS);
    playerTotal += mine;
    rivalTotal += theirs;

    const wrap = $(".stage-wrap");
    floatScore(wrap, fmtScore(mine), 16, mine >= 0 ? "#3b7dbd" : "#c0392b");
    floatScore(wrap, fmtScore(theirs), 72, theirs >= 0 ? "#3b7dbd" : "#c0392b");

    $("#round-remark").textContent = rivalRemark(move, script);
    round++;
    updateScoreboard();
    $("#round-indicator").textContent = `第 ${round} / ${TOTAL_ROUNDS} 回合结束`;

    busy = false;
    const next = $("#btn-duel-next") as HTMLButtonElement;
    next.textContent = round >= TOTAL_ROUNDS
      ? "整理刚才的四次相遇 →"
      : "下一位对手 →";
    next.style.display = "inline-block";
  });
}

function continueAfterRound(): void {
  if (busy || round === 0) return;
  $("#btn-duel-next").style.display = "none";
  if (round >= TOTAL_ROUNDS) {
    showAnalysis();
    return;
  }
  scene?.showIdle();
  updateScoreboard();
  setButtonsEnabled(true);
  $("#round-remark").textContent = "下一位对手来了。中间仍然只有一份食物。";
}

function showAnalysis(): void {
  const p = DEFAULT_PARAMS;
  const m = payoffMatrix(p);

  // 支付矩阵
  $("#m-hh").textContent = `${m.hh}`;
  $("#m-hd").textContent = `${m.hd}`;
  $("#m-dh").textContent = `${m.dh}`;
  $("#m-dd").textContent = `${m.dd}`;

  // 总结语：根据玩家行为给一点反馈（不做道德评判）
  const summary =
    hawkPlays >= 3
      ? "强硬确实让你拿到了更多食物——尤其是对方退让的时候。这并不愚蠢。"
      : hawkPlays === 0
        ? "你一次都没有争。当对方也温和时这样不错，但对方强硬时，你什么都没得到。"
        : "你在争与让之间摇摆。大多数时候，这都还算划算——直到两只鹰迎头相撞。";

  $("#duel-summary").textContent =
    `${summary} ${TOTAL_ROUNDS} 回合下来：你 ${playerTotal} 分，对方 ${rivalTotal} 分。`;

  $("#duel-arena").style.display = "none";
  $("#duel-analysis").style.display = "block";
  $("#duel-matrix-analysis").style.display = "none";
  $("#btn-show-payoff-matrix").style.display = "inline-block";
}

function showPayoffMatrix(): void {
  $("#btn-show-payoff-matrix").style.display = "none";
  const analysis = $("#duel-matrix-analysis");
  analysis.style.display = "block";
  analysis.classList.add("env-panel-enter");
}

registerSlide({
  id: "slide-duel",
  init() {
    const canvas = $("#duel-canvas") as HTMLCanvasElement;
    scene = new DuelScene(canvas);
    $("#btn-fight").addEventListener("click", () => choose("hawk"));
    $("#btn-yield").addEventListener("click", () => choose("dove"));
    $("#btn-duel-next").addEventListener("click", continueAfterRound);
    $("#btn-show-payoff-matrix").addEventListener("click", showPayoffMatrix);
    $("#btn-to-next-level").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    round = 0;
    playerTotal = 0;
    rivalTotal = 0;
    hawkPlays = 0;
    busy = false;
    firstHawkEncounter = false;
    $("#duel-arena").style.display = "block";
    $("#duel-analysis").style.display = "none";
    $("#duel-matrix-analysis").style.display = "none";
    $("#round-remark").textContent = "中间有一丛浆果。它想吃，你也想吃。";
    $("#btn-duel-next").style.display = "none";
    updateScoreboard();
    setButtonsEnabled(true);
    scene?.showIdle();
  },
  onLeave() {
    scene?.destroy();
  },
});
