import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useSession } from "../auth/SessionProvider";
import { t } from "../i18n";

const MAX_AVATAR_BYTES = 256 * 1024;

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
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarNote, setAvatarNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api<{ data: string | null }>("/api/auth/avatar")
      .then((payload) => {
        if (alive) {
          setAvatar(payload.data);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

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

  const onPickAvatar = (file: File | undefined) => {
    setAvatarNote(null);
    if (!file) {
      return;
    }
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setError("仅支持 PNG/JPEG 头像");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("头像不能超过 256KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      void (async () => {
        try {
          await api("/api/auth/avatar", {
            method: "PUT",
            body: JSON.stringify({ data }),
          });
          setAvatar(data);
          setError(null);
          setAvatarNote(t("account.avatarSaved"));
        } catch (err) {
          setError(err instanceof Error ? err.message : "头像保存失败");
        }
      })();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page account-page">
      <h2 className="page-title">{t("page.account")}</h2>
      <p className="muted">{t("account.hint")}</p>

      <section className="card">
        <h3>{t("account.avatar")}</h3>
        <div className="account-avatar">
          {avatar ? (
            <img src={avatar} alt={user.username} width={56} height={56} />
          ) : (
            <span className="account-avatar-fallback">{user.username.slice(0, 1).toUpperCase()}</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            aria-label={t("account.avatar")}
            onChange={(event) => onPickAvatar(event.target.files?.[0])}
          />
        </div>
        {avatarNote ? <p className="ok">{avatarNote}</p> : null}
      </section>

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
