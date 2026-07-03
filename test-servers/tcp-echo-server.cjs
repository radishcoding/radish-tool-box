// 本地 TCP 回声服务器 (无外网依赖): 收到什么就原样回什么, 立即回显, 无需换行.
// 与公共的 tcpbin.com:4242 (按行回显, 需 \n) 不同, 这里逐字节即时回显, 方便测试.
// 运行: node test-servers/tcp-echo-server.cjs   (监听 127.0.0.1:3009)
// 工具里新建 TCP 标签, host 填 127.0.0.1, port 填 3009.
const net = require("node:net");

const PORT = 3009;
const server = net.createServer((socket) => {
  // 原样回显收到的字节 (文本/二进制均可).
  socket.on("data", (data) => socket.write(data));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `TCP 回声服务器已启动: 127.0.0.1:${PORT} (收到即原样回显, 无需换行)`,
  );
  console.log("Ctrl+C 停止.");
});
