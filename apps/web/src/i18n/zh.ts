/**
 * 中文文案字典（唯一来源）。
 *
 * 约定：仅存放**用户可见**文案；代码标识符/协议字段不入表。
 * `{{name}}` 为占位符，由 `t()` 插值（见 `./index.ts`）。
 */
export const zh = {
  "app.name": "24H",

  "nav.chat": "对话",
  "nav.agents": "智能体",
  "nav.groups": "群聊",
  "nav.tasks": "任务",
  "nav.usage": "用量",
  "nav.settings": "设置",
  "nav.admin": "管理",
  "nav.account": "账户",
  "nav.notifications": "通知",

  "sidebar.aria": "主导航",
  "sidebar.brand": "24H",
  "sidebar.core": "核心",
  "sidebar.channel": "渠道",
  "sidebar.coreOnline": "核心在线",
  "sidebar.coreOffline": "核心离线",
  "sidebar.channelOnline": "渠道在线",
  "sidebar.channelOffline": "渠道离线",
  "sidebar.expand": "展开侧栏",
  "sidebar.collapse": "收起侧栏",
  "sidebar.theme.toggle": "切换主题",
  "sidebar.theme.light": "浅色",
  "sidebar.theme.dark": "深色",

  "shell.openDetails": "打开详情面板",
  "shell.closeDetails": "关闭详情面板",

  "details.aria": "详情面板",
  "details.tabsAria": "详情标签",
  "details.close": "收起详情面板",
  "details.tab.files": "文件",
  "details.tab.preview": "预览",
  "details.tab.logs": "日志",
  "details.tab.git": "Git",
  "details.empty": "暂无内容",

  "page.groups": "群聊",
  "page.account": "账户",
  "page.notifications": "通知",
  "page.placeholder": "该模块将在后续里程碑实现。",

  "settings.aria": "设置分区",
  "settings.section.keys": "模型与密钥",
  "settings.section.model": "模型设置",
  "settings.section.appearance": "外观",
  "settings.section.config": "配置中心",
  "settings.section.approvals": "审批策略",
  "settings.section.oauth": "服务商登录",
  "settings.section.github": "GitHub 集成",
  "settings.section.monitor": "监控",
  "settings.section.projects": "项目",
} as const;

export type TranslationKey = keyof typeof zh;
