# 《冲突的进化》代码与体验评审

> 评审人：DeepSeek（ZCode 会话内完成）
> 评审日期：2026-09-21
> 仓库：https://github.com/ai-ideology/conflict-evolution
> 线上站点：https://ai-ideology.github.io/conflict-evolution/
> 评审基线：已提交 `HEAD = d2e19e1`（"feat: complete progressive levels through individual learning"），线上站点部署于该提交；工作区另有**未提交**的第七关改动（见 §3.1）
> 评审性质：**只读**。未修改任何项目文件（本文档除外）

## 给评审人的说明

这份文档的目的是把结论和证据一并交出，方便你独立复核甚至反驳。因此我把每条结论都标注了它的**证据强度**：

- **[实测]** —— 在线上站点用浏览器实际操作/测量的数字，附原始数据（§5）
- **[代码]** —— 从源码直接读出的确定事实，附 `文件:行号`
- **[推断]** —— 基于前两者的推理，可能有误，欢迎质疑

另外请注意一条重要的**覆盖边界**：线上站点只有 8 屏（工作区第九屏未部署）。因此第七关的全部结论来自 **[代码]** 而非 **[实测]**。我只交互测试了第一、二、五关；第三、四、六关仅做了代码阅读，没有实际点完流程。没有读完 `STORYBOARD.md`（813 行）、`duelScene.ts`、`sketchPeeps.ts`、`sketchAnimals.ts`、`evoChart.ts` 的全部实现。

---

## 1. 项目是什么

一个用**鹰鸽博弈（Hawk–Dove Game）**讲"冲突如何演化"的互动教学网页，形式上致敬 ncase 的《信任的进化》。共 9 屏：标题 + 规则说明 + 七个关卡，逐层引入单次对决 → 群体演化 → 极端世界 → 环境参数 → 资源稀缺与繁衍 → 个体学习 → 制度设计。

技术形态：Bun + TypeScript，**零运行时依赖**，约 7200 行（含 CSS 与 HTML）。分层清晰：

| 层 | 位置 | 职责 |
|---|---|---|
| 引擎 | `src/core/` | 纯函数模拟：支付矩阵、复制者动态、生态日循环、学习模型、制度账本、可复现随机源 |
| 关卡控制器 | `src/slides/` | 每屏一个 `Slide`（`init/onEnter/onLeave` 生命周期），只负责阶段编排与 DOM 更新 |
| 舞台 | `src/ui/` | Canvas 手绘风渲染（小人、食物、曲线、聚光动画） |
| 静态内容 | `public/index.html` | 全部 DOM 与中文文案 |

### 质量现状 [实测]

| 检查项 | 结果 |
|---|---|
| `bun run check`（tsc strict + `noUncheckedIndexedAccess`） | **0 错误** |
| `bun test` | **35 pass / 0 fail**，257 个断言，5 个测试文件 |
| GitHub Actions 最近一次部署（run `35561829204`） | **success** |

---

## 2. 值得保留的地方

这一节不是客套。以下几条是这个项目真正的资产，建议任何重构都不要破坏它们。

### 2.1 引擎与 UI 是真解耦，不是口号 [代码]

`src/core/random.ts` 把随机性抽成可注入的 `RandomSource`，注释写明"模拟随机与眨眼、抖动等视觉随机必须分开"，代码也**确实**分开了。带来的直接好处是教学演示可重放：同一个种子，同一群人的同一段命运。

`runEcologyDay`（`src/core/ecology.ts:104`）先算完整的一天，再把事件清单交给 UI 分阶段播放，注释写着"动画先后不会反过来改变逻辑结果"——这条设计约束是真正成立的，不是一厢情愿。

### 2.2 测试测的是"教学承诺"，不是函数返回值 [代码]

`src/core/hawkDove.test.ts:76` 用 3 档代价 × 17 个初始状态穷举了"任意一代最多改变一个席位"；`src/core/ecology.test.ts:66` 验证储备账本守恒（`期初 + 收入 − 冲突损失 − 消耗 − 繁衍 = 期末`）；`src/core/learning.test.ts` 里甚至有"0 收益是有效记忆，不能被当成'没学到东西'"这种语义级断言。

