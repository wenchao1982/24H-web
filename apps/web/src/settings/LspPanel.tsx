import JsonConfigPanel from "./JsonConfigPanel";

/** 设置 → 高级 → LSP（T23.11）：语言服务器配置（`lsp`）的 JSON 读写。 */
export default function LspPanel() {
  return <JsonConfigPanel path="lsp" titleKey="lsp.title" hintKey="lsp.hint" />;
}
