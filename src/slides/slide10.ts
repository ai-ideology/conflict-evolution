/** 最终回望：把前面的结论重新变成一次可操作的互动演出。 */
import { publish } from "../core/pubsub";
import { FinaleScene, type FinaleBeat, type FinaleLayer } from "../ui/finaleScene";
import { getSandboxSnapshot } from "./slide9";
import { registerSlide } from "./Slide";
import { $, clearTimers, revealSteps } from "./helpers";

const REWIND = [
  ["最初，只有两个人和一份食物。", "一次选择看起来只是两个人之间的事。"],
  ["当镜头拉远，选择进入了群体。", "谁得到更多，会改变下一代遇见谁。"],
  ["资源开始被消耗，也会留下来。", "过去的收益累积成生存差异，短缺让代价更明显。"],
  ["个体开始记住经历。", "帽子不再是固定身份，下一次行为会被上一次改变。"],
  ["群体拿出一部分资源建立秩序。", "规则本身有成本，但它能改变争抢行为面对的代价。"],
  ["最后，你亲手改变了参数。", "没有一个比例是凭空出现的：轨迹来自条件、反馈与群体。"],
] as const;

const LAYER_FEEDBACK: Record<FinaleLayer, string> = {
  payoff: "冲突越昂贵，强硬越难占多数；但冲突不会凭空消失。",
  resources: "资源改变机会和生存历史，也会放大冲突造成的损失。",
  learning: "经历会改变下一次行为，但学习不保证总会走向合作。",
  rules: "规则能改变激励并减少更大损失，但规则自身也有成本。",
};

let scene: FinaleScene | null = null;
let timers: number[] = [];
let rippleDone = false;
let hatRemoved = false;

function showPhase(id: string, beat: FinaleBeat): void {
  document.querySelectorAll<HTMLElement>("#slide-finale .finale-phase")
    .forEach((panel) => (panel.style.display = "none"));
  const panel = $(id);
  panel.style.display = "block";
  panel.classList.remove("env-panel-enter");
  void panel.offsetWidth;
  panel.classList.add("env-panel-enter");
  scene?.setBeat(beat);
}

function setRewind(index: number): void {
  const safeIndex = Math.max(0, Math.min(REWIND.length - 1, index));
  const item = REWIND[safeIndex]!;
  $("#finale-rewind-title").textContent = item[0];
  $("#finale-rewind-copy").textContent = item[1];
  $("#finale-stage-note").textContent = item[1];
  scene?.setRewind(safeIndex);
  const button = $("#btn-finale-rewind-next") as HTMLButtonElement;
  button.textContent = safeIndex < REWIND.length - 1
    ? `继续回看：${["相遇", "群体", "资源", "学习", "秩序", "实验"][safeIndex + 1]} →`
    : "让一次选择扩散开来 →";
}

function chooseLayer(layer: FinaleLayer): void {
  document.querySelectorAll<HTMLButtonElement>("#finale-layers [data-layer]")
    .forEach((button) => button.classList.toggle("selected", button.dataset.layer === layer));
  $("#finale-layer-feedback").textContent = LAYER_FEEDBACK[layer];
  $("#finale-stage-note").textContent = LAYER_FEEDBACK[layer];
  scene?.setLayer(layer);
  ($("#btn-finale-layers-next") as HTMLButtonElement).disabled = false;
}

function describeExperiment(): void {
  const snapshot = getSandboxSnapshot();
  const start = snapshot.history[0] ?? snapshot.initialHawks;
  const end = snapshot.history.at(-1) ?? snapshot.currentHawks;
  let summary: string;
  if (snapshot.outcome === "cycle" && snapshot.history.length >= 2) {
    const previous = snapshot.history[snapshot.history.length - 2]!;
    summary = `在你设置的世界里，群体在 ${previous} 鹰和 ${end} 鹰之间来回变化。`;
  } else if (snapshot.generation === 0) {
    summary = `你设置了 ${start} 鹰 / ${16 - start} 鸽。实验还没开始，结论仍然留给下一次观察。`;
  } else {
    const ending = snapshot.outcome === "stable"
      ? "并停在这里"
      : snapshot.outcome === "limit"
        ? "，走到了观察上限"
        : "";
    summary = `在你设置的世界里，鹰从 ${start} 只走到 ${end} 只${ending}。`;
  }
  $("#finale-note-summary").textContent = summary;
  $("#finale-note-params").textContent =
    `食物价值 ${snapshot.value} · 冲突损失 ${snapshot.cost} · 已观察 ${snapshot.generation} 代`;
}

