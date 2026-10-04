import { useState } from "react";
import { Plus, Search, ShieldCheck, UserCog } from "lucide-react";
import { ADMIN_USERS } from "../mocks/data";
import { cn } from "../lib/cn";

const SECTIONS = [
  { id: "users", label: "用户与角色", icon: UserCog },
  { id: "audit", label: "审计", icon: ShieldCheck },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const AUDIT = [
  { at: "刚刚", actor: "admin", action: "分配 profile", target: "lisi → default", result: "成功" },
  { at: "10 分钟前", actor: "admin", action: "创建用户", target: "zhaoliu", result: "成功" },
  { at: "昨天", actor: "admin", action: "禁用用户", target: "wangwu", result: "成功" },
];

/** 管理（仅 super_admin）：用户与角色 / 审计 / 系统运维。 */
export function Admin() {
  const [section, setSection] = useState<SectionId>("users");
  const [query, setQuery] = useState("");
  const users = ADMIN_USERS.filter(
    (u) => u.username.includes(query) || u.displayName.includes(query),
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="w-[220px] shrink-0 border-r border-line-1 p-2">
        <h1 className="px-2 py-2 text-[14px] font-medium">管理</h1>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
              s.id === section ? "bg-accent-weak font-medium text-accent" : "text-label-2 hover:bg-s3",
            )}
          >
            <s.icon size={16} className={s.id === section ? "text-accent" : "text-label-3"} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="thin-scroll min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-[880px]">
          {section === "users" ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-[16px] font-semibold">用户与角色</h2>
                <span className="rounded-pill bg-s3 px-1.5 py-px text-[10px] text-label-3">
                  {ADMIN_USERS.length}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex h-8 items-center gap-2 rounded-md border border-line-1 bg-s1 px-2.5 text-label-3">
                    <Search size={14} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索用户"
                      className="h-full w-40 bg-transparent text-[12.5px] text-label-1 outline-none placeholder:text-label-3"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong"
                  >
                    <Plus size={14} /> 新建用户
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-line-1">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line-1 bg-s2 text-label-3">
                      <th className="px-3 py-2 text-left font-medium">用户</th>
                      <th className="px-3 py-2 text-left font-medium">角色</th>
                      <th className="px-3 py-2 text-left font-medium">状态</th>
                      <th className="px-3 py-2 text-left font-medium">Profile</th>
                      <th className="px-3 py-2 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-line-1 last:border-0 hover:bg-s2">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-s3 text-[11px] font-semibold text-label-2">
                              {u.displayName.slice(0, 1)}
                            </span>
                            <span className="flex flex-col">
                              <span className="text-label-1">{u.displayName}</span>
                              <span className="font-mono text-[11px] text-label-3">@{u.username}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "rounded-pill px-2 py-0.5 text-[11px] font-medium",
                              u.role === "super_admin"
                                ? "bg-accent-weak text-accent"
                                : "bg-s3 text-label-2",
                            )}
                          >
                            {u.role === "super_admin" ? "超级管理员" : "管理员"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={u.status === "active" ? "text-success" : "text-label-3"}>
                            {u.status === "active" ? "启用" : "禁用"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-label-2">
                          {u.profiles.length ? u.profiles.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" className="text-[12px] text-label-2 hover:text-accent">
                            编辑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : section === "audit" ? (
            <>
              <h2 className="mb-4 text-[16px] font-semibold">审计</h2>
              <div className="flex flex-col gap-1.5">
                {AUDIT.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-md border border-line-1 bg-s1 px-3 py-2.5 text-[12.5px]"
                  >
                    <span className="w-20 shrink-0 text-label-3">{a.at}</span>
                    <span className="w-16 shrink-0 font-mono text-label-2">{a.actor}</span>
                    <span className="text-label-1">{a.action}</span>
                    <span className="truncate text-label-3">{a.target}</span>
                    <span className="ml-auto text-success">{a.result}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-4 text-[16px] font-semibold">系统运维</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "核心版本", value: "v0.21.3", hint: "最新" },
                  { label: "数据库", value: "healthy", hint: "正常" },
                  { label: "队列", value: "0", hint: "无积压" },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg border border-line-1 bg-s1 p-3.5">
                    <p className="text-[11px] text-label-3">{c.label}</p>
                    <p className="mt-1.5 text-[16px] font-semibold">{c.value}</p>
                    <p className="mt-0.5 text-[11px] text-success">{c.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" className="h-8 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-strong">
                  检查升级
                </button>
                <button type="button" className="h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2">
                  下载备份
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
