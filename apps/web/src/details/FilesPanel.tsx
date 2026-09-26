import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeFileContent, normalizeFileList, type FileEntry } from "./files";

export interface FilesPanelProps {
  /** 打开文件时通知宿主（供预览面板复用）。 */
  onSelect?: (path: string) => void;
}

/** 详情面板 → 文件：工作区文件浏览 / 读取（M7 / T11.1）。 */
export default function FilesPanel({ onSelect }: FilesPanelProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [contentError, setContentError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(normalizeFileList(await api<unknown>("/api/hermes/files")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文件列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (entry: FileEntry) => {
    if (entry.isDir) {
      return;
    }
    onSelect?.(entry.path);
    setOpenPath(entry.path);
    setContentError(null);
    try {
      const payload = await api<unknown>(
        `/api/hermes/files/read?path=${encodeURIComponent(entry.path)}`,
      );
      setContent(normalizeFileContent(payload));
    } catch (err) {
      setContent("");
      setContentError(err instanceof Error ? err.message : "读取文件失败");
    }
  };

  if (loading) {
    return <p className="empty">加载文件中…</p>;
  }

  if (error) {
    return (
      <p className="err" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="details-files">
      {entries.length === 0 ? (
        <p className="empty">暂无文件。</p>
      ) : (
        <ul className="file-list">
          {entries.map((entry) => (
            <li key={entry.path}>
              <button
                type="button"
                className="file-entry"
                aria-current={openPath === entry.path ? "true" : undefined}
                onClick={() => void open(entry)}
              >
                <span aria-hidden="true">{entry.isDir ? "▸" : "·"}</span> {entry.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {openPath ? (
        <div className="file-content">
          <h4>{openPath}</h4>
          {contentError ? (
            <p className="err" role="alert">
              {contentError}
            </p>
          ) : (
            <pre>{content}</pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