function resetFinale(): void {
  clearTimers(timers);
  timers = [];
  rippleDone = false;
  hatRemoved = false;
  const timeline = $("#finale-timeline") as HTMLInputElement;
  timeline.value = "0";
  ($("#btn-finale-ripple-next") as HTMLButtonElement).disabled = true;
  ($("#btn-finale-layers-next") as HTMLButtonElement).disabled = true;
  ($("#btn-finale-note-next") as HTMLButtonElement).disabled = true;
  ($("#btn-finale-flip") as HTMLButtonElement).disabled = false;
  $("#finale-experiment-note").classList.remove("flipped");
  $("#finale-ending").style.display = "none";
  document.querySelectorAll<HTMLButtonElement>("#finale-layers [data-layer]")
    .forEach((button) => button.classList.remove("selected"));
  $("#finale-layer-feedback").textContent = "每一层都会改变行为得到的反馈。";
  scene?.setup();
  showPhase("#finale-rewind", "rewind");
  setRewind(0);
}

registerSlide({
  id: "slide-finale",
  init() {
    const canvas = $("#finale-canvas") as HTMLCanvasElement;
    scene = new FinaleScene(canvas);

    $("#finale-timeline").addEventListener("input", (event) => {
      setRewind(Number((event.currentTarget as HTMLInputElement).value));
    });
    $("#btn-finale-rewind-next").addEventListener("click", () => {
      const timeline = $("#finale-timeline") as HTMLInputElement;
      const current = Number(timeline.value);
      if (current < REWIND.length - 1) {
        timeline.value = String(current + 1);
        setRewind(current + 1);
        return;
      }
      showPhase("#finale-ripple", "ripple");
      $("#finale-stage-note").textContent = "点击一个人，看看变化怎样穿过群体。";
    });
    canvas.addEventListener("click", (event) => {
      if ($("#finale-ripple").style.display !== "none" && !rippleDone) {
        rippleDone = true;
        scene?.triggerRipple();
        $("#finale-stage-note").textContent = "一次行为改变了邻近的相遇，涟漪又回到了群体。";
        ($("#btn-finale-ripple-next") as HTMLButtonElement).disabled = false;
        return;
      }
      if ($("#finale-hats").style.display !== "none" && !hatRemoved) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * canvas.width / Math.max(1, rect.width);
        const y = (event.clientY - rect.top) * canvas.height / Math.max(1, rect.height);
        scene?.removeNearestHat(x, y);
        hatRemoved = true;
        $("#finale-ending").style.display = "block";
        $("#finale-stage-note").textContent = "帽子摘下了，人还在。行为可以被环境重新塑造。";
      }
    });
    $("#btn-finale-ripple-next").addEventListener("click", () => showPhase("#finale-layers", "layers"));

    const token = $("#finale-token");
    token.addEventListener("dragstart", (event) => {
      (event as DragEvent).dataTransfer?.setData("text/plain", "change");
    });
    document.querySelectorAll<HTMLButtonElement>("#finale-layers [data-layer]")
      .forEach((button) => {
        button.addEventListener("click", () => chooseLayer(button.dataset.layer as FinaleLayer));
        button.addEventListener("dragover", (event) => event.preventDefault());
        button.addEventListener("drop", (event) => {
          event.preventDefault();
          chooseLayer(button.dataset.layer as FinaleLayer);
        });
      });
    $("#btn-finale-layers-next").addEventListener("click", () => {
      describeExperiment();
      showPhase("#finale-note", "note");
      $("#finale-stage-note").textContent = "这是你的实验留下的轨迹，不是所有世界的标准答案。";
    });
    $("#btn-finale-flip").addEventListener("click", () => {
      $("#finale-experiment-note").classList.add("flipped");
      ($("#btn-finale-flip") as HTMLButtonElement).disabled = true;
      ($("#btn-finale-note-next") as HTMLButtonElement).disabled = false;
    });
    $("#btn-finale-note-next").addEventListener("click", () => {
      showPhase("#finale-hats", "hats");
      $("#finale-stage-note").textContent = "最后，点击一个人，摘下把行为当成身份的帽子。";
    });
    $("#btn-finale-lab").addEventListener("click", () => publish("slideshow/goto", 9));
    $("#btn-finale-start").addEventListener("click", () => publish("slideshow/goto", 0));
  },
  onEnter() {
    resetFinale();
    timers.push(...revealSteps(document.getElementById(this.id)!, 260, true));
  },
  onLeave() {
    clearTimers(timers);
    timers = [];
    scene?.destroy();
  },
});