这类测试能在改参数时真正报警，比追求覆盖率的测试有价值得多。

### 2.3 第七关的资源恒等式在数学上成立 [代码]

我用四档参数各自验算过：`gross` 恒为 `8 × 50 = 400`，而每档的 `value + organizationCost` 都恰好等于 50（`src/core/institution.ts:24-29`）。所以"总资源固定，只是拿出一部分维持秩序"这个教学前提是**真的**，不是文案上的自我感觉。

净收益依次为 无 200 / 轻 270 / **中 280** / 重 225——中度最优、重度回落，与 `institution.test.ts` 的断言一致。教学结论因此站得住：不是"管得越多越好"。

### 2.4 叙事有边界感 [代码]

文案和注释主动声明自己的局限，例如 `src/slides/slide7.ts:337-343`：

> "这说明负面经历可以让行动倾向改变；它不是任何环境下都必然合作的保证。"

以及 `slide7.ts:341` 的"在这条相同起点、相同种子的 N 天轨迹里"。在教学类作品里，这种不把单次演示包装成普适规律的克制很少见，建议保持。

---

## 3. 代码层面的问题

### 3.1 第七关还没进版本库，导致线上站点比本地少一屏 [实测]

工作区状态：

```
 M STORYBOARD.md, public/index.html, public/sketch.css,
   src/main.ts, src/slides/slide7.ts, src/styles/sketch.css
?? .zcodeignore, src/core/institution.ts, src/core/institution.test.ts,
   src/slides/slide8.ts
```

我逐项确认过：已提交的 `public/index.html` 只有 8 个 `#slide-*`，工作区有 9 个（多出 `#slide-order`）。也就是说**本地能玩的第七关，GitHub Pages 上还不存在**。

---

### 3.2 `serve.ts` 存在目录穿越读取【P0 · 安全】 [实测]

`serve.ts:31` 对 URL 路径做 `decodeURIComponent` 后，**未做任何规范化**就拼进文件路径（`serve.ts:44`）：

```ts
let pathname = decodeURIComponent(url.pathname);   // :31
...
const file = Bun.file(`./public${pathname}`);      // :44
```

复现（我用一个只读探针验证过，返回 `true`）：

```ts
decodeURIComponent("/%2e%2e%2fpackage.json")  // → "/../package.json"
Bun.file("./public/../package.json").exists() // → true
```

**影响范围**：仅 `bun run dev` / `bun start`（本地开发服务器），线上静态站不受影响。但 `Bun.serve` 默认绑定所有网卡，同一局域网内的人可以读走项目目录下的任意文件（`.env`、密钥等）。

**最小修法**：拼接后用 `path.resolve` 规范化，再校验结果仍以 `public` 的绝对路径为前缀；不满足则返回 404。

---

### 3.3 CI 只构建，不验证【P1】 [代码]

`.github/workflows/deploy-pages.yml` 的步骤是：`bun install` → `bun run build` → 检查产物文件存在 → 部署。**从不执行 `bun test` 或 `bun run check`**。

后果：那 35 个高质量测试目前**完全没有守门作用**——测试红了、类型错了，照样能部署上线。

**最小修法**：在 build 之前加两步 `bun run check` 与 `bun test`。

---

### 3.4 第七关"再演化一代"存在快速双击竞态【P2】 [代码 + 推断]

- `evolveOne()`（`src/ui/populationScene.ts:233-238`）只设置 `changeAnim = 1`，真正的 `kind` 翻转要等动画过半才发生（`populationScene.ts:399-401`：`if (a.changeAnim <= 0.5 && a.kind !== a.changeTo) a.kind = a.changeTo;`）。
- `isBusy()` 只在 `playTournament` 里置位，`evolveOne` / `spotlight` **不影响** `busy`。

因此动画过半（约 240ms）内点第二次：`scene.kinds().findIndex(...)` 会再次命中**同一个**座位（它还没翻色），但控制器 `slide8.ts:116` 的 `currentHawks = next` 已经加了 2。

