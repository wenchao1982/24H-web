import { useState, type ReactNode } from "react";
import { Check, Globe, KeyRound, Mic, Palette, Plug, Plus, Radio, Type, Volume2 } from "lucide-react";
import { MODELS, SETTINGS_SECTIONS } from "../mocks/data";
import { cn } from "../lib/cn";

export interface SettingsProps {
  theme: "light" | "dark";
  onTheme: (theme: "light" | "dark") => void;
}

const LANGUAGES = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
];

const CHANNELS = [
  { id: "telegram", name: "Telegram", status: "已连接", detail: "@24h_bot" },
  { id: "whatsapp", name: "WhatsApp", status: "未连接", detail: "扫码登录" },
  { id: "slack", name: "Slack", status: "未连接", detail: "OAuth App" },
  { id: "discord", name: "Discord", status: "已连接", detail: "24H 服务器" },
];

const INTEGRATIONS = [
  { id: "github", name: "GitHub", status: "已连接", detail: "gh auth 正常" },
  { id: "webhooks", name: "Webhooks", status: "2 个", detail: "on_turn_complete / on_error" },
  { id: "plugins", name: "插件", status: "3 个", detail: "browser-helper / sql-tools / notifier" },
  { id: "catalog", name: "Plugin Catalog", status: "可浏览", detail: "发现与安装插件" },
];

/* 连接器独立于密钥库（C03）：仅展示外部连接的授权状态。 */
const CONNECTORS = [
  { id: "github", name: "GitHub", status: "已连接", detail: "repo / pull_request 授权" },
  { id: "slack", name: "Slack", status: "未连接", detail: "OAuth App" },
  { id: "filesystem", name: "Filesystem MCP", status: "已连接", detail: "stdio · 12 个工具" },
];

const MODULE_DETAIL: Record<string, { name: string; api: string }[]> = {
  data: [
    { name: "工作区目录", api: "GET/PUT /api/config（dirs）" },
    { name: "会话导入 / 导出", api: "POST /api/sessions/import|export" },
    { name: "文件管理", api: "GET /api/files · POST /api/files/mkdir" },
  ],
  connections: [
    { name: "Hermes 实例注册", api: "GET/POST/PATCH/DELETE /api/admin/connections" },
    { name: "实例探活", api: "GET /api/status · /api/health" },
  ],
  system: [
    { name: "版本与升级", api: "GET /api/system/version · POST /api/system/update" },
    { name: "系统运维（doctor / backup / import）", api: "/api/ops/*" },
    { name: "审批策略", api: "approvals.mode（/api/config）" },
  ],
  advanced: [
    { name: "API Server", api: "/api/config（api_server）" },
    { name: "Event Hooks", api: "/api/config（hooks）" },
    { name: "Tool Gateway", api: "/api/config" },
    { name: "Tool Search", api: "/api/config（tool_search）" },
    { name: "LSP", api: "/api/config（lsp）" },
    { name: "Computer Use", api: "GET /api/tools/computer-use/status" },
    { name: "Subscription Proxy", api: "/api/config（subscription）" },
    { name: "Codex Runtime", api: "/api/config" },
    { name: "本地模型", api: "/api/local-models/*" },
    { name: "配对 / SSH", api: "GET /api/pairing · /api/ssh/ownership" },
  ],
};

