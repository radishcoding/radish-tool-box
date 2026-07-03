// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CookieJar } from "./cookie-jar";
import { runJob } from "./pipeline";
import type { ExecuteJob, HttpRequest, StreamEvent } from "./request-channels";

let server: Server;
let port: number;
let seenPath = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    seenPath = req.url ?? "";
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"n":7}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

const baseRequest = (over: Partial<HttpRequest>): HttpRequest => ({
  method: "GET",
  url: `http://127.0.0.1:${port}/`,
  params: [],
  headers: [],
  cleanMode: false,
  auth: { type: "none" },
  body: { type: "none" },
  settings: {
    followRedirects: true,
    maxRedirects: 5,
    timeoutMs: 10000,
    sslVerify: true,
  },
  preScript: "",
  postScript: "",
  ...over,
});

async function run(request: HttpRequest): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  const job: ExecuteJob = {
    jobId: "j",
    spec: request,
    variableScopes: { global: {}, collection: {}, environment: {}, local: {} },
  };
  await runJob(
    job,
    new CookieJar(),
    (e) => events.push(e),
    new AbortController().signal,
  );
  return events;
}

describe("pipeline 脚本整合", () => {
  it("前置脚本 set 变量影响 URL 解析并 emit vars", async () => {
    const events = await run(
      baseRequest({
        url: `http://127.0.0.1:${port}/{{p}}`,
        preScript: 'pm.environment.set("p", "v1");',
      }),
    );
    expect(seenPath).toBe("/v1");
    const vars = events.find((e) => e.kind === "vars");
    expect(vars).toBeDefined();
  });

  it("后置脚本 pm.test 结果经 test 事件回传, log 经 log 事件", async () => {
    const events = await run(
      baseRequest({
        postScript: `console.log("done");
          pm.test("n 为 7", function () { pm.expect(pm.response.json().n).to.equal(7); });`,
      }),
    );
    const tests = events.filter((e) => e.kind === "test");
    expect(tests).toHaveLength(1);
    expect((tests[0].payload as { passed: boolean }).passed).toBe(true);
    const logs = events.filter((e) => e.kind === "log");
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // end 在最后
    expect(events.at(-1)?.kind).toBe("end");
  });
});
