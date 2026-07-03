// gRPC 回声服务器: 一元/服务端流/客户端流/双向流四种调用.
// 需依赖: 在 test-servers 目录执行 npm install (会装 @grpc/grpc-js 与 @grpc/proto-loader).
// 运行: node test-servers/grpc-server.cjs
// 应用里新建 gRPC 标签, proto 源选"文件"填本目录 echo.proto 的绝对路径 (或粘贴其内容),
// target 填 127.0.0.1:50051, 即可测全部四种调用.
const path = require("node:path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const def = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, "echo.proto"), { keepCase: true }),
);

/** 取用户自定义 metadata (排除 grpc-* 与 user-agent 等内置项). */
function customMeta(call) {
  const map = call.metadata.getMap();
  const custom = {};
  for (const [key, value] of Object.entries(map)) {
    if (!key.startsWith("grpc-") && key !== "user-agent") {
      custom[key] = value;
    }
  }
  return custom;
}

/** 打印本次调用收到的 metadata (含内置项), 便于核对客户端是否发出. */
function logMeta(method, call) {
  console.log(
    `${method} 收到 metadata:`,
    JSON.stringify(call.metadata.getMap()),
  );
}

const server = new grpc.Server();
server.addService(def.echo.Echo.service, {
  Unary: (call, callback) => {
    logMeta("Unary", call);
    const meta = customMeta(call);
    // 有自定义 metadata 时回显到响应文本, 使工具里也能直接看到 (无则不改变原格式).
    const suffix =
      Object.keys(meta).length > 0 ? ` | meta:${JSON.stringify(meta)}` : "";
    callback(null, { text: "echo:" + call.request.text + suffix });
  },
  ServerStream: (call) => {
    logMeta("ServerStream", call);
    for (let i = 0; i < 3; i += 1) {
      call.write({ text: `${i}:${call.request.text}` });
    }
    call.end();
  },
  ClientStream: (call, callback) => {
    logMeta("ClientStream", call);
    const all = [];
    call.on("data", (msg) => all.push(msg.text));
    call.on("end", () => callback(null, { text: all.join(",") }));
  },
  Bidi: (call) => {
    logMeta("Bidi", call);
    call.on("data", (msg) => call.write({ text: "echo:" + msg.text }));
    call.on("end", () => call.end());
  },
});

server.bindAsync(
  "127.0.0.1:50051",
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log("gRPC 服务器已启动: 127.0.0.1:50051 (proto: echo.proto)");
    console.log("Ctrl+C 停止.");
  },
);
