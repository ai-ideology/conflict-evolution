# 冲突的进化 · The Evolution of Conflict

一个以**鹰鸽博弈**（Hawk–Dove Game）为背景的互动网页游戏，灵感与形式致敬 [《信任的进化》](https://dccxi.com/trust/)（[ncase/trust](https://github.com/ncase/trust)）。

> 好的规则，不一定创造更多资源。它可以让更少的资源浪费在冲突里。

## 快速开始

```bash
bun install
bun run dev     # → http://localhost:3000（--hot 热更新）
```

其他命令：

```bash
bun run check   # TypeScript 类型检查
bun test        # 引擎单元测试
bun run build   # 打包到 public/build/
bun start       # 不带热更新地启动
```

## 技术方案

- **工具链**：Bun + TypeScript，零运行时依赖。`serve.ts` 用 `Bun.serve` 提供静态文件并实时 `Bun.build` 打包。
- **架构**（学习 ncase/trust）：
  - **Slide 制**：每关/每屏是 `index.html` 中的一段 `<section class="slide">`，配一个 `src/slides/*.ts` 控制器（`init / onEnter / onLeave` 生命周期），由 `Slideshow` 统一调度，进度同步到 URL hash。
  - **发布订阅**（`core/pubsub.ts`）：slide 与播放器之间通过事件通信，互相不引用。
  - **引擎与 UI 解耦**（`core/hawkDove.ts`）：支付矩阵、期望收益、ESS、复制者动态都是纯函数，有单元测试覆盖。
- **手绘风设计系统**（`src/styles/sketch.css`）：参考 PaperCSS 的技法——不规则 `border-radius` 模拟手绘边框、方格纸背景、涂鸦阴影；中文手写字体（马善政毛笔体 + 小赖字体，Google Fonts CDN）。
- **Canvas 涂鸦角色**：小人形象致敬 ncase《信任的进化》——圆头、豆豆眼、短线四肢，**红帽=鹰（强硬）/ 蓝帽=鸽（温和）**（`ui/sketchPeeps.ts`），五种表情（平静/生气/开心/难过/晕倒），鹰鹰对决时用经典的「吵架云」表现。线条用「多段折线 + 相位抖动」模拟手抖（`ui/sketchAnimals.ts` 提供食物与地面）。

## 目录结构

```
├── public/index.html        # 所有 slide 的 DOM（文案都在这里）
├── src/
│   ├── core/hawkDove.ts     # 鹰鸽博弈引擎（支付矩阵 / ESS / 复制者动态）
│   ├── core/pubsub.ts       # 迷你发布订阅
│   ├── slides/              # Slide 框架 + 每一屏的控制器
│   ├── ui/sketchPeeps.ts    # ncase 风小人（红帽鹰 / 蓝帽鸽 + 表情）
│   ├── ui/sketchAnimals.ts  # 手绘基础线条、食物、地面
│   ├── ui/duelScene.ts      # 第 1 关对决舞台与补间动画
│   ├── ui/evoChart.ts       # 演化曲线图
│   └── styles/sketch.css    # 手绘设计系统
├── serve.ts                 # Bun 开发/静态服务器
└── 冲突的进化-设计思路.md     # 完整设计文档（8 关规划）
```

## 路线图

- [x] 阶段一：脚手架 + 设计系统 + Slide 引擎 + **第一关**（单次对决，可玩）
- [x] 阶段二：第二、三关（群体演化模拟、纯鹰/纯鸽世界的入侵）
- [ ] 阶段三：第四~七关（第四关环境参数已完成；待完成资源稀缺、个体学习、规则设计）
- [ ] 阶段四：第八关沙盒实验室 + 音效 + 打磨
