/**
 * 冲突的进化 · 入口
 * 架构学习 ncase/trust：slide 制 + 发布订阅，引擎与 UI 解耦。
 */

import { subscribe } from "./core/pubsub";
import { Slideshow } from "./slides/Slideshow";
import { initLevelNav } from "./ui/levelNav";

// 注册所有 slide（顺序即游戏流程）
import "./slides/slide0";
import "./slides/slide1";
import "./slides/slide2";
import "./slides/slide3";
import "./slides/slide4";
import "./slides/slide5";
import "./slides/slide6";
import "./slides/slide7";

const SLIDE_ORDER = [
  "slide-title",
  "slide-intro",
  "slide-duel",
  "slide-population",
  "slide-extremes",
  "slide-env-teaser",
  "slide-ecology",
  "slide-learning",
];

const LEVEL_NAMES = [
  "标题",
  "规则说明",
  "第一关 · 你会争还是让",
  "第二关 · 如果大家都这么做",
  "第三关 · 一个突变行为",
  "第四关 · 改变打架损失",
  "第五关 · 当食物不够",
  "第六关 · 当个体开始学习",
];

const show = new Slideshow();
show.registerOrder(SLIDE_ORDER);

// slide 控制器通过事件请求翻页，保持解耦
subscribe("slideshow/next", () => show.next());
subscribe("slideshow/goto", (i) => show.goto(i as number));

// 底部关卡导航
initLevelNav(SLIDE_ORDER.map((id, i) => ({ id, name: LEVEL_NAMES[i] ?? id })));

show.start();
