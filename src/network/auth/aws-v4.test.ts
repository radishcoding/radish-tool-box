// @vitest-environment node
import { describe, expect, it } from "vitest";

import { signAwsV4 } from "./aws-v4";

describe("signAwsV4 (AWS get-vanilla 向量)", () => {
  it("空体 GET 产出官方签名", () => {
    const result = signAwsV4({
      method: "GET",
      url: "https://example.amazonaws.com/",
      body: Buffer.alloc(0),
      amzDate: "20150830T123600Z",
      auth: {
        type: "awsv4",
        accessKeyId: "AKIDEXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
        service: "service",
        sessionToken: "",
      },
    });
    const authHeader = result.headers.find((h) => h.key === "Authorization");
    expect(authHeader?.value).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, " +
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
    expect(result.headers.find((h) => h.key === "x-amz-date")?.value).toBe(
      "20150830T123600Z",
    );
  });

  it("带 sessionToken 时附加 x-amz-security-token", () => {
    const result = signAwsV4({
      method: "GET",
      url: "https://example.amazonaws.com/",
      body: Buffer.alloc(0),
      amzDate: "20150830T123600Z",
      auth: {
        type: "awsv4",
        accessKeyId: "AKIDEXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
        service: "service",
        sessionToken: "TOKEN123",
      },
    });
    expect(
      result.headers.find((h) => h.key === "x-amz-security-token")?.value,
    ).toBe("TOKEN123");
  });
});
