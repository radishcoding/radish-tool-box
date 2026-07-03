// 跨源/同源重定向测试: 一个脚本起两个端口 (不同端口 = 不同源).
// 无依赖. 运行: node test-servers/redirect-server.cjs  (端口 3006 主 + 3007 另一源)
//   GET http://127.0.0.1:3006/cross -> 302 跳到 3007/echo (跨源, 敏感头应被剥离)
//   GET http://127.0.0.1:3006/same  -> 302 跳到 3006/echo (同源, 敏感头应保留)
//   /echo 两个端口都回显收到的请求头
const http = require("node:http");

function echo(req, res) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify(
      { port: req.socket.localPort, url: req.url, headers: req.headers },
      null,
      2,
    ),
  );
}

// 3007: 另一个源, 只做 echo (作为跨源跳转的落地).
http
  .createServer((req, res) => echo(req, res))
  .listen(3007, "127.0.0.1", () =>
    console.log("落地源已启动: http://127.0.0.1:3007"),
  );

// 3006: 主源, 提供 /cross (跨源跳) /same (同源跳) /echo.
http
  .createServer((req, res) => {
    if (req.url === "/cross") {
      res.writeHead(302, { location: "http://127.0.0.1:3007/echo" });
      res.end();
      return;
    }
    if (req.url === "/same") {
      res.writeHead(302, { location: "/echo" });
      res.end();
      return;
    }
    echo(req, res);
  })
  .listen(3006, "127.0.0.1", () => {
    console.log("重定向服务器已启动: http://127.0.0.1:3006");
    console.log("  /cross -> 跳 3007 (跨源, 剥离 Authorization/Cookie)");
    console.log("  /same  -> 跳 3006/echo (同源, 保留)");
    console.log("Ctrl+C 停止.");
  });
