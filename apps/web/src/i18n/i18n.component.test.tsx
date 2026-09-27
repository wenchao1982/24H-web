import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Sidebar from "../shell/Sidebar";
import { t } from "./index";

describe("i18n 组件接入", () => {
  it("Sidebar 渲染字典文案（而非内联字面量）", () => {
    render(<Sidebar />);

    expect(screen.getByRole("navigation", { name: t("sidebar.aria") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("nav.chat") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("nav.settings") })).toBeInTheDocument();
  });
});