**[推断结论]**：画布显示 9 只鹰、HUD 写着 10 鹰 8——画面与数字不一致。自动演化路径因为 680ms 定时器隐藏了按钮，不受影响；只有"少量投入"那一步的手动按钮暴露此问题。我未在浏览器中复现（第七关未部署），这是纯代码推断，**建议实测确认**。

---

### 3.5 夜间消耗硬编码，与引擎参数各写一遍【P2】 [代码]

`src/ui/ecologyScene.ts:131` 里写死 `seat.reserve - 25`，而引擎用的是 `params.nightlyCost`（默认也是 25，`ecology.ts:70`）。改参数时动画会和逻辑静默不一致，且不会有任何测试报警（测试只覆盖引擎侧）。

**修法**：把 `nightlyCost` 作为参数传进 `playNight`。

---

### 3.6 动画方法在忙时静默丢弃回调【P2】 [代码]

`playForaging` / `playNight` / `playElimination` / `playBirth` 遇到 `busy` 时直接 `return`，**不调用 `onDone`**（如 `ecologyScene.ts:95`）。调用方的链式回调会永久挂起。

目前所有调用点都先查了 `isBusy`，所以不会触发。但这是"靠调用方自觉"的脆弱契约，属于以后加功能容易踩的坑。建议要么抛异常，要么保证回调必达。

---

### 3.7 引入学习后 `seat.strategy` 变成残留字段【P2 · 语义】 [代码]

学习模式下实际出招由 `tendency` 决定，`seat.strategy` 永远停在最初的帽子值；但**新生者的初始倾向又正是从它推导的**（`src/core/learning.ts:139`：`tendency: child.strategy === "hawk" ? 4 : 0`）。

于是"一个已经学会天天强硬的个体，后代拿到的是**祖先的帽子**而不是亲代当前行为"。`learning.test.ts` 已把这条固化为预期（"新生者不继承亲代的后天记忆与学习倾向"），所以是**有意为之**。

但它和第六关"帽子摘下来了、颜色不再是永久身份"的叙事存在张力：如果帽子不再是身份，为什么它仍通过遗传决定后代的起点？**建议项目作者明确一次是否符合教学意图**，若符合，值得在文案里点破这个设计。

---

### 3.8 其他工程收尾项 [代码]

| 项 | 说明 |
|---|---|
| CSS 两份都在版本控制 | `src/styles/sketch.css` 是源，`public/sketch.css` 是 `sync:css` 拷出的副本，内容一致。风险是改错文件不报错、只用旧样式 |
| 无 lint / format 配置 | 全项目没有 ESLint / Prettier / Biome |
| 59 个 `<button>` 全无 `type` 属性 | 已验证页面内 `<form>` 数量为 0，故当前**无害**，属于预防性建议 |
| 5 个 canvas 无可访问名称 | `#duel-canvas`、`#pop-canvas`、`#pop-chart`、`#extreme-canvas`、`#env-canvas` 没有 `aria-label`；而 `#learning-canvas`、`#order-canvas` 有（前后不一致） |
| 三处清单靠手工对齐 | `main.ts` 的 `SLIDE_ORDER`、`index.html` 的 `<section>`、各 `slideN.ts` 的注册。数量对不上时 `registerOrder` 会静默跳过、`goto` 只打一行 `console.error` |
| 本地开发 bundle 未压缩 | `serve.ts` 每次请求 `/build/main.js` 都重新打包，当前 416KB 未压缩（生产 `bun run build` 是正常的 34KB minified）。只影响本地开发 |
| 浏览器后退键会离开页面 | 用 `history.replaceState`（`Slideshow.ts:53`）原地替换 hash。这是避免污染历史的合理取舍，但**页面内没有"上一关"按钮**，用户点过头只能靠底部圆点 |

---

## 4. 用户体验建议（附实测数据）

以下 P1/P2 的量化结论全部来自**线上站点**的浏览器实测；第七关相关条目例外（未部署，标 [代码]）。

### 4.1【P1】底部固定导航会遮住内容 [实测]

