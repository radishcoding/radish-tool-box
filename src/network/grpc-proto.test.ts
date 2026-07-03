// @vitest-environment node
import { describe, expect, it } from "vitest";

import { findServiceClient, listServices } from "./grpc-proto";

const PROTO = `
syntax = "proto3";
package greet;

message HelloRequest { string name = 1; }
message HelloReply { string message = 1; }

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc SayHelloServerStream (HelloRequest) returns (stream HelloReply);
  rpc SayHelloClientStream (stream HelloRequest) returns (HelloReply);
  rpc SayHelloBidi (stream HelloRequest) returns (stream HelloReply);
}
`;

// 嵌套包名测试用 proto.
const NESTED_PROTO = `
syntax = "proto3";
package a.b;

message Req {}
message Res {}

service Svc {
  rpc DoIt (Req) returns (Res);
}
`;

describe("listServices", () => {
  it("从粘贴文本自省出服务与方法及流标志", async () => {
    const result = await listServices({ kind: "text", value: PROTO });
    expect(result.ok).toBe(true);
    const svc = result.services.find((s) => s.name === "greet.Greeter");
    expect(svc).toBeDefined();
    const unary = svc?.methods.find((m) => m.name === "SayHello");
    expect(unary).toMatchObject({
      requestStream: false,
      responseStream: false,
    });
    const serverStream = svc?.methods.find(
      (m) => m.name === "SayHelloServerStream",
    );
    expect(serverStream).toMatchObject({
      requestStream: false,
      responseStream: true,
    });
    const clientStream = svc?.methods.find(
      (m) => m.name === "SayHelloClientStream",
    );
    expect(clientStream).toMatchObject({
      requestStream: true,
      responseStream: false,
    });
    const bidi = svc?.methods.find((m) => m.name === "SayHelloBidi");
    expect(bidi).toMatchObject({ requestStream: true, responseStream: true });
  });

  it("非法 proto 返回 ok:false 与 error", async () => {
    const result = await listServices({ kind: "text", value: "not a proto" });
    expect(result.ok).toBe(false);
    expect(result.error).not.toBe("");
  });

  it("嵌套包 (a.b.Svc) 也能被 collectServices 收录", async () => {
    const result = await listServices({ kind: "text", value: NESTED_PROTO });
    expect(result.ok).toBe(true);
    const svc = result.services.find((s) => s.name === "a.b.Svc");
    expect(svc).toBeDefined();
    expect(svc?.methods).toHaveLength(1);
    expect(svc?.methods[0].name).toBe("DoIt");
  });
});

describe("findServiceClient", () => {
  it("全限定名命中返回构造器 (含 .service 属性)", async () => {
    const ctor = await findServiceClient(
      { kind: "text", value: PROTO },
      "greet.Greeter",
    );
    expect(typeof ctor).toBe("function");
    expect(ctor.service).toBeDefined();
    expect(typeof ctor.service).toBe("object");
  });

  it("非法名 (不存在的服务) 抛错", async () => {
    await expect(
      findServiceClient({ kind: "text", value: PROTO }, "greet.NoService"),
    ).rejects.toThrow();
  });

  it("名称存在但不是服务构造器 (指向 package 节点) 抛错", async () => {
    // "greet" 是包名节点, 不是服务构造器, 应抛 "不是有效的 gRPC 服务".
    await expect(
      findServiceClient({ kind: "text", value: PROTO }, "greet"),
    ).rejects.toThrow(/不是有效的 gRPC 服务/);
  });

  it("嵌套包服务 a.b.Svc 按路径逐段解析命中", async () => {
    const ctor = await findServiceClient(
      { kind: "text", value: NESTED_PROTO },
      "a.b.Svc",
    );
    expect(ctor.service).toBeDefined();
  });
});
