import { describe, expect, it } from "vitest";

import { addRecentFile } from "./recent-files";

describe("addRecentFile", () => {
  it("新路径置顶", () => {
    expect(addRecentFile(["/b", "/c"], "/a")).toEqual(["/a", "/b", "/c"]);
  });

  it("已存在则去重并置顶", () => {
    expect(addRecentFile(["/b", "/a", "/c"], "/a")).toEqual(["/a", "/b", "/c"]);
  });

  it("超过上限截断", () => {
    expect(addRecentFile(["/1", "/2", "/3"], "/0", 3)).toEqual([
      "/0",
      "/1",
      "/2",
    ]);
  });
});
