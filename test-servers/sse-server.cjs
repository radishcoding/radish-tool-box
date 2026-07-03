// SSE 服务器: 每秒推送一条 tick 事件; "/404" 路径返回 404 (用于测非 2xx 报错).
// 无依赖. 运行: node test-servers/sse-server.cjs
// 应用里新建 SSE 标签连 http://127.0.0.1:3002/ (或 /404).
require("http")
  .createServer((req, res) => {
    if (req.url === "/404") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      res.write(`event: tick\ndata: ${n}\n\n`);
    }, 1000);
    req.on("close", () => clearInterval(timer));
  })
  .listen(3002, "127.0.0.1", () => {
    console.log(
      "SSE 服务器已启动: http://127.0.0.1:3002 (推送), /404 (测错误)",
    );
    console.log("Ctrl+C 停止.");
  });
