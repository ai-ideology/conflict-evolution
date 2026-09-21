/**
 * 底部关卡导航（参考 ncase《信任的进化》页面底部的圆点导航）：
 * 一排圆点，当前关实心高亮，hover 显示关卡名，点击跳转。
 */

import { subscribe, publish } from "../core/pubsub";

export interface LevelInfo {
  id: string;
  name: string;
}

let currentIndex = 0;
let levels: LevelInfo[] = [];
/** 触屏上首次点按只展开气泡的圆点下标；-1 表示没有展开的 */
let tipOpenIndex = -1;

function isCoarsePointer(): boolean {
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function initLevelNav(order: LevelInfo[]): void {
  levels = order;

  const nav = document.createElement("nav");
  nav.id = "level-nav";
  nav.setAttribute("aria-label", "关卡选择");

  order.forEach((lv, i) => {
    const item = document.createElement("button");
    item.className = "level-dot";
    item.setAttribute("aria-label", lv.name);
    item.dataset.index = `${i}`;

    const tip = document.createElement("span");
    tip.className = "level-tip";
    tip.textContent = `${i + 1}. ${lv.name}`;
    item.appendChild(tip);

    item.addEventListener("click", () => {
      // 触屏：第一次点只显示关卡名，第二次点才跳转（鼠标有 hover，不受影响）
      if (isCoarsePointer() && i !== currentIndex && tipOpenIndex !== i) {
        tipOpenIndex = i;
        refresh();
        return;
      }
      tipOpenIndex = -1;
      publish("slideshow/goto", i);
    });

    nav.appendChild(item);
  });

  // 点页面其他位置时收起气泡
  document.addEventListener("click", (e) => {
    if (tipOpenIndex < 0) return;
    if (!(e.target as HTMLElement).closest(".level-dot")) {
      tipOpenIndex = -1;
      refresh();
    }
  });

  document.body.appendChild(nav);

  subscribe("slideshow/changed", (data) => {
    const d = data as { index: number };
    currentIndex = d.index;
    tipOpenIndex = -1;
    refresh();
  });

  refresh();
}

function refresh(): void {
  const nav = document.getElementById("level-nav");
  if (!nav) return;
  const dots = nav.querySelectorAll<HTMLElement>(".level-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("current", i === currentIndex);
    dot.classList.toggle("passed", i < currentIndex);
    dot.classList.toggle("tip-open", i === tipOpenIndex);
  });
  void levels;
}