/** 设置：左分区列表 + 右分区详情（对接 Hermes 功能模块）。 */
export function Settings({ theme, onTheme }: SettingsProps) {
  const [sectionId, setSectionId] = useState("general");
  const [language, setLanguage] = useState("zh");
  const [customModels, setCustomModels] = useState<{ provider: string; id: string }[]>([
    { provider: "openai-compatible", id: "my-local-qwen" },
  ]);
  const [newProvider, setNewProvider] = useState("");
  const [newModel, setNewModel] = useState("");
  const [stt, setStt] = useState("whisper");
  const [tts, setTts] = useState("elevenlabs");
  const [autoRead, setAutoRead] = useState(false);
  const [wake, setWake] = useState(false);
  const section = SETTINGS_SECTIONS.find((s) => s.id === sectionId) ?? SETTINGS_SECTIONS[0];
  const addCustom = () => {
    if (!newProvider.trim() || !newModel.trim()) return;
    setCustomModels((list) => [...list, { provider: newProvider.trim(), id: newModel.trim() }]);
    setNewProvider("");
    setNewModel("");
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="thin-scroll w-[220px] shrink-0 overflow-y-auto border-r border-line-1 p-2">
        <h1 className="px-2 py-2 text-[14px] font-medium">设置</h1>
        {SETTINGS_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSectionId(s.id)}
            className={cn(
              "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
              s.id === sectionId ? "bg-accent-weak" : "hover:bg-s3",
            )}
          >
            <span className={cn("text-[13px]", s.id === sectionId ? "font-medium text-accent" : "text-label-1")}>
              {s.label}
            </span>
            <span className="text-[11px] text-label-3">{s.description}</span>
          </button>
        ))}
      </div>

      <div className="thin-scroll min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[680px]">
          <h2 className="text-[16px] font-semibold">{section.label}</h2>
          <p className="mt-1 text-[12.5px] text-label-3">{section.description}</p>

          {sectionId === "general" ? (
            <div className="mt-5 flex flex-col gap-4">
              <Group icon={Palette} title="外观">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTheme(t)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px]",
                      theme === t ? "border-accent/40 bg-accent-weak font-medium text-accent" : "border-line-1 text-label-2 hover:bg-s2",
                    )}
                  >
                    {theme === t ? <Check size={13} /> : null}
                    {t === "light" ? "浅色" : "深色"}
                  </button>
                ))}
                <span className="text-[12px] text-label-3">跟随系统</span>
              </Group>
              <Group icon={Type} title="字号">
                <input type="range" min={12} max={17} defaultValue={14} className="w-56 accent-[var(--ds-accent)]" />
                <span className="ml-2 text-[12px] text-label-3">14px（12–17）</span>
              </Group>
              <Group icon={Globe} title="语言 / Language">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px]",
                      language === l.id ? "border-accent/40 bg-accent-weak font-medium text-accent" : "border-line-1 text-label-2 hover:bg-s2",
                    )}
                  >
                    {language === l.id ? <Check size={13} /> : null}
                    {l.label}
                  </button>
                ))}
              </Group>
            </div>
          ) : sectionId === "model" ? (
            <div className="mt-5 flex flex-col gap-4">
              <Group icon={KeyRound} title="主流模型">
                <div className="flex w-full flex-col gap-1.5">
                  {MODELS.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2",
                        m.id === "deepseek-flash" ? "border-accent/40 bg-accent-weak" : "border-line-1 bg-s1",
                      )}
                    >
                      <span className="flex-1">
                        <span className="block text-[13px] text-label-1">{m.label}</span>
                        <span className="block font-mono text-[11px] text-label-3">{m.provider} / {m.id}</span>
                      </span>
                      {m.badge ? <span className="rounded-[4px] bg-s3 px-1.5 font-mono text-[10px] text-label-3">{m.badge}</span> : null}
                      {m.id === "deepseek-flash" ? <Check size={15} className="text-accent" /> : null}
                    </div>
                  ))}
                </div>
              </Group>

              <Group icon={KeyRound} title="自定义模型">
                <div className="flex w-full flex-col gap-1.5">
                  {customModels.map((m) => (
                    <div key={`${m.provider}/${m.id}`} className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3 py-2">
                      <span className="font-mono text-[12px] text-label-2">{m.provider}</span>
                      <span className="flex-1 font-mono text-[12.5px] text-label-1">{m.id}</span>
                      <span className="text-[11px] text-label-3">OpenAI 兼容</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input value={newProvider} onChange={(e) => setNewProvider(e.target.value)} placeholder="provider" className="h-8 w-40 rounded-md border border-line-1 bg-s1 px-2.5 font-mono text-[12px] outline-none focus:border-accent/50" />
                    <input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="model id" className="h-8 flex-1 rounded-md border border-line-1 bg-s1 px-2.5 font-mono text-[12px] outline-none focus:border-accent/50" />
                    <button type="button" onClick={addCustom} className="inline-flex h-8 items-center gap-1 rounded-md border border-line-1 px-3 text-[12px] text-label-2 hover:bg-s2">
                      <Plus size={13} /> 添加
                    </button>
                  </div>
                </div>
              </Group>

              <Group icon={KeyRound} title="API 密钥">
                <div className="flex w-full flex-col gap-1.5">
                  {MODELS.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3 py-2">
                      <span className="flex-1 font-mono text-[12px] text-label-2">{m.provider}</span>
                      <span className="font-mono text-[12px] text-label-3">sk-••••••••••</span>
                      <span className="text-[11px] text-success">已配置</span>
                    </div>
                  ))}
                </div>
              </Group>

              <ModuleList
                title="路由 / 回退 / 凭证池"
                items={[
                  { name: "主模型与辅助模型", api: "GET /api/model/info|options|auxiliary" },
                  { name: "MoA（混合代理）", api: "GET/PUT /api/model/moa" },
                  { name: "provider 路由", api: "/api/config（provider_routing）" },
                  { name: "回退链", api: "/api/config（fallback）" },
                  { name: "凭证池", api: "/api/config（credential_pools）" },
                  { name: "Provider OAuth", api: "GET/POST/DELETE /api/providers/oauth/*" },
                ]}
              />
            </div>
          ) : sectionId === "channels" ? (
            <div className="mt-5 flex flex-col gap-4">
              <Group icon={Globe} title="消息平台">
                <div className="flex w-full flex-col gap-1.5">
                  {CHANNELS.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3 py-2">
                      <span className="flex-1">
                        <span className="block text-[13px] text-label-1">{c.name}</span>
                        <span className="block text-[11px] text-label-3">{c.detail}</span>
                      </span>
                      <span className={cn("text-[11px]", c.status === "已连接" ? "text-success" : "text-label-3")}>{c.status}</span>
                      <button type="button" className="h-7 rounded-md border border-line-1 px-2.5 text-[12px] text-label-2 hover:bg-s2">
                        {c.status === "已连接" ? "断开" : "连接"}
                      </button>
                    </div>
                  ))}
                </div>
              </Group>
              <ModuleList
                title="交付方式"
                items={[
                  { name: "Deliverable 模式", api: "/api/config（deliverable）" },
                  { name: "投递目标", api: "/api/cron/delivery-targets" },
                  { name: "平台 onboarding", api: "POST /api/messaging/{telegram,whatsapp}/onboarding/*" },
                ]}
              />
            </div>
          ) : sectionId === "voice" ? (
            <div className="mt-5 flex flex-col gap-4">
              <Group icon={Mic} title="语音识别（STT）">
                {[
                  { id: "whisper", label: "Whisper" },
                  { id: "browser", label: "浏览器内置" },
                  { id: "off", label: "关闭" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setStt(p.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px]",
                      stt === p.id ? "border-accent/40 bg-accent-weak font-medium text-accent" : "border-line-1 text-label-2 hover:bg-s2",
                    )}
                  >
                    {stt === p.id ? <Check size={13} /> : null}
                    {p.label}
                  </button>
                ))}
                <span className="w-full text-[11.5px] text-label-3">
                  按住输入区麦克风说话（按住说话），转写结果直接落入草稿。
                </span>
              </Group>
              <Group icon={Volume2} title="语音合成（TTS）">
                {[
                  { id: "elevenlabs", label: "ElevenLabs" },
                  { id: "system", label: "系统语音" },
                  { id: "off", label: "关闭" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTts(p.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px]",
                      tts === p.id ? "border-accent/40 bg-accent-weak font-medium text-accent" : "border-line-1 text-label-2 hover:bg-s2",
                    )}
                  >
                    {tts === p.id ? <Check size={13} /> : null}
                    {p.label}
                  </button>
                ))}
                <label className="flex w-full items-center justify-between pt-1">
                  <span className="text-[12.5px] text-label-2">自动朗读助手回复</span>
                  <Toggle on={autoRead} onChange={setAutoRead} />
                </label>
              </Group>
              <Group icon={Radio} title="唤醒词">
                <label className="flex w-full items-center justify-between">
                  <span className="text-[12.5px] text-label-2">
                    常驻监听唤醒词 <span className="text-label-3">（默认关）</span>
                  </span>
                  <Toggle on={wake} onChange={setWake} />
                </label>
                <span className="w-full text-[11.5px] text-label-3">
                  开启后本地常驻监听「嘿 24H」；打断可中止聆听与朗读。
                </span>
              </Group>
            </div>
          ) : sectionId === "integrations" ? (
            <div className="mt-5 flex flex-col gap-4">
              <Group icon={Plug} title="连接器">
                <div className="flex w-full flex-col gap-1.5">
                  {CONNECTORS.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3 py-2">
                      <span className="flex-1">
                        <span className="block text-[13px] text-label-1">{c.name}</span>
                        <span className="block text-[11px] text-label-3">{c.detail}</span>
                      </span>
                      <span className={cn("text-[11px]", c.status === "已连接" ? "text-success" : "text-label-3")}>{c.status}</span>
                    </div>
                  ))}
                  <p className="text-[11.5px] text-label-3">
                    连接器独立于密钥库：仅管理外部连接授权，不存放密钥。
                  </p>
                </div>
              </Group>
              <Group icon={Globe} title="集成">
                <div className="flex w-full flex-col gap-1.5">
                  {INTEGRATIONS.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3 py-2">
                      <span className="flex-1">
                        <span className="block text-[13px] text-label-1">{i.name}</span>
                        <span className="block text-[11px] text-label-3">{i.detail}</span>
                      </span>
                      <span className="text-[11px] text-label-2">{i.status}</span>
                    </div>
                  ))}
                </div>
              </Group>
              <ModuleList
                title="接口"
                items={[
                  { name: "GitHub", api: "/api/integrations/github" },
                  { name: "Webhooks", api: "GET/POST /api/webhooks · PUT/DELETE /api/webhooks/:name" },
                  { name: "插件", api: "plugins.manage · plugins.compat_report" },
                  { name: "Plugin Catalog", api: "POST /api/mcp/catalog/install（catalog）" },
                ]}
              />
            </div>
          ) : (
            <ModuleList title="对接模块（Hermes 接口）" items={MODULE_DETAIL[sectionId] ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ icon: Icon, title, children }: { icon: typeof Palette; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line-1 bg-s1 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[13px] font-medium">
        <Icon size={14} className="text-label-3" /> {title}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex h-5 w-9 shrink-0 items-center rounded-pill px-0.5 transition-colors",
        on ? "justify-end bg-accent" : "bg-s3",
      )}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow" />
    </button>
  );
}

function ModuleList({ title, items }: { title: string; items: { name: string; api: string }[] }) {
  return (
    <section>
      <p className="mb-2 text-[12px] font-medium text-label-3">{title}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((m) => (
          <div key={m.name} className="rounded-md border border-line-1 bg-s1 px-3.5 py-2.5">
            <p className="text-[13px] text-label-1">{m.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-label-3">{m.api}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
