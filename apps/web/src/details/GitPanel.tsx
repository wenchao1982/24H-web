import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeGitDiff, normalizeGitStatus, type GitStatus } from "./git";

const EMPTY: GitStatus = { branch: "", clean: true, changes: [] };

/** 详情面板 → Git：状态 / 差异（M7 / T11.4）。 */
export default function GitPanel() {
  const [status, setStatus] = useState<GitStatus>(EMPTY);
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusPayload, diffPayload] = await Promise.all([
        api<unknown>("/api/hermes/git/status"),
        api<unknown>("/api/hermes/git/diff"),
      ]);
      setStatus(normalizeGitStatus(statusPayload));
      setDiff(normalizeGitDiff(diffPayload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 Git 状态失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">加载 Git 状态中…</p>;
  }

  if (error) {
    return (
      <p className="err" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="details-git">
      <p className="muted" aria-label="Git 分支">
        {status.branch ? `分支：${status.branch}` : "分支：—"}
      </p>
      <p className="muted" aria-label="Git 状态">
        {status.clean ? "工作区干净" : `${status.changes.length} 个变更`}
      </p>

      {status.changes.length > 0 ? (
        <ul className="git-status">
          {status.changes.map((change) => (
            <li key={change.path}>
              <span className="git-code">{change.status || "·"}</span>
              <span>{change.path}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {diff ? (
        <div className="git-diff">
          <h4>差异</h4>
          <pre className="log-view" aria-label="Git 差异">
            {diff}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
