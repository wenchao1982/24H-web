import { useState } from "react";
import { api } from "../api/client";
import { useSession } from "../auth/SessionProvider";
import { t } from "../i18n";

/** 独立页：账户——自助资料（只读）+ 改用户名 + 改密。 */
export default function AccountPage() {
  const { user, refresh } = useSession();
  const [username, setUsername] = useState(user?.username ?? "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [pwNote, setPwNote] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="page account-page">
        <h2 className="page-title">{t("page.account")}</h2>
        <p className="empty">{t("common.loading")}</p>
      </div>
    );
  }

  const role = user.role === "super_admin" ? t("account.roleSuperAdmin") : t("account.roleAdmin");
  const profiles = user.profiles ?? [];

  const saveUsername = async () => {
    setBusy(true);
    setError(null);
    setSavedNote(null);
    try {
      await api("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ username: username.trim() }),
      });
      await refresh();
      setSavedNote(t("account.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setError(null);
    setPwNote(null);
    if (newPassword.length < 8) {
      setError(t("account.passwordWeak"));
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setOldPassword("");
      setNewPassword("");
      setPwNote(t("account.passwordChanged"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page account-page">
      <h2 className="page-title">{t("page.account")}</h2>
      <p className="muted">{t("account.hint")}</p>

      <section className="card">
        <dl className="account-facts">
          <div>
            <dt>{t("account.role")}</dt>
            <dd>{role}</dd>
          </div>
          <div>
            <dt>{t("account.profiles")}</dt>
            <dd>{profiles.length > 0 ? profiles.join(", ") : t("account.none")}</dd>
          </div>
          <div>
            <dt>{t("account.defaultProfile")}</dt>
            <dd>{user.default_profile ?? t("account.none")}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h3>{t("account.rename")}</h3>
        <div className="row">
          <input
            aria-label={t("account.username")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || username.trim() === ""}
            onClick={() => void saveUsername()}
          >
            {t("account.save")}
          </button>
        </div>
        <p className="muted">{t("account.renameHint")}</p>
        {savedNote ? <p className="ok">{savedNote}</p> : null}
      </section>

      <section className="card">
        <h3>{t("account.changePassword")}</h3>
        <div className="row">
          <input
            type="password"
            aria-label={t("account.oldPassword")}
            placeholder={t("account.oldPassword")}
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
          />
          <input
            type="password"
            aria-label={t("account.newPassword")}
            placeholder={t("account.newPassword")}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || oldPassword === "" || newPassword === ""}
            onClick={() => void changePassword()}
          >
            {t("account.save")}
          </button>
        </div>
        {pwNote ? <p className="ok">{pwNote}</p> : null}
      </section>

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