`#level-nav` 是 `position: fixed; bottom: 0`（`src/styles/sketch.css:919-930`），高度 46px，但 `.slide` 的 `padding-bottom`（桌面 12vh、移动 10vh，`sketch.css:65` / `:1011`）**没有为它预留空间**。

第二关实测（`#3`）：

| 视口 | 被固定导航遮挡的高度 |
|---|---|
| 1280×800 | 比例条 **14px**、HUD 区块 **46px** |
| 390×844 | 提示文字被盖住（截图可见） |

这是"最后一屏内容永远看不全"的问题，且随视口高度变化，不是偶发。

**修法**：让导航占位而非悬浮——给 `body` 加 `padding-bottom: 64px`，并把 `.slide` 的 `min-height: 100vh` 改为 `calc(100vh - 64px)`。

### 4.2【P1】触屏用户看不到关卡名 [实测 + 代码]

关卡名气泡是 `.level-tip { opacity: 0 }` 配 `.level-dot:hover .level-tip { opacity: 1 }`（`sketch.css:969` / `:984`）——**只有鼠标悬停能触发**，没有 `:focus`、没有 `touch` 处理。

手机上就是 8 个没有任何标签的圆点：用户不知道自己在哪、点下去会去哪。注意 `levelNav.ts:26` 设置了 `aria-label`，所以**屏幕阅读器是能读到的**，问题只出在视觉/触屏通道。

**修法**：首次点击显示气泡、再次点击跳转；或让当前关名常驻显示在圆点旁。

### 4.3【P1】圆点点击区域偏小 [实测]

`.level-dot` 是 **20×20px**（`sketch.css:932-943`），触屏推荐最小 44×44px。移动端 8 个圆点加 12px 间距共宽 250px（视口 375px），点错会直接跳到别的关卡并重置当前进度。

**修法**：视觉尺寸不变，用透明 padding 或伪元素把热区扩到 44px。

### 4.4【P2】长动画没有进度感，也没有快进 [实测]

这是目前对学习体验影响最大的一条。

**第二关实测**："演化一代"单次耗时 **5335ms**（16 人逐个结算，每人 220ms + 300ms 收尾 + 1400ms 换帽子动画；对应 `slide3.ts:62`、`populationScene.ts:198-203`）。

从初始 2 只鹰走到均衡点 8 只鹰需要 **6 代**，再加"再验证一代"共 **7 次点击**（我用引擎复算确认）：

```
从 2 只鹰演化到均衡需要 6 代；再验证 1 代 = 7 次点击
按实测 5.3s/代 估算等待 ≈ 37.3 秒
```

期间按钮是禁用的，提示文字会变但没有进度条或"还剩几位"。用户不知道要等多久，手快的人会反复点禁用按钮。

**修法**：按钮旁显示"正在结算第 7/16 位"；并提供"快进"开关把 220ms 压到 ~60ms——已经看过一遍的用户不该被强制重看动画。

**对照组**：第五关的连续自动播放在实测中只有 **5.3 秒**到首次淘汰，且带日夜阶段指示，**不算慢**，不需要改：

| 阶段 | 耗时 |
|---|---|
| 充足日播放 | 2930 ms |
| 夜间结算 | 667 ms |
| 稀缺日播放 | 2270 ms |
| 稀缺夜结算 | 795 ms |
| 连续自动播放 → 首次淘汰 | 5324 ms（到第 4 天，淘汰 2 人） |

### 4.5【P2】预测按钮不记得用户猜了什么 [代码]

第七关"先预测，再运行"那一屏的两个按钮带着 `data-predict="up"` / `data-predict="down"`（`public/index.html:667-668`），但 `slide8.ts:199-201` 给两者绑的是**完全相同**的处理函数：

```ts
document.querySelectorAll<HTMLElement>(".order-predict")
  .forEach((button) => button.addEventListener("click", () =>
    runAutomatic("medium", "#order-medium-result")));
```

`data-predict` 从未被读取——用户的猜测得到**零回应**。

预测-揭示（predict-then-reveal）是教学里最有效的技巧之一，而这一屏的标题**已经承诺了**这件事。修法很小：记下选择，在 `order-medium-result` 面板里加一句"你猜会更好——实际净收益 280，比少量投入的 270 只高 10 点"。

