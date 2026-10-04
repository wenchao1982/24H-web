import { useState, type FormEvent } from "react";
import { Logo } from "../components/Logo";

/** 登录页（Demo）：居中卡片 + 首登改密提示。 */
export function Login() {
  const [busy, setBusy] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
  };

  return (
    <div className="flex h-full items-center justify-center bg-s2 px-6">
      <div className="w-full max-w-[360px]">
        <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
          <Logo size={36} />
          <h1 className="text-[19px] font-semibold tracking-tight">登录 24H 工作台</h1>
          <p className="text-[12px] text-label-3">企业多用户 · Hermes 智能工作台</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-lg border border-line-1 bg-s1 p-6 shadow-[0_8px_24px_rgb(15_17_21_/_8%)]"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-label-2">用户名</span>
            <input
              name="username"
              autoComplete="username"
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none transition-colors focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-label-2">密码</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="h-9 rounded-md border border-line-1 bg-s1 px-3 text-[13px] outline-none transition-colors focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex h-9 items-center justify-center rounded-md bg-accent text-[13px] font-medium text-white transition-colors hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60"
          >
            {busy ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-label-3">
          首次登录将要求修改初始密码
        </p>
      </div>
    </div>
  );
}
