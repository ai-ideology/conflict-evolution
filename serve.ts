/**
 * 开发 / 生产通用静态服务器
 * - /            -> public/index.html
 * - /build/*     -> 由 bun 实时打包 src/main.ts（开发时免手动 build）
 * - 其余         -> public/ 下的静态资源
 */

const OUT_DIR = "./public/build";
const ENTRY = "./src/main.ts";

async function buildBundle(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [ENTRY],
    outdir: OUT_DIR,
    target: "browser",
    sourcemap: "inline",
    minify: false,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("打包失败");
  }
}

await buildBundle();

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/") pathname = "/index.html";

    // 重新打包（简单起见每次请求 bundle 时重建，保证 --hot 之外的改动也能生效）
    if (pathname === "/build/main.js") {
      try {
        await buildBundle();
      } catch {
        return new Response("打包失败，请查看终端", { status: 500 });
      }
    }

    const file = Bun.file(`./public${pathname}`);
    if (await file.exists()) return new Response(file);

    return new Response("404 Not Found", { status: 404 });
  },
});

console.log(`冲突的进化 → http://localhost:${server.port}`);
