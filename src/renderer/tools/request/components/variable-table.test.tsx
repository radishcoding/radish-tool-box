// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildScopesFromStore } from "../model/variable-scopes";
import type { KeyValueItem } from "../model/types";
import { useRequestStore } from "../store/request-store";
import { VariableTable } from "./variable-table";

afterEach(cleanup);

describe("VariableTable 复选框", () => {
  it("取消勾选把该项 enabled 置为 false", () => {
    const items: KeyValueItem[] = [
      { id: "1", key: "host", value: "x.com", enabled: true },
    ];
    const onChange = vi.fn();
    render(<VariableTable items={items} onChange={onChange} />);

    const checkbox = screen.getByLabelText("启用此变量");
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([
      { id: "1", key: "host", value: "x.com", enabled: false },
    ]);
  });

  it("接线到 updateGlobals: 取消勾选后 store 与作用域都排除该变量", () => {
    useRequestStore
      .getState()
      .updateGlobals([{ id: "1", key: "host", value: "x.com", enabled: true }]);
    const updateGlobals = useRequestStore.getState().updateGlobals;
    render(
      <VariableTable
        items={useRequestStore.getState().globals}
        onChange={updateGlobals}
      />,
    );

    fireEvent.click(screen.getByLabelText("启用此变量"));

    const globals = useRequestStore.getState().globals;
    expect(globals[0].enabled).toBe(false);
    expect(buildScopesFromStore(globals, undefined, []).global).toEqual({});
  });
});
