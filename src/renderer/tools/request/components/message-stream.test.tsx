// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Message } from "../model/types";
import { MessageStream } from "./message-stream";

// jsdom 未实现 scrollIntoView, 桩掉避免 effect 报错.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("MessageStream", () => {
  it("每条消息标签含方向 + 时间 + 大小", () => {
    const msg: Message = {
      id: "1",
      direction: "sent",
      time: 1719800000000,
      event: "",
      data: "test",
    };
    const { container } = render(<MessageStream messages={[msg]} />);
    const text = container.textContent ?? "";
    expect(text).toContain("发送");
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}/); // 时间 HH:MM:SS
    expect(text).toContain("4 B"); // "test" 为 4 字节
    expect(text).toContain("test");
  });
});
