// 生成一套自签 CA + 服务器证书 (CA 签发, SAN=localhost/127.0.0.1) + 客户端证书 (CA 签发).
// 用于测试 自定义 CA / 客户端证书(mTLS) / TLS 版本 / SNI.
// 需依赖: 在 test-servers 目录 npm install (含 node-forge).
// 运行: node test-servers/gen-certs.cjs  -> 输出到 test-servers/certs/
const fs = require("node:fs");
const path = require("node:path");
const forge = require("node-forge");

const outDir = path.join(__dirname, "certs");
fs.mkdirSync(outDir, { recursive: true });

const keypair = () => forge.pki.rsa.generateKeyPair(2048);
const plusYears = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d;
};

function buildCert({ cn, keys, issuerCert, issuerKeys, isCa, sans, serial }) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial;
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = plusYears(5);
  const subject = [{ name: "commonName", value: cn }];
  cert.setSubject(subject);
  cert.setIssuer(issuerCert ? issuerCert.subject.attributes : subject);
  const exts = [{ name: "basicConstraints", cA: Boolean(isCa) }];
  if (sans) {
    exts.push({ name: "subjectAltName", altNames: sans });
  }
  if (!isCa) {
    exts.push({ name: "extKeyUsage", serverAuth: true, clientAuth: true });
  }
  cert.setExtensions(exts);
  cert.sign(
    issuerKeys ? issuerKeys.privateKey : keys.privateKey,
    forge.md.sha256.create(),
  );
  return cert;
}

const caKeys = keypair();
const caCert = buildCert({
  cn: "Radish Test CA",
  keys: caKeys,
  isCa: true,
  serial: "01",
});

const serverKeys = keypair();
const serverCert = buildCert({
  cn: "localhost",
  keys: serverKeys,
  issuerCert: caCert,
  issuerKeys: caKeys,
  sans: [
    { type: 2, value: "localhost" }, // DNS
    { type: 7, ip: "127.0.0.1" }, // IP
  ],
  serial: "02",
});

const clientKeys = keypair();
const clientCert = buildCert({
  cn: "radish-client",
  keys: clientKeys,
  issuerCert: caCert,
  issuerKeys: caKeys,
  serial: "03",
});

const write = (name, pem) => fs.writeFileSync(path.join(outDir, name), pem);
write("ca-cert.pem", forge.pki.certificateToPem(caCert));
write("server-cert.pem", forge.pki.certificateToPem(serverCert));
write("server-key.pem", forge.pki.privateKeyToPem(serverKeys.privateKey));
write("client-cert.pem", forge.pki.certificateToPem(clientCert));
write("client-key.pem", forge.pki.privateKeyToPem(clientKeys.privateKey));

console.log("证书已生成到:", outDir);
console.log("  ca-cert.pem       (自定义 CA, 填到 Settings 的自定义 CA)");
console.log("  client-cert.pem   (客户端证书, 填到 Settings 的客户端证书)");
console.log("  client-key.pem    (客户端私钥)");
console.log("  server-*.pem      (mTLS 服务器用)");
