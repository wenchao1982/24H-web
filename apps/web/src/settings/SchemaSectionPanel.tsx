import { useCallback, useEffect, useState } from "react";
import { t, type TranslationKey } from "../i18n";
import ConfigFieldsPanel, { type ConfigFieldDef } from "./ConfigFieldsPanel";
import { fetchConfigSchema, schemaFieldsForPrefix } from "./schema";

export interface SchemaSectionPanelProps {
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  /** 配置点路径前缀（含自身），如 `gateway.api_server` / `tools.tool_search`。 */
  prefix: string;
}

/**
 * schema 驱动配置面板（C04）：从 `GET /api/config/schema` 取该前缀下的字段动态渲染，
 * 避免硬编码错误 path/类型。无匹配字段时给出可读说明而非渲染错误控件。
 */
export default function SchemaSectionPanel({ titleKey, hintKey, prefix }: SchemaSectionPanelProps) {
  const [fields, setFields] = useState<ConfigFieldDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const schema = await fetchConfigSchema();
      setFields(schemaFieldsForPrefix(schema, prefix));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("configForm.error.load"));
      setFields([]);
    }
  }, [prefix]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <p className="err" role="alert">
        {error}
      </p>
    );
  }
  if (fields === null) {
    return <p className="empty">{t("configForm.loading")}</p>;
  }
  if (fields.length === 0) {
    return (
      <div className="settings-section">
        <div className="card">
          <h3>{t(titleKey)}</h3>
          <p className="muted">{t(hintKey)}</p>
          <p className="muted">该功能在当前 Hermes 版本无对应配置项。</p>
        </div>
      </div>
    );
  }
  return <ConfigFieldsPanel titleKey={titleKey} hintKey={hintKey} fields={fields} />;
}
