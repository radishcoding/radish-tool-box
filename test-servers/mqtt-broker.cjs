// 本地 MQTT broker (aedes): 要求账密认证, 打印 clientId; 用于验证 clientId/用户名/密码等连接参数生效.
// aedes 已在项目 node_modules, 从项目根目录直接运行即可.
// 运行: node test-servers/mqtt-broker.cjs   (监听 127.0.0.1:1883)
// 认证: 用户名 radish / 密码 secret (其它凭据一律拒绝, 用于验证账密是否真生效).
// 订阅某主题后发布到同一主题即可看到回声 (broker 把自发消息投递回订阅者).
const net = require("node:net");
const { Aedes } = require("aedes");

void (async () => {
  const broker = await Aedes.createBroker();

  broker.authenticate = (client, username, password, callback) => {
    const pass = password ? password.toString() : "";
    const ok = username === "radish" && pass === "secret";
    console.log(
      `认证请求: clientId=${client.id} username=${username ?? "(空)"} -> ${ok ? "通过" : "拒绝"}`,
    );
    if (ok) {
      callback(null, true);
    } else {
      const err = new Error("认证失败: 用户名或密码错误");
      // 3.1.1/5.0: 4 = Bad username or password.
      err.returnCode = 4;
      callback(err, false);
    }
  };

  broker.on("client", (client) =>
    console.log(`客户端已连接: clientId=${client.id}`),
  );
  broker.on("clientDisconnect", (client) =>
    console.log(`客户端断开: clientId=${client.id}`),
  );
  broker.on("subscribe", (subs, client) =>
    console.log(`订阅: ${client.id} -> ${subs.map((s) => s.topic).join(", ")}`),
  );
  broker.on("publish", (packet, client) => {
    if (client) {
      console.log(`发布: ${client.id} -> ${packet.topic} = ${packet.payload}`);
    }
  });

  const server = net.createServer(broker.handle);
  server.listen(1883, "127.0.0.1", () => {
    console.log("MQTT broker 已启动: mqtt://127.0.0.1:1883");
    console.log(
      "需账密: 用户名 radish / 密码 secret (错误凭据会被拒绝). Ctrl+C 停止.",
    );
  });
})();
