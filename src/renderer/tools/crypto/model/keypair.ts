import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { p256, p384, p521 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import forge from "node-forge";
import { sm2 } from "sm-crypto-v2";

import { bytesToHex } from "./codec";
import { fail, ok, type Outcome } from "./types";

/**
 * 公私钥文本对 (RSA 为 PEM, 其余为 Hex).
 */
export interface KeyPairText {
  readonly publicKey: string;
  readonly privateKey: string;
}

/**
 * EC 曲线 id 到 noble 曲线对象的映射.
 */
const NOBLE_CURVES = { secp256k1, p256, p384, p521 } as const;

/**
 * 异步生成 RSA 密钥对并序列化为 PEM.
 * @param bits RSA 密钥位数.
 */
function generateRsa(bits: number): Promise<KeyPairText> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits, workers: -1 }, (error, keypair) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
        privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
      });
    });
  });
}

/**
 * 生成非对称密钥对.
 * @param algorithmId 算法 id.
 * @param variant 变体 (RSA 位数或 EC 曲线 id).
 */
export async function generateAsymKeypair(
  algorithmId: string,
  variant: string,
): Promise<Outcome<KeyPairText>> {
  try {
    switch (algorithmId) {
      case "rsa": {
        const bits = Number(variant) || 2048;
        return ok(await generateRsa(bits));
      }
      case "ecdsa":
      case "ecdh": {
        const curve = NOBLE_CURVES[variant as keyof typeof NOBLE_CURVES];
        if (!curve) {
          return fail("未知曲线");
        }
        const pair = curve.keygen();
        return ok({
          publicKey: bytesToHex(pair.publicKey),
          privateKey: bytesToHex(pair.secretKey),
        });
      }
      case "ed25519": {
        const pair = ed25519.keygen();
        return ok({
          publicKey: bytesToHex(pair.publicKey),
          privateKey: bytesToHex(pair.secretKey),
        });
      }
      case "x25519": {
        const pair = x25519.keygen();
        return ok({
          publicKey: bytesToHex(pair.publicKey),
          privateKey: bytesToHex(pair.secretKey),
        });
      }
      case "sm2": {
        const pair = sm2.generateKeyPairHex();
        return ok({ publicKey: pair.publicKey, privateKey: pair.privateKey });
      }
      default:
        return fail("未知非对称算法");
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "密钥生成失败");
  }
}
