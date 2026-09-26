import { useState, type FormEvent } from "react";

export type ImportProfileParams = {
  archive: string;
  name?: string;
};

export interface AgentImportPanelProps {
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (params: ImportProfileParams) => void;
}

/** 导入智能体：归档路径 + 可选名称（`POST /api/profiles/import`，需确认）。 */
export default function AgentImportPanel({
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AgentImportPanelProps) {
  const [archive, setArchive] = useState("");
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !archive.trim() || !confirmed) {
      return;
    }
    const params: ImportProfileParams = { archive: archive.trim() };
    if (name.trim()) {
      params.name = name.trim();
    }
    onSubmit(params);
  };

  return (
    <form className="card agent-import" onSubmit={submit}>
      <h3>导入智能体</h3>
      <div className="row">
        <input
          aria-label="导入归档路径"
          placeholder="归档文件路径"
          value={archive}
          onChange={(event) => setArchive(event.target.value)}
        />
        <input
          aria-label="导入名称"
          placeholder="新名称（可选）"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <label className="agent-import-confirm">
        <input
          type="checkbox"
          aria-label="确认导入"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>确认导入（可能覆盖同名档案）</span>
      </label>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <button className="primary" type="submit" disabled={busy || !archive.trim() || !confirmed}>
          {busy ? "导入中…" : "执行导入"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