### 4.6【P2】完全不支持键盘导航 [代码]

全项目 **0 处** `keydown` / `keyup` 监听。

现状是：按钮可用 Tab 聚焦、回车/空格触发（原生 `<button>` 行为）；`outline` 没有被覆盖，所以焦点环仍在。**缺的是**翻页快捷键——没有 `←` / `→` / 空格 → 下一屏。对这种一页页推进的讲解型页面，方向键翻页是很多人的默认预期。`Slideshow` 里加一个 ArrowRight/Space → `next()` 即可；本页没有输入框，误拦截风险低。

### 4.7【P2】忽略了系统的"减少动效"偏好 [代码]

CSS 里 **0 处** `prefers-reduced-motion`，而动画相当密集：每屏入场位移、涂鸦线条用相位抖动持续模拟手抖、小人随机眨眼、大量 `requestAnimationFrame` 循环。

对动效敏感的用户（前庭功能障碍）没有退路。建议在 `reduce` 下关掉入场动画与线条抖动，并让 canvas 循环降帧或渲染静态帧。

### 4.8【P3】中文字体整套依赖 Google Fonts CDN [实测 + 代码]

`public/index.html:8-12` 从 `fonts.googleapis.com` 加载马善政毛笔体与 XIAOLAI 字体。标题用的毛笔体是整个手绘风格的视觉基础，但国内网络下大概率拿不到，会回退到楷体，**视觉落差明显**；`display=swap` 还会带来一次字体切换闪烁。

自托管 woff2 子集化后体积不大，是性价比很高的一处改进。

### 4.9【P3】手机竖屏下小人挤在一起 [实测 + 计算]

第二关在 390×844 下实测画布宽 312px（`#pop-canvas` 内联高度固定 460px，**没有媒体查询调整它**）。

`populationScene.ts:341` 的默认环形半径公式 `r = min(w, h) / 2 - 84`，因为取 `min(w, h)`，宽度缩小后半径随之缩小：

| 视口 | 画布 | 半径 | 16 人每人弧长 |
|---|---|---|---|
| 1280×800（桌面） | 688×460 | 146px | **57.3px** |
| 390×844（移动） | 312×460 | 72px | **28.3px** |

小人本体约 30–40px 宽，所以移动端每人只有 28px 弧长 → **必然重叠**（截图可见明显挤压）。桌面端 57px 尚可接受。

**修法**：窄屏时按画布宽度同时缩小小人的绘制比例（`drawPeep` 的 scale 参数），或改用椭圆/网格排布（第五关的 `ecologyScene` 用的就是 `radiusX`/`radiusY` 椭圆，处理得更好）。

### 4.10【P3】进度不持久化 [代码]

只有 `location.hash`，没有 `localStorage`。整个流程 9 屏约 15–30 分钟，中途关掉标签就得从第一关重来。刷新能回当前关这点很好，但"跨会话续玩"值得做：记录已完成关卡，下次进入时问一句"继续上次进度？"。

### 4.11【P3】两个小项

- **淡入中的按钮已经可以点**：`.step` 初始 `opacity: 0` 但仍在文档流中且默认可点击，手快的人可能在按钮完全淡入前点到它（位置可预测，风险低）。加一行 `.slide .step:not(.shown) { pointer-events: none }` 即可。
- **没有"上一关"的内容内入口**：9 个关卡都只有"去下一关"。圆点能跳转所以不算阻断，但如果 4.2 的标签问题修了，这个痛点基本消失；否则建议在关卡标题旁加"← 上一关"。

---

## 5. 实测方法与原始数据

便于复核。所有浏览器测量通过 Node REPL 的 browser 工具在**线上站点**完成，视口用 `setViewportSize` 显式设定。

### 5.1 静态检查

```bash
bun run check                  # → 无输出（0 错误）
bun test                       # → 35 pass / 0 fail, 257 expect(), 5 files, 39.00ms
```

### 5.2 路径穿越探针（只读，未写入任何文件）

