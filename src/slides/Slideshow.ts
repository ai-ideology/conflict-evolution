import { slideRegistry, type Slide } from "./Slide";
import { publish } from "../core/pubsub";

/**
 * 幻灯片播放器：管理 slide 的切换、当前进度。
 * 进度通过 hash（#2）同步，刷新后可回到对应章节。
 */
export class Slideshow {
  private order: string[] = [];
  private currentIndex = -1;
  private current: Slide | null = null;

  registerOrder(ids: string[]): void {
    this.order = ids;
    // 一次性初始化所有已注册 slide
    for (const id of ids) slideRegistry.get(id)?.init?.();
  }

  start(): void {
    const fromHash = parseInt(location.hash.replace("#", ""), 10);
    const startIndex = Number.isFinite(fromHash)
      ? Math.min(Math.max(fromHash, 0), this.order.length - 1)
      : 0;
    this.goto(startIndex);
  }

  get index(): number {
    return this.currentIndex;
  }

  next(): void {
    this.goto(this.currentIndex + 1);
  }

  goto(index: number): void {
    if (index < 0 || index >= this.order.length) return;
    const id = this.order[index]!;
    const slide = slideRegistry.get(id);
    if (!slide) {
      console.error(`未注册的 slide: ${id}`);
      return;
    }

    // 离开旧 slide
    if (this.current) {
      this.current.onLeave?.();
      document.getElementById(this.current.id)?.classList.remove("active");
    }

    // 进入新 slide
    this.current = slide;
    this.currentIndex = index;
    history.replaceState(null, "", `#${index}`);

    const el = document.getElementById(id)!;
    el.classList.add("active");
    window.scrollTo({ top: 0 });

    slide.onEnter?.();
    publish("slideshow/changed", { index, id });
  }
}
