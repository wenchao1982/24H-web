import { useEffect, useState } from "react";
import { api } from "../api/client";
import { normalizeFileContent } from "./files";

export interface PreviewPanelProps {
  /** 待预览文件路径（来自文件面板选择）。 */
  path: string | null;
}

function looksLikeHtml(path: string, content: string): boolean {
  if (/\.(html?|htm)$/i.test(path)) {
    return true;
  }
  return /^\s*(<!doctype html|<html[\s>])/i.test(content);
}

/** 详情面板 → 预览：文本预览；HTML 放入沙箱 iframe（M7 / T11.3）。 */
export default function PreviewPanel({ path }: PreviewPanelProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setContent("");
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const payload = await api<unknown>(
          `/api/hermes/files/read?path=${encodeURIComponent(path)}`,
        );
        if (!cancelled) {
          setContent(normalizeFileContent(payload));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setContent("");
          setError(err instanceof Error ? err.message : "读取预览内容失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return <p className="empty">请选择文件以预览。</p>;
  }

  if (error) {
    return (
      <p className="err" role="alert">
        {error}
      </p>
    );
  }

  if (loading) {
    return <p className="empty">加载预览中…</p>;
  }

  if (looksLikeHtml(path, content)) {
    return (
      <iframe
        className="preview-frame"
        title={`预览 ${path}`}
        sandbox=""
        srcDoc={content}
      />
    );
  }

  return (
    <pre className="preview-text" aria-label="预览内容">
      {content}
    </pre>
  );
}
