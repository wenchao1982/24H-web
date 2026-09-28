import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { ConfirmDialog } from "../ui";
import { useToast } from "../ui/Toast";

interface AdminUser {
  id: number;
  username: string;
  role: "super_admin" | "admin";
  status: "active" | "disabled";
  profiles: string[];
  default_profile: string | null;
  must_change_password: number;
}

type NewRole = "admin" | "super_admin";

export default function AdminUsersPage() {
  const { show } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<NewRole>("admin");
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<AdminUser[]>("/api/admin/users");
      setUsers(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载用户失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>, ok?: string) => {
      try {
        await action();
        if (ok) {
          show(ok);
        }
        await load();
      } catch (err) {
        show(err instanceof Error ? err.message : "操作失败", "error");
      }
    },
    [load, show],
  );

  const create = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ username, password, role }),
      });
      setUsername("");
      setPassword("");
      setRole("admin");
    }, "用户已创建");
  };

  const changeRole = (user: AdminUser, next: NewRole) => {
    void run(
      () =>
        api(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ role: next }),
        }),
      "角色已更新",
    );
  };

  const toggleStatus = (user: AdminUser) => {
    const status = user.status === "active" ? "disabled" : "active";
    void run(
      () =>
        api(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      "状态已更新",
    );
  };

  const assignProfiles = (user: AdminUser) => {
    const input = window.prompt("分配 profile（逗号分隔）", user.profiles.join(", "));
    if (input === null) {
      return;
    }
    const profiles = input
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
    void run(
      () =>
        api(`/api/admin/users/${user.id}/profiles`, {
          method: "PUT",
          body: JSON.stringify({ profiles }),
        }),
      "profile 已分配",
    );
  };

  const resetPassword = (user: AdminUser) => {
    const next = window.prompt(`为 ${user.username} 设置新密码（至少 8 位）`);
    if (!next) {
      return;
    }
    void run(
      () =>
        api(`/api/admin/users/${user.id}/password`, {
          method: "POST",
          body: JSON.stringify({ password: next }),
        }),
      "密码已重置",
    );
  };

  const confirmRemove = () => {
    const user = pendingDelete;
    setPendingDelete(null);
    if (!user) {
      return;
    }
    void run(
      () => api(`/api/admin/users/${user.id}`, { method: "DELETE" }),
      "用户已删除",
    );
  };

  return (
    <div className="page">
      <div className="card">
        <h3>新建用户</h3>
        <form onSubmit={create}>
          <div className="row">
            <input
              aria-label="新用户名"
              placeholder="用户名"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <input
              aria-label="新密码"
              type="password"
              placeholder="初始密码（至少 8 位）"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <select
              aria-label="新角色"
              value={role}
              onChange={(event) => setRole(event.target.value as NewRole)}
            >
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </select>
            <button className="primary" type="submit">
              创建
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>用户列表</h3>
        {error ? <p className="err">{error}</p> : null}
        {loading ? <p className="empty">加载中…</p> : null}
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>角色</th>
              <th>状态</th>
              <th>Profiles</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>
                  <select
                    aria-label={`角色 ${user.username}`}
                    value={user.role}
                    onChange={(event) => changeRole(user, event.target.value as NewRole)}
                  >
                    <option value="admin">admin</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                </td>
                <td>{user.status === "active" ? "启用" : "禁用"}</td>
                <td>{user.profiles.join("、") || "—"}</td>
                <td className="row-actions">
                  <button type="button" onClick={() => toggleStatus(user)}>
                    {user.status === "active" ? "禁用" : "启用"}
                  </button>
                  <button type="button" onClick={() => assignProfiles(user)}>
                    分配
                  </button>
                  <button type="button" onClick={() => resetPassword(user)}>
                    重置密码
                  </button>
                  <button type="button" className="danger" onClick={() => setPendingDelete(user)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 ? <p className="empty">暂无用户。</p> : null}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        message={pendingDelete ? `确认删除用户 ${pendingDelete.username}？` : ""}
        confirmLabel="确认删除"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
