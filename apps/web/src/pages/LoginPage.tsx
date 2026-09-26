import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSession } from "../auth/SessionProvider";

type Step = "login" | "change";

export default function LoginPage() {
  const { login, refresh } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<Step>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/chat";

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await login(username, password);
      if (user.must_change_password) {
        setOldPassword(password);
        setStep("change");
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const submitChange = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      await refresh();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改密码失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="brand-mark">24H</span>

        {step === "login" ? (
          <form onSubmit={submitLogin}>
            <h1>登录</h1>
            <div className="row">
              <label htmlFor="login-username">用户名</label>
              <input
                id="login-username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="row">
              <label htmlFor="login-password">密码</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className="err">{error}</p> : null}
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "登录中…" : "登录"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitChange}>
            <h1>修改密码</h1>
            <p className="muted">首次登录需要设置新密码。</p>
            <div className="row">
              <label htmlFor="change-old">当前密码</label>
              <input
                id="change-old"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
              />
            </div>
            <div className="row">
              <label htmlFor="change-new">新密码</label>
              <input
                id="change-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            {error ? <p className="err">{error}</p> : null}
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "提交中…" : "修改密码"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
