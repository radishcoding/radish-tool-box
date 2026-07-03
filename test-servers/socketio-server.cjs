// Socket.IO 回声服务器: 收到任意事件即用同名事件原样回显; 命名空间 /chat 连上即推 hello.
// socket.io 已在项目 node_modules, 从项目根目录直接运行即可 (无需额外 install).
// 运行: node test-servers/socketio-server.cjs
// 应用里新建 Socket.IO 标签连 http://127.0.0.1:3001; 事件名 message 发 "hi" 即收到 message "hi".
const { Server } = require("socket.io");

const io = new Server(3001, { cors: { origin: "*" } });
io.on("connection", (socket) => {
  // 同名回显: 收到什么事件就回什么事件 (数据原样), 便于核对事件名与内容.
  socket.onAny((event, ...args) => socket.emit(event, ...args));
});
io.of("/chat").on("connection", (socket) => {
  // 连上即推 hello, 之后同名回显 (与默认命名空间一致).
  socket.emit("hello", "ns ok");
  socket.onAny((event, ...args) => socket.emit(event, ...args));
});
console.log(
  "Socket.IO 服务器已启动: http://127.0.0.1:3001 (命名空间 /chat 可用)",
);
console.log("Ctrl+C 停止.");
