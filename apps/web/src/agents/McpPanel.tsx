import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { withProfile } from "./agents";
import { normalizeMcpServers, type McpServerEntry } from "./mcp";
import { Button, EmptyState } from "../ui";

export interface McpPanelProps {
  /** 作用到该 profile（省略则为全局默认 profile）。 */
  profile?: string;
}

/** 智能体页「MCP」面板：列表/增删/启停 + 目录安装。 */
export default function McpPanel({ profile }: McpPanelProps) {
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<unknown>(withProfile("/api/hermes/mcp/servers", profile));
      setServers(normalizeMcpServers(payload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 MCP 服务失败");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "操作失败");
      }
    },
    [load],
  );

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !command.trim()) {
      return;
    }
    void run(async () => {
      await api(withProfile("/api/hermes/mcp/servers", profile), {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), command: command.trim() }),
      });
      setName("");
      setCommand("");
    });
  };

  const install = (event: FormEvent) => {
    event.preventDefault();
    if (!catalogName.trim()) {
      return;
    }
    void run(async () => {
      await api(withProfile("/api/hermes/mcp/catalog/install", profile), {
        method: "POST",
        body: JSON.stringify({ name: catalogName.trim() }),
      });
      setCatalogName("");
    });
  };

  const toggle = (server: McpServerEntry) => {
    const enabled = !server.enabled;
    setBusy(server.name);
    void run(async () => {
      await api(withProfile(`/api/hermes/mcp/servers/${encodeURIComponent(server.name)}`, profile), {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
    }).finally(() => setBusy(null));
  };

  const remove = (server: McpServerEntry) => {
    setBusy(server.name);
    void run(async () => {
      await api(withProfile(`/api/hermes/mcp/servers/${encodeURIComponent(server.name)}`, profile), {
        method: "DELETE",
      });
    }).finally(() => setBusy(null));
  };

  const focusAddForm = useCallback(() => {
    const input = nameInputRef.current;
    if (!input) {
      return;
    }
    input.scrollIntoView?.({ behavior: "smooth", block: "center" });
    input.focus();
  }, []);

  return (
    <div className="mcp">
      {error ? <p className="err">{error}</p> : null}

      <form className="card" onSubmit={add}>
        <h3>添加 MCP 服务</h3>
        <div className="row">
          <input
            aria-label="MCP 名称"
            placeholder="名称"
            ref={nameInputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            aria-label="MCP 命令"
            placeholder="命令或地址"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
          />
          <button className="primary" type="submit">
            添加
          </button>
        </div>
      </form>

      <form className="card" onSubmit={install}>
        <h3>从目录安装</h3>
        <div className="row">
          <input
            aria-label="MCP 目录名称"
            placeholder="目录中的服务名"
            value={catalogName}
            onChange={(event) => setCatalogName(event.target.value)}
          />
          <button className="ghost" type="submit">
            安装
          </button>
        </div>
      </form>

      <div className="card">
        <h3>MCP 服务</h3>
        {loading ? (
          <p className="empty">加载中…</p>
        ) : servers.length === 0 ? (
          <EmptyState
            icon="info"
            title="暂无 MCP 服务"
            description="添加外部服务以扩展智能体能力"
            action={
              <Button variant="primary" onClick={focusAddForm}>
                添加 MCP 服务
              </Button>
            }
          />
        ) : (
          <ul className="toolset-list">
            {servers.map((server) => (
              <li className="toolset-item ds-card-row" key={server.name}>
                <label className="skill-toggle">
                  <input
                    type="checkbox"
                    aria-label={`启用 MCP ${server.name}`}
                    checked={server.enabled}
                    disabled={busy === server.name}
                    onChange={() => toggle(server)}
                  />
                </label>
                <span className="skill-name">{server.name}</span>
                {server.command ? (
                  <span className="skill-desc muted">{server.command}</span>
                ) : null}
                <button
                  type="button"
                  className="danger"
                  aria-label={`移除 ${server.name}`}
                  onClick={() => remove(server)}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
