import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";
import { publish } from "../core/pubsub";

let timers: number[] = [];

/** 第 1 屏：概念引入 —— 你先成为博弈的参与者 */
registerSlide({
  id: "slide-intro",
  init() {
    $("#btn-intro-next").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    const el = document.getElementById(this.id)!;
    timers = revealSteps(el, 550);
  },
  onLeave() {
    clearTimers(timers);
  },
});
