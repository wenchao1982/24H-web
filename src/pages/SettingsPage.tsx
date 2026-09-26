import { useEffect, useState } from "react";
import { api } from "../api/rest";

type EnvVar = { key: string; set?: boolean; description?: string };
type ModelOptions = { providers?: Array<{ models?: string[] }>; models?: string[] };

export default function SettingsPage() {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [keyName, setKeyName] = useState("DEEPSEEK_API_KEY");
  const [keyValue, setKeyValue] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api<Record<string, EnvVar>>("/api/env")
      .then((data) => setEnvVars(Object.values(data ?? {})))
      .catch(() => setEnvVars([]));
    api<ModelOptions>("/api/model/options")
      .then((data) => {
        const flat = data.models ?? (data.providers ?? []).flatMap((p) => p.models ?? []);
        setModels(flat);
      })
      .catch(() => setModels([]));
  }, []);

  const saveKey = async () => {
    setMessage(null);
    try {
      await api("/api/env", {
        method: "POST",
        body: JSON.stringify({ key: keyName, value: keyValue }),
      });
      setMessage(`已保存 ${keyName}（服务端不会回显明文）`);
      setKeyValue("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const saveModel = async () => {
    setMessage(null);
    try {
      await api("/api/model/set", { method: "POST", body: JSON.stringify({ model }) });
      setMessage(`已设置默认模型：${model}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div className="card">
        <h3>服务商与模型</h3>
        <div className="row">
          <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="环境变量名" />
          <input
            type="password"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder="API Key（不会回显）"
          />
          <button className="primary" type="button" onClick={() => void saveKey()}>
            保存
          </button>
        </div>
        <div className="row">
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">选择默认模型…</option>
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button className="primary" type="button" disabled={!model} onClick={() => void saveModel()}>
            设置模型
          </button>
        </div>
        <p className="muted">已配置的键：{envVars.filter((v) => v.set).map((v) => v.key).join("、") || "（无）"}</p>
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
