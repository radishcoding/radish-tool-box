// mTLS HTTPS 服务器: 证书由自签 CA 签发, 且强制客户端提供 CA 签发的客户端证书.
// 先跑一次 gen-certs.cjs 生成 certs/, 再运行本文件.
// 需依赖: 在 test-servers 目录 npm install.
// 运行: node test-servers/mtls-server.cjs  (端口 3005, https://localhost:3005)
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const dir = path.join(__dirname, "certs");
const read = (name) => fs.readFileSync(path.join(dir, name));

https
  .createServer(
    {
      cert: read("server-cert.pem"),
      key: read("server-key.pem"),
      ca: read("ca-cert.pem"),
      requestCert: true, // 要求客户端出示证书
      rejectUnauthorized: true, // 必须是 CA 签发的客户端证书 (mTLS)
      // minVersion: "TLSv1.3", // 需要固定 TLS 版本时取消注释
    },
    (req, res) => {
      const cert = req.socket.getPeerCertificate();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          {
            ok: true,
            tlsVersion: req.socket.getProtocol(), // 实际协商的 TLS 版本
            sni: req.socket.servername, // SNI 主机名
            clientCN: cert && cert.subject ? cert.subject.CN : null, // 收到的客户端证书 CN
          },
          null,
          2,
        ),
      );
    },
  )
  .listen(3005, "127.0.0.1", () => {
    console.log("mTLS HTTPS 服务器已启动: https://localhost:3005");
    console.log("需在应用 Settings 里配: 自定义 CA=ca-cert.pem,");
    console.log("客户端证书=client-cert.pem, 客户端私钥=client-key.pem");
    console.log("Ctrl+C 停止.");
  });
