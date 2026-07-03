import { describe, expect, it } from "vitest";

import { buildExecuteJob } from "./build-job";
import { createDefaultRequest } from "./types";

const emptyScopes = { global: {}, collection: {}, environment: {}, local: {} };

describe("buildExecuteJob", () => {
  it("用给定 jobId 与作用域包装请求", () => {
    const request = { ...createDefaultRequest(), url: "https://x.com" };
    const job = buildExecuteJob(request, "job-1", emptyScopes);
    expect(job.jobId).toBe("job-1");
    expect(job.spec).toBe(request);
    expect(job.variableScopes).toBe(emptyScopes);
  });
});
