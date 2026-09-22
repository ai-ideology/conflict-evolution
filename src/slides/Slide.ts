/**
 * Slide 生命周期接口（学习 ncase/trust 的 slide 架构）
 * 每一节 / 每一屏是一个 Slide，DOM 静态写在 index.html 中。
 */
export interface Slide {
  /** 对应 DOM 元素 id */
  readonly id: string;
  /** 只执行一次的初始化（绑定事件等） */
  init?(): void;
  /** 每次进入该 slide 时调用 */
  onEnter?(): void;
  /** 离开该 slide 时调用（清理动画帧等） */
  onLeave?(): void;
}

/** 所有 slide 的注册表 */
export const slideRegistry = new Map<string, Slide>();

export function registerSlide(slide: Slide): void {
  slideRegistry.set(slide.id, slide);
}
