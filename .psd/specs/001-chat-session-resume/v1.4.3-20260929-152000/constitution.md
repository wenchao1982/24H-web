# Project Constitution (patch v1.4.3)

## Technology Constraints (GEARS Format)
- Where 需要判定一轮结束，The 客户端 shall 依据 `message.complete`（Hermes 无 `done` 事件）。
- Where 展示推理内容，The 实现 shall 与正式答复区分（`data-reasoning` + 标签），样式使用 `--ds-*` token，不引 UI 库。

## Process Rules
- 先以真机证据定位，再出补丁规格与代码。
- 提交前 `npm run check` 必须全绿。

## Boundaries
| 层级 | 规则 |
| --- | --- |
| ✅ Always Do | 本轮 `message.complete` 复位 running；思考内容标记化 |
| ❓ Ask First | 订阅 `reasoning.delta`；思考块折叠策略 |
| 🚫 Never Do | 依赖不存在的 `done` 复位；思考过程冒充正式答复 |
