import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSession } from "../auth/SessionProvider";
import { Button, Field, Input, Stack } from "../ui";

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
            <Stack gap={12}>
              <h1>登录</h1>
              <Field label="用户名" htmlFor="login-username">
                <Input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </Field>
              <Field label="密码" htmlFor="login-password">
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              {error ? <p className="err">{error}</p> : null}
              <Button variant="primary" block type="submit" disabled={busy}>
                {busy ? "登录中…" : "登录"}
              </Button>
            </Stack>
          </form>
        ) : (
          <form onSubmit={submitChange}>
            <Stack gap={12}>
              <h1>修改密码</h1>
              <p className="muted">首次登录需要设置新密码。</p>
              <Field label="当前密码" htmlFor="change-old">
                <Input
                  id="change-old"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                />
              </Field>
              <Field label="新密码" htmlFor="change-new">
                <Input
                  id="change-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              {error ? <p className="err">{error}</p> : null}
              <Button variant="primary" block type="submit" disabled={busy}>
                {busy ? "提交中…" : "修改密码"}
              </Button>
            </Stack>
          </form>
        )}
      </div>
    </div>
  );
}
