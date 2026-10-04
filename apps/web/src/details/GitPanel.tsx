import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import {
  normalizeGitDiff,
  normalizeGitStatus,
  normalizeShipInfo,
  type GitStatus,
  type ShipInfo,
} from "./git";

const EMPTY: GitStatus = { branch: "", clean: true, changes: [] };

/** 详情面板 → Git：状态 / 差异 / 评审（stage·commit·push·PR）（M7 / T11.4 / C06）。 */
export default function GitPanel() {
  const [status, setStatus] = useState<GitStatus>(EMPTY);
  const [diff, setDiff] = useState("");
  const [review, setReview] = useState<GitStatus>(EMPTY);
  const [ship, setShip] = useState<ShipInfo | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusPayload, diffPayload, reviewPayload, shipPayload] = await Promise.all([
        api<unknown>("/api/hermes/git/status"),
        api<unknown>("/api/hermes/git/diff"),
        api<unknown>("/api/hermes/git/review/list").catch(() => null),
        api<unknown>("/api/hermes/git/review/ship-info").catch(() => null),
      ]);
      setStatus(normalizeGitStatus(statusPayload));
      setDiff(normalizeGitDiff(diffPayload));
      setReview(reviewPayload ? normalizeGitStatus(reviewPayload) : EMPTY);
      setShip(shipPayload ? normalizeShipInfo(shipPayload) : null);
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

  const action = async (path: string, body?: Record<string, unknown>, label?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/hermes${path}`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      });
      await load();
      if (label) {
        setNote(label);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const stage = (path: string) => action("/git/review/stage", { files: [path] });
  const unstage = (path: string) => action("/git/review/unstage", { files: [path] });
  const revert = (path: string) => action("/git/review/revert", { files: [path] });
  const push = () => action("/git/review/push", {}, "已推送");
  const createPr = () => action("/git/review/create-pr", {});
  const shipCommit = () =>
    message.trim() === ""
      ? undefined
      : action("/git/review/commit", { message: message.trim() }, "已提交").then(() =>
          setMessage(""),
        );

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

      <div className="git-review">
        <h4>评审 / 发布</h4>
        {ship ? (
          <p className="muted" aria-label="发布信息">
            {ship.branch ? `分支 ${ship.branch}` : "分支 —"}
            {ship.base ? ` → ${ship.base}` : ""}
            {ship.ahead !== null ? ` · 领先 ${ship.ahead}` : ""}
            {ship.behind !== null ? ` · 落后 ${ship.behind}` : ""}
          </p>
        ) : null}
        {review.changes.length > 0 ? (
          <ul className="git-status">
            {review.changes.map((change) => (
              <li key={change.path}>
                <span className="git-code">{change.status || "·"}</span>
                <span>{change.path}</span>
                <span className="row-actions">
                  <button type="button" disabled={busy} onClick={() => void stage(change.path)}>
                    暂存
                  </button>
                  <button type="button" disabled={busy} onClick={() => void unstage(change.path)}>
                    取消
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => void revert(change.path)}
                  >
                    还原
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">暂无评审变更。</p>
        )}
        <textarea
          aria-label="提交信息"
          rows={2}
          placeholder="提交信息"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="row-actions">
          <button type="button" className="primary" disabled={busy || message.trim() === ""} onClick={() => void shipCommit()}>
            提交
          </button>
          <button type="button" disabled={busy} onClick={() => void push()}>
            推送
          </button>
          <button type="button" disabled={busy} onClick={() => void createPr()}>
            创建 PR
          </button>
        </div>
        {note ? <p className="muted">{note}</p> : null}
      </div>
    </div>
  );
}
