// 极简 OAuth2 (client_credentials) 测试服务器, 用于验证 "先取 token 再带 Bearer 发出".
// 无依赖. 运行: node test-servers/oauth-server.cjs  (端口 3004)
//   POST /token  -> 返回 { access_token, token_type, expires_in } (回显收到的表单便于核对)
//   其它路径     -> 回显收到的请求头 (可看到 Authorization: Bearer <token>)
let counter = 0;
require("http")
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (req.url === "/token" && req.method === "POST") {
        counter += 1;
        const token = `test-token-${counter}`;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            access_token: token,
            token_type: "Bearer",
            expires_in: 3600,
            received_form: body, // 回显收到的 grant_type/client_id/secret/scope
          }),
        );
        console.log(`[token] 颁发 ${token}; 收到表单: ${body}`);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          { method: req.method, url: req.url, headers: req.headers },
          null,
          2,
        ),
      );
      console.log(
        `[api] ${req.method} ${req.url} authorization=${req.headers.authorization ?? "(无)"}`,
      );
    });
  })
  .listen(3004, "127.0.0.1", () => {
    console.log("OAuth2 测试服务器已启动: http://127.0.0.1:3004");
    console.log("  token 端点: http://127.0.0.1:3004/token");
    console.log(
      "  受保护资源: http://127.0.0.1:3004/echo (回显 Authorization 头)",
    );
    console.log("Ctrl+C 停止.");
  });
