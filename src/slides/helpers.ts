/**
 * Slide 编写辅助函数
 */

export function $(selector: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`找不到元素: ${selector}`);
  return el;
}

/** 依次展示 slide 内带 .step 类的元素（ncase 式的"一步步揭示"） */
export function revealSteps(
  root: HTMLElement,
  intervalMs = 450,
  reset = true,
): number[] {
  const steps = Array.from(root.querySelectorAll<HTMLElement>(".step"));
  const timers: number[] = [];
  steps.forEach((step, i) => {
    if (reset) step.classList.remove("shown");
    const t = window.setTimeout(() => step.classList.add("shown"), i * intervalMs);
    timers.push(t);
  });
  return timers;
}

export function clearTimers(timers: number[]): void {
  for (const t of timers) clearTimeout(t);
}

/** 在容器里生成一个飘上去的收益数字（如 +50 / -25） */
export function floatScore(
  container: HTMLElement,
  text: string,
  xPercent: number,
  color: string,
): void {
  const el = document.createElement("div");
  el.className = "score-float";
  el.textContent = text;
  el.style.left = `${xPercent}%`;
  el.style.top = "38%";
  el.style.color = color;
  container.appendChild(el);
  window.setTimeout(() => el.remove(), 1500);
}

/** 格式化带符号的分数 */
export function fmtScore(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
