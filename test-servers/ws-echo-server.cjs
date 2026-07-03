// 本地 WebSocket 回声服务器 (无外网/DNS 依赖, 用于测试 WS 连接/收发/子协议/请求头).
// 运行: node test-servers/ws-echo-server.cjs   (监听 127.0.0.1:3008)
// 在工具里连接: ws://127.0.0.1:3008
//   - 连上后服务器主动发欢迎消息 (含协商到的子协议) + 回显收到的握手请求头
//   - 你发的任何文本/二进制都会被原样回显
//   - 子协议: 服务器选取客户端提供的第一个 (无则不选)
const { WebSocketServer } = require("ws");

const PORT = 3008;
const wss = new WebSocketServer({
  host: "127.0.0.1",
  port: PORT,
  // 从客户端提供的子协议里选第一个; 无则返回 false (不协商).
  handleProtocols: (protocols) => {
    const first = [...protocols][0];
    return first ?? false;
  },
});

// 连接自增编号, 便于在日志里区分不同连接 (验证"关标签后是否真断开, 有无残留").
let connectionCount = 0;
wss.on("connection", (ws, request) => {
  connectionCount += 1;
  const id = connectionCount;
  console.log(`[+] 客户端已连接 #${id} (当前在线: ${wss.clients.size})`);
  const sub = ws.protocol ? ` (子协议: ${ws.protocol})` : "";
  ws.send(`已连接到本地回声服务器${sub}`);
  // 回显握手时收到的请求头 (含你在工具里加的自定义头, 如 X-Custom).
  ws.send("收到的请求头:\n" + JSON.stringify(request.headers, null, 2));
  ws.on("message", (data, isBinary) => {
    // 原样回显 (保留二进制/文本).
    ws.send(data, { binary: isBinary });
  });
  // 关标签 -> 工具先 disconnect -> 这里收到 close, 在线数应归 0 (无残留).
  ws.on("close", () => {
    console.log(`[-] 客户端断开 #${id} (当前在线: ${wss.clients.size})`);
  });
});

wss.on("listening", () => {
  console.log(`WS 回声服务器已启动: ws://127.0.0.1:${PORT}`);
  console.log("连上后会收到欢迎消息; 发送的内容会被原样回显. Ctrl+C 停止.");
});
