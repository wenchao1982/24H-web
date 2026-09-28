import { useCallback, useEffect, useState } from "react";
import { t } from "../i18n";
import { Button, EmptyState, Select, Skeleton, Tag, type TagTone } from "../ui";
import SkillHost, { type SkillHostLogEntry, type SkillHostStatus } from "./SkillHost";
import { listSkillUis, type SkillUiInfo } from "./skillhost";

type PreviewSize = "desktop" | "tablet" | "mobile";

const PREVIEW_SIZES: { value: PreviewSize; labelKey: "skillhost.preview.desktop" | "skillhost.preview.tablet" | "skillhost.preview.mobile"; width: number | "fill" }[] = [
  { value: "desktop", labelKey: "skillhost.preview.desktop", width: "fill" },
  { value: "tablet", labelKey: "skillhost.preview.tablet", width: 768 },
  { value: "mobile", labelKey: "skillhost.preview.mobile", width: 390 },
];

const MAX_LOG = 200;

const STATUS_TONE: Record<SkillHostStatus, TagTone> = {
  ready: "success",
  loading: "info",
  error: "danger",
};

const STATUS_LABEL: Record<
  SkillHostStatus,
  "skillhost.ready" | "skillhost.loading" | "skillhost.error"
> = {
  ready: "skillhost.ready",
  loading: "skillhost.loading",
  error: "skillhost.error",
};

/** 技能界面页：列出发现的 Skill UI，选中后在沙箱 iframe 中挂载。 */
export default function SkillsHostPage() {
  const [skills, setSkills] = useState<SkillUiInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [status, setStatus] = useState<SkillHostStatus>("loading");
  const [log, setLog] = useState<SkillHostLogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const found = await listSkillUis();
        if (!active) {
          return;
        }
        setSkills(found);
        setSelected((current) => current ?? found[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : t("skillhost.error.load"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const activeSkill = skills.find((skill) => skill.id === selected) ?? null;
  const previewWidth =
    PREVIEW_SIZES.find((option) => option.value === previewSize)?.width ?? "fill";

  const handleStatus = useCallback((next: SkillHostStatus) => {
    setStatus(next);
  }, []);

  const handleLog = useCallback((entry: SkillHostLogEntry) => {
    setLog((prev) => [...prev, entry].slice(-MAX_LOG));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelected(id);
    setLog([]);
    setStatus("loading");
  }, []);

  const handleReload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  const handleReset = useCallback(() => {
    setLog([]);
    setStatus("loading");
    setReloadKey((current) => current + 1);
  }, []);

  return (
    <div className="page skill-host-page">
      <h2>{t("skillhost.pageTitle")}</h2>
      <p className="hint">{t("skillhost.hint")}</p>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="skill-host-loading">
          <Skeleton width="100%" height={36} />
          <Skeleton width="100%" height={320} />
        </div>
      ) : null}
      {!loading && skills.length === 0 ? <EmptyState title={t("skillhost.empty")} /> : null}
      {!loading && skills.length > 0 ? (
        <div className="skill-host-workbench">
          <div className="skill-host-toolbar">
            <Select
              aria-label={t("skillhost.selectAria")}
              value={selected ?? ""}
              onChange={(event) => handleSelect(event.target.value)}
            >
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.title}
                </option>
              ))}
            </Select>
            <Button icon="refresh" aria-label={t("skillhost.reload")} onClick={handleReload}>
              {t("skillhost.reload")}
            </Button>
            <Button
              variant="ghost"
              icon="refresh"
              aria-label={t("skillhost.reset")}
              onClick={handleReset}
            >
              {t("skillhost.reset")}
            </Button>
            <div className="segmented" role="group" aria-label={t("skillhost.previewSize")}>
              {PREVIEW_SIZES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="segmented-btn"
                  data-active={previewSize === option.value}
                  aria-pressed={previewSize === option.value}
                  onClick={() => setPreviewSize(option.value)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
            <Tag tone={STATUS_TONE[status]}>{t(STATUS_LABEL[status])}</Tag>
            <Button
              variant="ghost"
              aria-label={t("skillhost.communicationLog")}
              aria-pressed={logOpen}
              onClick={() => setLogOpen((open) => !open)}
            >
              {t("skillhost.communicationLog")}
            </Button>
          </div>
          {logOpen ? (
            <div
              className="skill-log"
              role="log"
              aria-label={t("skillhost.communicationLog")}
            >
              {log.length === 0 ? (
                <p className="skill-log-empty">{t("skillhost.log.empty")}</p>
              ) : (
                log.map((entry, index) => (
                  <div className="skill-log-entry" data-dir={entry.dir} key={index}>
                    <span className="skill-log-dir">{entry.dir === "in" ? "←" : "→"}</span>
                    <span className="skill-log-text">{entry.text}</span>
                  </div>
                ))
              )}
            </div>
          ) : null}
          {activeSkill ? (
            <SkillHost
              key={`${activeSkill.id}:${reloadKey}`}
              skill={activeSkill}
              previewWidth={previewWidth}
              onStatus={handleStatus}
              onLog={handleLog}
            />
          ) : null}
          <p className="hint skill-host-security">{t("skillhost.securityNote")}</p>
        </div>
      ) : null}
    </div>
  );
}