```ts
const target = `./public${decodeURIComponent("/%2e%2e%2fpackage.json")}`;
// → "./public/../package.json"
await Bun.file(target).exists();   // → true
```

### 5.3 第二关单代耗时

方法：导航到 `#3`，`await` 点击 `#btn-evolve`，以 250ms 为步长轮询 `#btn-evolve.disabled` 直到恢复可用。

```
点击前:  gen=0, hint="点「演化一代」，看看一代之后谁混得好。", label="演化一代 →"
一代耗时: 5335 ms
点击后:  gen=1, ratio="3 鹰 / 13 鸽", hint="低收益策略中的一个个体，换上了高收益策略的帽子。"
```

### 5.4 底部导航遮挡（第二关 `#3`，1280×800）

```json
{
  "viewportH": 800,
  "nav":      { "top": 754, "bottom": 800, "h": 46 },
  "popBar":   { "top": 757, "bottom": 771, "h": 14 },
  "popHud":   { "top": 721, "bottom": 807, "h": 86 },
  "barCoveredPx": 14,
  "hudCoveredPx": 46,
  "needScrollForButton": true,
  "docScrollHeight": 1191
}
```

### 5.5 移动端（第二关 `#3`，390×844）

```json
{
  "viewport":       { "w": 390, "h": 844 },
  "canvas":         { "top": 241, "bottom": 701, "w": 312 },
  "evolveBtn":      { "top": 859, "bottom": 902 },
  "nav":            { "top": 798, "bottom": 844, "w": 375 },
  "dotCount":       8,
  "dotSize":        { "w": 20, "h": 20 },
  "dotRowWidth":    250,
  "docScrollHeight": 1186
}
```

### 5.6 第五关各阶段耗时

方法：导航到 `#6`，依次点击并在 30s 预算内轮询目标面板的 `display !== "none"`。

```
打开开场: 11 ms
充足日播放: 2930 ms
夜间结算: 667 ms
切到6份食物: 7 ms
稀缺日播放: 2270 ms
稀缺夜结算: 795 ms
连续自动播放 → 首次淘汰: 5324 ms   （到达第 4 天，存活 14/16，淘汰 2 人）
```

### 5.7 环形的几何复算

```ts
calc = (w, h) => { const r = Math.min(w, h) / 2 - 84; return 2 * Math.PI * r / 16; }
calc(688, 460)  // → 57.3 px/人  （桌面）
calc(312, 460)  // → 28.3 px/人  （移动）
```

---

## 6. 我不确定、需要项目作者确认的地方

诚实列出，避免误导：

1. **3.4 的竞态**我只做了代码推断，未在浏览器复现（第七关未部署）。建议作者在本地快速双击验证。
2. **3.7 的语义问题**是有意设计（测试已固化），我不确定这是否符合教学意图，需要作者判断而非我下结论。
3. **4.4 的"37 秒"**是"6 代 + 1 次验证"的估算，假设验证代耗时与普通代相同；实际可能略有差异。
4. **4.7 的动效敏感影响**我无法量化，只能指出缺失了标准退路（`prefers-reduced-motion`）。
5. 我**没有**实际点完第三、四、六关的完整流程，这三关可能还有未被发现的体验问题。
6. **未评估**：性能（长会话下的内存增长）、真实低端手机上的 canvas 帧率、以及屏幕阅读器实际朗读效果（只做了属性层面的静态检查）。

---

## 7. 如果只做三件事

1. **修 `serve.ts` 的目录穿越**（§3.2）——唯一有安全性质的问题，修法明确。
2. **修底部导航遮挡 + 触屏关卡名/热区**（§4.1–4.3）——这是**每一位用户**都会遇到、且属于"内容永久看不全 / 导航实际不可用"的硬伤。
3. **让 CI 跑测试与类型检查**（§3.3）——两行配置，就能让已有的 35 个测试从"装饰"变成"守门"。

再加一件性价比极高的：**让第七关的预测按钮真的回应用户的猜测**（§4.5）。这一屏的教学价值几乎全靠这个互动，而它现在是空的，实现成本却很低。

---

*本评审未修改项目任何文件。若需要我针对上述任一条给出具体补丁，请指出编号。*
