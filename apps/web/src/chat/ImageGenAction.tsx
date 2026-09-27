import { useState } from "react";
import { useGateway } from "./GatewayProvider";
import { t } from "../i18n";
import { imageParams, normalizeGeneratedImage } from "./imageGen";

export interface ImageGenActionProps {
  onClose?: () => void;
}

/** 对话动作：输入提示词 → L1 `image.generate` → 渲染生成图片。 */
export default function ImageGenAction({ onClose }: ImageGenActionProps) {
  const gateway = useGateway();
  const [prompt, setPrompt] = useState("");
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    const text = prompt.trim();
    if (!text || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await gateway.request("image.generate", imageParams(text));
        const image = normalizeGeneratedImage(result);
        if (!image) {
          setError(t("image.empty"));
          setSrc(null);
          return;
        }
        setSrc(image);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("image.error"));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="card image-gen">
      <div className="image-gen-head">
        <h3>{t("image.title")}</h3>
        {onClose ? (
          <button type="button" className="ghost" aria-label={t("image.close")} onClick={onClose}>
            ✕
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <input
          aria-label={t("image.prompt")}
          placeholder={t("image.placeholder")}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              generate();
            }
          }}
        />
        <button
          type="button"
          className="primary"
          aria-label={t("image.generate")}
          disabled={loading || prompt.trim() === ""}
          onClick={generate}
        >
          {t("image.generate")}
        </button>
      </div>
      {loading ? <p className="empty">{t("image.loading")}</p> : null}
      {src ? (
        <img className="image-gen-result" src={src} alt={t("image.alt")} />
      ) : null}
    </div>
  );
}
