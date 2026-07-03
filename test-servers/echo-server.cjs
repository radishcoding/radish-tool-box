// HTTP 回声服务器: 把收到的请求方法/路径/头/体原样回显为 JSON.
// 用途: 验证洁净模式 (对比普通/洁净两种模式实际发出的请求头), 以及 Body/Content-Length.
// 无依赖. 运行: node test-servers/echo-server.cjs
// 然后在应用里发请求到 http://127.0.0.1:3003/
require("http")
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          { method: req.method, url: req.url, headers: req.headers, body },
          null,
          2,
        ),
      );
    });
  })
  .listen(3003, "127.0.0.1", () => {
    console.log("HTTP 回声服务器已启动: http://127.0.0.1:3003");
    console.log(
      "普通模式发请求看 headers 含 user-agent/accept/accept-encoding;",
    );
    console.log("洁净模式同请求看 headers 不含这些 (仅 host/connection).");
    console.log("Ctrl+C 停止.");
  });
