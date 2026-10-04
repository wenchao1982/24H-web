import { Shield, User } from "lucide-react";

/** 账户：自助资料与改密。 */
export function Account() {
  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[560px] px-6 py-6">
        <h1 className="text-[18px] font-semibold">账户</h1>
        <p className="mt-1 text-[12.5px] text-label-3">管理你的显示资料与登录口令。</p>

        <section className="mt-5 flex items-center gap-4 rounded-lg border border-line-1 bg-s1 p-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-weak text-[22px] font-semibold text-accent">
            管
          </span>
          <div>
            <p className="text-[15px] font-semibold">系统管理员</p>
            <p className="font-mono text-[12px] text-label-3">@admin</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-accent-weak px-2 py-0.5 text-[11px] font-medium text-accent">
              <Shield size={11} /> 超级管理员
            </span>
          </div>
          <button
            type="button"
            className="ml-auto h-8 rounded-md border border-line-1 px-3 text-[12.5px] text-label-2 hover:bg-s2"
          >
            更换头像
          </button>
        </section>

        <section className="mt-4 flex flex-col gap-4 rounded-lg border border-line-1 bg-s1 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <User size={14} className="text-label-3" /> 资料
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">显示名</span>
            <input
              defaultValue="系统管理员"
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-label-2">用户名</span>
            <input
              defaultValue="admin"
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 font-mono text-[13px] outline-none focus:border-accent/50"
            />
          </label>
        </section>

        <section className="mt-4 flex flex-col gap-4 rounded-lg border border-line-1 bg-s1 p-4">
          <p className="text-[13px] font-medium">修改密码</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-label-2">当前密码</span>
              <input type="password" className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-label-2">新密码</span>
              <input type="password" className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none focus:border-accent/50" />
            </label>
          </div>
          <p className="text-[11px] text-label-3">口令使用 argon2id 存储；首次登录须修改初始密码。</p>
        </section>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="h-9 rounded-md border border-line-1 px-4 text-[13px] text-label-2 hover:bg-s2">
            取消
          </button>
          <button type="button" className="h-9 rounded-md bg-accent px-4 text-[13px] font-medium text-white hover:bg-accent-strong">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
