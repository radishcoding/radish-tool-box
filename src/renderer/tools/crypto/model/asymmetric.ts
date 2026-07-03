import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { p256, p384, p521 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import forge from "node-forge";
import { sm2 } from "sm-crypto-v2";

import { bytesToHex, hexToBytes } from "./codec";
import { fail, ok, type Outcome } from "./types";
import type { AsymRequest, AsymResult } from "./asym-types";

/**
 * EC 曲线映射.
 */
const NOBLE_CURVES = { secp256k1, p256, p384, p521 } as const;

/**
 * 字节转 forge 二进制串.
 * @param bytes 输入字节.
 */
function toForgeBytes(bytes: Uint8Array): string {
  return forge.util.hexToBytes(bytesToHex(bytes));
}

/**
 * forge 二进制串转字节.
 * @param binary forge 二进制串.
 */
function fromForgeBytes(binary: string): Uint8Array {
  return hexToBytes(forge.util.bytesToHex(binary));
}

/**
 * RSA 路径 (node-forge).
 * @param request 请求.
 */
function runRsa(request: AsymRequest): AsymResult {
  const message = toForgeBytes(request.data);
  if (request.operation === "encrypt") {
    const pub = forge.pki.publicKeyFromPem(request.publicKey);
    const cipher =
      request.scheme === "pkcs1"
        ? pub.encrypt(message)
        : pub.encrypt(message, "RSA-OAEP", { md: forge.md.sha256.create() });
    return { kind: "bytes", value: fromForgeBytes(cipher) };
  }
  if (request.operation === "decrypt") {
    const priv = forge.pki.privateKeyFromPem(request.privateKey);
    const plain =
      request.scheme === "pkcs1"
        ? priv.decrypt(message)
        : priv.decrypt(message, "RSA-OAEP", { md: forge.md.sha256.create() });
    return { kind: "bytes", value: fromForgeBytes(plain) };
  }
  if (request.operation === "sign") {
    const digest = forge.md.sha256.create();
    digest.update(message);
    const priv = forge.pki.privateKeyFromPem(request.privateKey);
    const pss = forge.pss.create({
      md: forge.md.sha256.create(),
      mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
      saltLength: 32,
    });
    const signature =
      request.scheme === "pkcs1-sign"
        ? priv.sign(digest)
        : priv.sign(digest, pss);
    return { kind: "bytes", value: fromForgeBytes(signature) };
  }
  // verify: 独立构造 digest, 避免复用已 sign/digest 过的对象
  const digest = forge.md.sha256.create();
  digest.update(message);
  const pub = forge.pki.publicKeyFromPem(request.publicKey);
  const pss = forge.pss.create({
    md: forge.md.sha256.create(),
    mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
    saltLength: 32,
  });
  const verified =
    request.scheme === "pkcs1-sign"
      ? pub.verify(digest.digest().bytes(), toForgeBytes(request.signature))
      : pub.verify(
          digest.digest().bytes(),
          toForgeBytes(request.signature),
          pss,
        );
  return { kind: "boolean", value: verified };
}

/**
 * EC (ECDSA/ECDH) 路径 (noble).
 * noble sign 返回 Signature 对象, 需调用 toCompactRawBytes() 转字节存储与传输.
 * @param request 请求.
 */
function runEc(request: AsymRequest): AsymResult {
  const curve = NOBLE_CURVES[request.variant as keyof typeof NOBLE_CURVES];
  if (!curve) {
    throw new Error("未知曲线");
  }
  if (request.operation === "derive") {
    const shared = curve.getSharedSecret(
      hexToBytes(request.privateKey),
      hexToBytes(request.publicKey),
    );
    return { kind: "bytes", value: shared };
  }
  if (request.operation === "sign") {
    const sig = curve.sign(request.data, hexToBytes(request.privateKey), {
      prehash: true,
    });
    return { kind: "bytes", value: sig.toCompactRawBytes() };
  }
  const valid = curve.verify(
    request.signature,
    request.data,
    hexToBytes(request.publicKey),
    { prehash: true },
  );
  return { kind: "boolean", value: valid };
}

/**
 * Ed25519 / X25519 路径 (noble).
 * ed25519.sign 直接返回 Uint8Array.
 * @param request 请求.
 */
function runEdwards(request: AsymRequest): AsymResult {
  if (request.algorithmId === "x25519") {
    const shared = x25519.getSharedSecret(
      hexToBytes(request.privateKey),
      hexToBytes(request.publicKey),
    );
    return { kind: "bytes", value: shared };
  }
  if (request.operation === "sign") {
    const sig = ed25519.sign(request.data, hexToBytes(request.privateKey));
    return { kind: "bytes", value: sig };
  }
  const valid = ed25519.verify(
    request.signature,
    request.data,
    hexToBytes(request.publicKey),
  );
  return { kind: "boolean", value: valid };
}

/**
 * 国密 SM2 路径 (sm-crypto-v2).
 * doDecrypt 以 {output:'array'} 调用时返回 Uint8Array.
 * @param request 请求.
 */
function runSm2(request: AsymRequest): AsymResult {
  if (request.operation === "encrypt") {
    const cipherHex = sm2.doEncrypt(request.data, request.publicKey, 1);
    return { kind: "bytes", value: hexToBytes(cipherHex) };
  }
  if (request.operation === "decrypt") {
    const plain = sm2.doDecrypt(
      bytesToHex(request.data),
      request.privateKey,
      1,
      { output: "array" },
    );
    return { kind: "bytes", value: plain };
  }
  if (request.operation === "sign") {
    const sigHex = sm2.doSignature(request.data, request.privateKey, {
      hash: true,
    });
    return { kind: "bytes", value: hexToBytes(sigHex) };
  }
  const valid = sm2.doVerifySignature(
    request.data,
    bytesToHex(request.signature),
    request.publicKey,
    { hash: true },
  );
  return { kind: "boolean", value: valid };
}

/**
 * 执行非对称运算 (密钥对生成见 keypair.ts).
 * @param request 非对称请求.
 */
export function runAsym(request: AsymRequest): Outcome<AsymResult> {
  try {
    switch (request.algorithmId) {
      case "rsa":
        return ok(runRsa(request));
      case "ecdsa":
      case "ecdh":
        return ok(runEc(request));
      case "ed25519":
      case "x25519":
        return ok(runEdwards(request));
      case "sm2":
        return ok(runSm2(request));
      default:
        return fail("未知非对称算法");
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "非对称计算失败");
  }
}
