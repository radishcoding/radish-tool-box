// 本地 TLS 的 TCP 回声服务器 (自签证书, CN=localhost, SAN=localhost/127.0.0.1).
// 前置: 证书需已在 test-servers/certs/ (若无, 先跑 node test-servers/gen-certs.cjs).
// 运行: node test-servers/tls-echo-server.cjs   (监听 127.0.0.1:3010)
// 工具里: 新建 TCP 标签 -> 勾选 TLS, host=127.0.0.1, port=3010;
//   因是自签证书, 在"连接配置 -> TLS/高级"里【关闭"校验 SSL 证书"】,
//   或【设自定义 CA = test-servers/certs/ca-cert.pem 的绝对路径】.
const tls = require("node:tls");
const fs = require("node:fs");
const path = require("node:path");

const certDir = path.join(__dirname, "certs");
const options = {
  cert: fs.readFileSync(path.join(certDir, "server-cert.pem")),
  key: fs.readFileSync(path.join(certDir, "server-key.pem")),
};

const PORT = 3010;
const server = tls.createServer(options, (socket) => {
  // 原样即时回显 (无需换行).
  socket.on("data", (data) => socket.write(data));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`TLS TCP 回声服务器已启动: 127.0.0.1:${PORT} (自签证书)`);
  console.log(
    "工具里勾选 TLS 连接; 自签证书需在 TLS/高级里关闭 SSL 校验, 或设自定义 CA = test-servers/certs/ca-cert.pem",
  );
  console.log("Ctrl+C 停止.");
});
