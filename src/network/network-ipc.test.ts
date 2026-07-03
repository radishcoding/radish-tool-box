// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runJobToSender } from "./network-ipc";
import type { ExecuteJob, StreamEvent } from "./request-channels";
import { REQUEST_CHANNEL } from "./request-channels";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

describe("runJobToSender", () => {
  it("把流式事件经 sender.send 以 EVENT 通道回传, 结束后清理作业表", async () => {
    const sent: Array<{ channel: string; payload: StreamEvent }> = [];
    const sender = {
      send: (channel: string, payload: unknown) =>
        sent.push({ channel, payload: payload as StreamEvent }),
    };
    const jobs = new Map<string, AbortController>();
    const job: ExecuteJob = {
      jobId: "j1",
      spec: {
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
      },
      variableScopes: {
        global: {},
        collection: {},
        environment: {},
        local: {},
      },
    };
    await runJobToSender(job, sender, jobs);
    expect(sent.every((s) => s.channel === REQUEST_CHANNEL.EVENT)).toBe(true);
    expect(sent.every((s) => s.payload.jobId === "j1")).toBe(true);
    expect(sent.at(-1)?.payload.kind).toBe("end");
    expect(jobs.has("j1")).toBe(false);
  });
});
