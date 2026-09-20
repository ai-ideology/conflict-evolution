import { registerSlide } from "./Slide";
import { $, revealSteps, clearTimers } from "./helpers";
import { publish } from "../core/pubsub";

let timers: number[] = [];

/** 第 0 屏：标题页 */
registerSlide({
  id: "slide-title",
  init() {
    $("#btn-start").addEventListener("click", () => publish("slideshow/next"));
  },
  onEnter() {
    const el = document.getElementById(this.id)!;
    timers = revealSteps(el, 500);
  },
  onLeave() {
    clearTimers(timers);
  },
});
